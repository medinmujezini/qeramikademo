/**
 * MEP Slope Engine - Phase 1
 * 
 * 3D elevation-aware routing with proper drainage slopes.
 * Calculates true elevation changes for drainage and vent systems.
 */

import type { MEPRoute, MEPSegment, Point3D, MEPSystemType } from '@/types/mep';
import { getMinSlope, DRAINAGE_SLOPES } from '@/data/plumbingCodes';

// =============================================================================
// TYPES
// =============================================================================

export interface ElevationData {
  startElevation: number;  // inches from floor
  endElevation: number;
  totalDrop: number;
  slope: number;           // inches per foot
  slopePercent: number;
  isValid: boolean;
  message: string;
}

export interface SlopeVisualization {
  gradientStart: string;
  gradientEnd: string;
  arrowDirection: 'down' | 'up' | 'flat';
  elevationLabels: Array<{
    x: number;
    y: number;
    elevation: number;
    label: string;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Standard elevations (inches from floor)
export const STANDARD_ELEVATIONS = {
  // Drainage fixture rough-in heights
  TOILET_FLANGE: 0,           // At floor level
  SINK_TRAP: 18,              // P-trap under sink
  SHOWER_DRAIN: -2,           // Slightly below floor
  BATHTUB_DRAIN: 0,           // At floor level
  KITCHEN_SINK_TRAP: 18,      // Under counter
  FLOOR_DRAIN: -2,            // Recessed
  WASHING_MACHINE_STANDPIPE: 34,
  
  // Water supply rough-in heights
  TOILET_SUPPLY: 8,
  SINK_SUPPLY: 20,
  SHOWER_VALVE: 48,
  BATHTUB_SPOUT: 24,
  KITCHEN_FAUCET: 20,
  WASHING_MACHINE_SUPPLY: 42,
  
  // Infrastructure
  DRAIN_STACK_ENTRY: 0,       // Building drain entry
  VENT_STACK_ROOF: 144,       // 12 feet (through roof)
  WATER_MAIN: 12,
  WATER_HEATER: 18,
};

// Flood rim levels for venting (inches from floor)
export const FLOOD_RIM_LEVELS: Record<string, number> = {
  'toilet': 15,
  'sink': 30,
  'kitchen-sink': 34,
  'shower': 0,        // At floor
  'bathtub': 14,
  'bidet': 15,
  'floor-drain': 0,
  'utility-sink': 34,
  'washing-machine': 36,
  'dishwasher': 24,
};

// =============================================================================
// SLOPE CALCULATION
// =============================================================================

/**
 * Calculate required elevation drop for a horizontal drainage run
 */
export function calculateElevationDrop(
  horizontalDistance: number,  // in canvas units (assume 1 unit = 1 inch)
  pipeSize: number             // inches
): number {
  const slopePerFoot = getMinSlope(pipeSize);
  const distanceInFeet = horizontalDistance / 12;
  return distanceInFeet * slopePerFoot;
}

/**
 * Calculate slope data for a segment
 */
export function calculateSegmentSlope(segment: MEPSegment): ElevationData {
  const dx = segment.endPoint.x - segment.startPoint.x;
  const dy = segment.endPoint.y - segment.startPoint.y;
  const horizontalDist = Math.sqrt(dx * dx + dy * dy);
  const horizontalDistFeet = horizontalDist / 12;
  
  const verticalDrop = segment.startPoint.z - segment.endPoint.z;
  
  // Slope in inches per foot
  const slope = horizontalDistFeet > 0 ? verticalDrop / horizontalDistFeet : 0;
  const slopePercent = (slope / 12) * 100;
  
  const minSlope = getMinSlope(segment.size);
  const isValid = slope >= minSlope;
  
  return {
    startElevation: segment.startPoint.z,
    endElevation: segment.endPoint.z,
    totalDrop: verticalDrop,
    slope,
    slopePercent,
    isValid,
    message: isValid 
      ? `${slope.toFixed(3)}"/ft OK` 
      : `Needs ${minSlope}"/ft, has ${slope.toFixed(3)}"/ft`,
  };
}

/**
 * Apply proper slopes to a drainage route
 */
export function applyDrainageSlopes(
  route: MEPRoute,
  startElevation: number,
  fixtureType: string
): MEPRoute {
  if (route.systemType !== 'drainage') return route;
  
  const updatedSegments: MEPSegment[] = [];
  let currentElevation = startElevation;
  
  for (let i = 0; i < route.segments.length; i++) {
    const seg = route.segments[i];
    const dx = seg.endPoint.x - seg.startPoint.x;
    const dy = seg.endPoint.y - seg.startPoint.y;
    const horizontalDist = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate required drop
    const drop = calculateElevationDrop(horizontalDist, seg.size);
    const newEndElevation = currentElevation - drop;
    
    const updatedSegment: MEPSegment = {
      ...seg,
      startPoint: { ...seg.startPoint, z: currentElevation },
      endPoint: { ...seg.endPoint, z: newEndElevation },
      slope: getMinSlope(seg.size),
    };
    
    updatedSegments.push(updatedSegment);
    currentElevation = newEndElevation;
  }
  
  return {
    ...route,
    segments: updatedSegments,
    elevation: {
      start: startElevation,
      end: currentElevation,
    },
  };
}

/**
 * Get starting elevation for a fixture drainage connection
 */
export function getFixtureDrainElevation(fixtureType: string): number {
  switch (fixtureType) {
    case 'toilet': return STANDARD_ELEVATIONS.TOILET_FLANGE;
    case 'sink': return STANDARD_ELEVATIONS.SINK_TRAP;
    case 'kitchen-sink': return STANDARD_ELEVATIONS.KITCHEN_SINK_TRAP;
    case 'shower': return STANDARD_ELEVATIONS.SHOWER_DRAIN;
    case 'bathtub': return STANDARD_ELEVATIONS.BATHTUB_DRAIN;
    case 'floor-drain': return STANDARD_ELEVATIONS.FLOOR_DRAIN;
    case 'washing-machine': return STANDARD_ELEVATIONS.WASHING_MACHINE_STANDPIPE;
    default: return STANDARD_ELEVATIONS.SINK_TRAP;
  }
}

// =============================================================================
// SLOPE VISUALIZATION
// =============================================================================

/**
 * Generate slope visualization data for a route
 */
export function getSlopeVisualization(route: MEPRoute): SlopeVisualization {
  const elevationLabels: SlopeVisualization['elevationLabels'] = [];
  
  // Add elevation label at start of each segment
  for (const segment of route.segments) {
    elevationLabels.push({
      x: segment.startPoint.x,
      y: segment.startPoint.y,
      elevation: segment.startPoint.z,
      label: `EL: ${segment.startPoint.z.toFixed(1)}"`,
    });
  }
  
  // Add final elevation
  if (route.segments.length > 0) {
    const lastSeg = route.segments[route.segments.length - 1];
    elevationLabels.push({
      x: lastSeg.endPoint.x,
      y: lastSeg.endPoint.y,
      elevation: lastSeg.endPoint.z,
      label: `EL: ${lastSeg.endPoint.z.toFixed(1)}"`,
    });
  }
  
  // Determine overall direction
  const startZ = route.elevation?.start ?? 0;
  const endZ = route.elevation?.end ?? 0;
  const arrowDirection: 'down' | 'up' | 'flat' = 
    startZ > endZ ? 'down' : startZ < endZ ? 'up' : 'flat';
  
  // Gradient colors based on elevation (darker = lower)
  const maxElevation = Math.max(startZ, endZ, 48);
  const startBrightness = Math.round(30 + (startZ / maxElevation) * 40);
  const endBrightness = Math.round(30 + (endZ / maxElevation) * 40);
  
  return {
    gradientStart: `hsl(142, 76%, ${startBrightness}%)`,
    gradientEnd: `hsl(142, 76%, ${endBrightness}%)`,
    arrowDirection,
    elevationLabels,
  };
}

/**
 * Format slope for display
 */
export function formatSlope(slopePerFoot: number): string {
  if (slopePerFoot === 0.25) return '1/4"/ft (2.08%)';
  if (slopePerFoot === 0.125) return '1/8"/ft (1.04%)';
  return `${slopePerFoot.toFixed(3)}"/ft (${((slopePerFoot / 12) * 100).toFixed(2)}%)`;
}

/**
 * Get slope requirement description for pipe size
 */
export function getSlopeRequirement(pipeSizeInches: number): string {
  for (const entry of DRAINAGE_SLOPES) {
    if (pipeSizeInches >= entry.minPipeSize && pipeSizeInches < entry.maxPipeSize) {
      return entry.description;
    }
  }
  return DRAINAGE_SLOPES[DRAINAGE_SLOPES.length - 1].description;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface SlopeViolation {
  segmentId: string;
  actualSlope: number;
  requiredSlope: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate all slopes in a route
 */
export function validateRouteSlopes(route: MEPRoute): SlopeViolation[] {
  if (route.systemType !== 'drainage') return [];
  if (route.segments.length === 0) return [];
  
  // Check if elevations are actually set (not all zeros)
  // Auto-generated routes often have z=0 for all points which is unset, not actual elevation
  const hasValidElevations = route.segments.some(seg => 
    seg.startPoint.z !== 0 || seg.endPoint.z !== 0
  );
  
  // Skip validation for routes without elevation data - these are 2D layouts
  if (!hasValidElevations) {
    return [];
  }
  
  const violations: SlopeViolation[] = [];
  let slopeIssueCount = 0;
  
  for (const segment of route.segments) {
    const slopeData = calculateSegmentSlope(segment);
    
    // Check for reverse slope (draining uphill) - this is always critical
    if (slopeData.slope < -0.01) { // Small tolerance for floating point
      violations.push({
        segmentId: segment.id,
        actualSlope: slopeData.slope,
        requiredSlope: getMinSlope(segment.size),
        message: 'CRITICAL: Drainage pipe slopes upward (reverse slope)',
        severity: 'error',
      });
      continue;
    }
    
    if (!slopeData.isValid) {
      slopeIssueCount++;
      // Only report first 3 slope issues per route, then summarize
      if (slopeIssueCount <= 3) {
        const requiredSlope = getMinSlope(segment.size);
        // Slightly under is just warning, significantly under is error
        const severity = slopeData.slope < requiredSlope * 0.5 ? 'error' : 'warning';
        
        violations.push({
          segmentId: segment.id,
          actualSlope: slopeData.slope,
          requiredSlope,
          message: `Drainage slope too shallow: ${slopeData.slope.toFixed(3)}"/ft (min: ${requiredSlope}"/ft)`,
          severity,
        });
      }
    }
  }
  
  // If there were more than 3 slope issues, add a summary instead
  if (slopeIssueCount > 3) {
    violations.push({
      segmentId: route.id,
      actualSlope: 0,
      requiredSlope: getMinSlope(route.requiredSize),
      message: `${slopeIssueCount - 3} additional segments have insufficient slope`,
      severity: 'warning',
    });
  }
  
  return violations;
}

/**
 * Check maximum horizontal run without sufficient slope
 */
export function checkMaxFlatRun(route: MEPRoute, maxFlatFeet: number = 10): {
  isViolation: boolean;
  flatRunFeet: number;
  message: string;
} {
  if (route.systemType !== 'drainage') {
    return { isViolation: false, flatRunFeet: 0, message: '' };
  }
  
  let consecutiveFlatDistance = 0;
  
  for (const segment of route.segments) {
    const slopeData = calculateSegmentSlope(segment);
    
    if (slopeData.slope < 0.01) {
      // Essentially flat
      const dx = segment.endPoint.x - segment.startPoint.x;
      const dy = segment.endPoint.y - segment.startPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      consecutiveFlatDistance += dist;
    } else {
      consecutiveFlatDistance = 0;
    }
  }
  
  const flatRunFeet = consecutiveFlatDistance / 12;
  
  return {
    isViolation: flatRunFeet > maxFlatFeet,
    flatRunFeet,
    message: flatRunFeet > maxFlatFeet 
      ? `Flat run too long: ${flatRunFeet.toFixed(1)} ft (max: ${maxFlatFeet} ft)`
      : '',
  };
}
