/**
 * MEP Branch Loading & Pipe Sizing - Phase 5
 * 
 * DFU accumulation engine for automatic pipe sizing.
 * Tracks cumulative DFU along branches and auto-sizes pipes.
 */

import type { MEPRoute, MEPSegment, MEPFixture, MEPNode, Point3D } from '@/types/mep';
import { getDrainPipeSize, getVentPipeSize, getWaterPipeSize, DFU_TABLE, GPM_TABLE } from '@/data/plumbingCodes';

// =============================================================================
// TYPES
// =============================================================================

export interface BranchLoad {
  routeId: string;
  totalDFU: number;
  totalGPM: { cold: number; hot: number };
  fixtureCount: number;
  calculatedSize: number;
  actualSize: number;
  isOversized: boolean;
  isUndersized: boolean;
  fixtures: string[];
  message: string;
}

export interface PipeSizeTransition {
  routeId: string;
  segmentIndex: number;
  position: Point3D;
  fromSize: number;
  toSize: number;
  fittingType: 'reducer' | 'increaser';
  reason: string;
}

export interface BranchLimitCheck {
  branchSize: number;
  maxDFU: number;
  maxFixtures: number;
  currentDFU: number;
  currentFixtures: number;
  isOverloaded: boolean;
  message: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Maximum DFU and fixtures per branch size
export const BRANCH_LIMITS: Record<number, { maxDFU: number; maxFixtures: number | 'unlimited' }> = {
  1.5: { maxDFU: 3, maxFixtures: 2 },
  2: { maxDFU: 6, maxFixtures: 3 },
  2.5: { maxDFU: 12, maxFixtures: 4 },
  3: { maxDFU: 20, maxFixtures: 6 },
  4: { maxDFU: 160, maxFixtures: 'unlimited' },
  5: { maxDFU: 360, maxFixtures: 'unlimited' },
  6: { maxDFU: 620, maxFixtures: 'unlimited' },
};

// Pipe size visual widths (pixels at 1:1 scale)
export const PIPE_VISUAL_WIDTHS: Record<number, number> = {
  0.5: 2,
  0.75: 3,
  1: 3,
  1.25: 4,
  1.5: 4,
  2: 5,
  2.5: 6,
  3: 7,
  4: 9,
  5: 11,
  6: 13,
};

// =============================================================================
// DFU ACCUMULATION
// =============================================================================

/**
 * Calculate total DFU load for a branch
 */
export function calculateBranchDFU(
  route: MEPRoute,
  fixtures: MEPFixture[],
  connectedRoutes: MEPRoute[]
): number {
  let totalDFU = route.totalDFU;
  
  // Add DFU from any routes that feed into this one
  for (const connectedRoute of connectedRoutes) {
    // Check if this route connects to current route
    if (connectedRoute.destination.type === 'fixture') {
      const destFixture = fixtures.find(f => f.id === connectedRoute.destination.id);
      if (destFixture) {
        totalDFU += destFixture.dfu;
      }
    }
  }
  
  return totalDFU;
}

/**
 * Analyze branch loading for a route
 */
export function analyzeBranchLoad(
  route: MEPRoute,
  fixtures: MEPFixture[]
): BranchLoad {
  // Find all fixtures connected to this route
  const connectedFixtures = fixtures.filter(f => 
    route.destination.type === 'fixture' && route.destination.id === f.id
  );
  
  const fixtureNames = connectedFixtures.map(f => f.name);
  const totalDFU = connectedFixtures.reduce((sum, f) => sum + f.dfu, 0);
  const totalGPM = connectedFixtures.reduce(
    (acc, f) => {
      const gpm = GPM_TABLE[f.type] || { cold: 0, hot: 0 };
      return {
        cold: acc.cold + gpm.cold,
        hot: acc.hot + gpm.hot,
      };
    },
    { cold: 0, hot: 0 }
  );
  
  // Calculate required size
  let calculatedSize: number;
  if (route.systemType === 'drainage') {
    calculatedSize = getDrainPipeSize(totalDFU);
  } else if (route.systemType === 'vent') {
    calculatedSize = getVentPipeSize(totalDFU);
  } else if (route.systemType === 'cold-water') {
    calculatedSize = getWaterPipeSize(totalGPM.cold);
  } else if (route.systemType === 'hot-water') {
    calculatedSize = getWaterPipeSize(totalGPM.hot);
  } else {
    calculatedSize = 0.5;
  }
  
  const actualSize = route.requiredSize;
  const isOversized = actualSize > calculatedSize * 1.5;
  const isUndersized = actualSize < calculatedSize;
  
  let message = '';
  if (isUndersized) {
    message = `Undersized: ${actualSize}" installed, ${calculatedSize}" required for ${totalDFU} DFU`;
  } else if (isOversized) {
    message = `Oversized: ${actualSize}" installed, ${calculatedSize}" would suffice`;
  } else {
    message = `Properly sized: ${actualSize}" for ${totalDFU} DFU`;
  }
  
  return {
    routeId: route.id,
    totalDFU,
    totalGPM,
    fixtureCount: connectedFixtures.length,
    calculatedSize,
    actualSize,
    isOversized,
    isUndersized,
    fixtures: fixtureNames,
    message,
  };
}

/**
 * Check branch limits for a pipe size
 */
export function checkBranchLimits(
  pipeSize: number,
  currentDFU: number,
  currentFixtures: number
): BranchLimitCheck {
  // Find applicable limit
  const sizes = Object.keys(BRANCH_LIMITS).map(Number).sort((a, b) => a - b);
  const applicableSize = sizes.find(s => s >= pipeSize) || sizes[sizes.length - 1];
  const limits = BRANCH_LIMITS[applicableSize];
  
  const dfuOverloaded = currentDFU > limits.maxDFU;
  const fixturesOverloaded = limits.maxFixtures !== 'unlimited' && 
    currentFixtures > (limits.maxFixtures as number);
  
  const isOverloaded = dfuOverloaded || fixturesOverloaded;
  
  let message = '';
  if (dfuOverloaded) {
    message = `Branch overloaded: ${currentDFU} DFU (max: ${limits.maxDFU})`;
  } else if (fixturesOverloaded) {
    message = `Too many fixtures: ${currentFixtures} (max: ${limits.maxFixtures})`;
  } else {
    message = `Within limits: ${currentDFU}/${limits.maxDFU} DFU, ${currentFixtures}/${limits.maxFixtures} fixtures`;
  }
  
  return {
    branchSize: applicableSize,
    maxDFU: limits.maxDFU,
    maxFixtures: limits.maxFixtures === 'unlimited' ? Infinity : limits.maxFixtures,
    currentDFU,
    currentFixtures,
    isOverloaded,
    message,
  };
}

// =============================================================================
// PIPE SIZE TRANSITIONS
// =============================================================================

/**
 * Detect pipe size transitions in a route
 */
export function detectSizeTransitions(route: MEPRoute): PipeSizeTransition[] {
  const transitions: PipeSizeTransition[] = [];
  
  for (let i = 1; i < route.segments.length; i++) {
    const prevSeg = route.segments[i - 1];
    const currSeg = route.segments[i];
    
    if (prevSeg.size !== currSeg.size) {
      transitions.push({
        routeId: route.id,
        segmentIndex: i,
        position: { ...currSeg.startPoint },
        fromSize: prevSeg.size,
        toSize: currSeg.size,
        fittingType: currSeg.size < prevSeg.size ? 'reducer' : 'increaser',
        reason: currSeg.size < prevSeg.size 
          ? `Reducing from ${prevSeg.size}" to ${currSeg.size}"`
          : `Increasing from ${prevSeg.size}" to ${currSeg.size}"`,
      });
    }
  }
  
  return transitions;
}

/**
 * Validate no illegal reductions in flow direction for drainage
 */
export function validateNoIllegalReductions(route: MEPRoute): string[] {
  if (route.systemType !== 'drainage') return [];
  
  const violations: string[] = [];
  
  for (let i = 1; i < route.segments.length; i++) {
    const prevSeg = route.segments[i - 1];
    const currSeg = route.segments[i];
    
    // For drainage, pipe size should never decrease in flow direction
    if (currSeg.size < prevSeg.size) {
      violations.push(
        `Illegal pipe reduction at segment ${i}: ${prevSeg.size}" → ${currSeg.size}". ` +
        `Drainage pipes must maintain or increase size in flow direction.`
      );
    }
  }
  
  return violations;
}

// =============================================================================
// VISUALIZATION HELPERS
// =============================================================================

/**
 * Get visual line width for a pipe size
 */
export function getPipeVisualWidth(sizeInches: number): number {
  // Find closest defined size
  const sizes = Object.keys(PIPE_VISUAL_WIDTHS).map(Number).sort((a, b) => a - b);
  const closest = sizes.reduce((prev, curr) => 
    Math.abs(curr - sizeInches) < Math.abs(prev - sizeInches) ? curr : prev
  );
  
  return PIPE_VISUAL_WIDTHS[closest] || Math.max(2, sizeInches * 2);
}

/**
 * Format pipe size for display
 */
export function formatPipeSize(sizeInches: number): string {
  // Common fractional sizes
  const fractions: Record<number, string> = {
    0.5: '1/2"',
    0.625: '5/8"',
    0.75: '3/4"',
    1: '1"',
    1.25: '1-1/4"',
    1.5: '1-1/2"',
    2: '2"',
    2.5: '2-1/2"',
    3: '3"',
    4: '4"',
    5: '5"',
    6: '6"',
  };
  
  return fractions[sizeInches] || `${sizeInches}"`;
}

/**
 * Get material line pattern for visualization
 */
export function getMaterialPattern(material: string): number[] {
  switch (material) {
    case 'PVC':
    case 'ABS':
      return []; // Solid line
    case 'Copper':
    case 'Cu':
      return [10, 5]; // Dashed
    case 'PEX':
      return [5, 5]; // Short dashes
    case 'CPVC':
      return [15, 5]; // Long dashes
    case 'Cast Iron':
    case 'CI':
      return [5, 2, 2, 2]; // Dash-dot
    case 'Galvanized':
    case 'Galv':
      return [2, 2]; // Dotted
    default:
      return [];
  }
}

// =============================================================================
// CUMULATIVE SIZING
// =============================================================================

/**
 * Auto-size all segments in a route based on cumulative DFU
 */
export function autoSizeRoute(
  route: MEPRoute,
  fixtures: MEPFixture[]
): MEPRoute {
  if (route.systemType !== 'drainage') return route;
  
  // Calculate DFU at each segment (accumulating toward source)
  const updatedSegments: MEPSegment[] = [];
  let accumulatedDFU = 0;
  
  // For drainage, we accumulate from fixtures toward drain stack
  // Segments are ordered from source to destination, so we process in reverse
  const reversedSegments = [...route.segments].reverse();
  
  for (const segment of reversedSegments) {
    // Add fixture DFU at the destination end
    if (segment.segmentIndex === route.segments.length - 1) {
      const destFixture = fixtures.find(f => 
        route.destination.type === 'fixture' && route.destination.id === f.id
      );
      if (destFixture) {
        accumulatedDFU += destFixture.dfu;
      }
    }
    
    // Size based on accumulated DFU
    const requiredSize = getDrainPipeSize(accumulatedDFU);
    
    updatedSegments.unshift({
      ...segment,
      size: Math.max(segment.size, requiredSize), // Never reduce size
    });
  }
  
  // Calculate new required size
  const maxSize = Math.max(...updatedSegments.map(s => s.size));
  
  return {
    ...route,
    segments: updatedSegments,
    requiredSize: maxSize,
    totalDFU: accumulatedDFU,
  };
}
