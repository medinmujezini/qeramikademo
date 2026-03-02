/**
 * MEP Water Line Improvements - Phase 7
 * 
 * Hot/cold separation rules, isolation valve placement,
 * and water heater connection validation.
 */

import { v4 as uuidv4 } from 'uuid';
import type { MEPRoute, MEPSegment, MEPNode, MEPFixture, Point3D, FittingType } from '@/types/mep';

// =============================================================================
// TYPES
// =============================================================================

export interface WaterLineViolation {
  type: 'parallel-too-close' | 'no-isolation-valve' | 'cross-connection' | 'wrong-heater-connection';
  message: string;
  position?: Point3D;
  severity: 'error' | 'warning';
  codeReference: string;
}

export interface IsolationValve {
  id: string;
  type: 'gate' | 'ball' | 'quarter-turn';
  position: Point3D;
  size: number;
  routeId: string;
  purpose: 'fixture-shutoff' | 'branch-shutoff' | 'main-shutoff' | 'heater-inlet' | 'heater-outlet';
  isAccessible: boolean;
}

export interface WaterHeaterConnection {
  nodeId: string;
  coldInlet: {
    connected: boolean;
    routeId?: string;
    hasShutoff: boolean;
  };
  hotOutlet: {
    connected: boolean;
    routeId?: string;
    hasShutoff: boolean;
  };
  reliefValve: boolean;
  expansionTank: boolean;
  isValid: boolean;
  violations: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_HOT_COLD_SEPARATION = 2;        // 2 inches minimum
const MAX_PARALLEL_RUN_WITHOUT_SEP = 120; // 10 feet = 120 inches
const INSULATION_REQUIRED_DISTANCE = 6;   // 6 inches between hot/cold requires insulation

// =============================================================================
// HOT/COLD SEPARATION
// =============================================================================

/**
 * Check hot/cold water line separation
 */
export function checkHotColdSeparation(
  hotRoutes: MEPRoute[],
  coldRoutes: MEPRoute[]
): WaterLineViolation[] {
  const violations: WaterLineViolation[] = [];
  
  for (const hotRoute of hotRoutes) {
    for (const coldRoute of coldRoutes) {
      // Check each segment pair
      for (const hotSeg of hotRoute.segments) {
        for (const coldSeg of coldRoute.segments) {
          const separation = calculateSegmentSeparation(hotSeg, coldSeg);
          
          if (separation.minDistance < MIN_HOT_COLD_SEPARATION) {
            violations.push({
              type: 'parallel-too-close',
              message: `Hot and cold lines too close: ${separation.minDistance.toFixed(1)}" (min: ${MIN_HOT_COLD_SEPARATION}")`,
              position: separation.closestPoint,
              severity: 'warning',
              codeReference: 'IRC P2905.4.2',
            });
          }
          
          // Check for parallel runs that need insulation
          if (separation.minDistance < INSULATION_REQUIRED_DISTANCE && 
              separation.parallelLength > 24) {
            violations.push({
              type: 'parallel-too-close',
              message: `Parallel run ${(separation.parallelLength / 12).toFixed(1)} ft requires pipe insulation`,
              position: separation.closestPoint,
              severity: 'warning',
              codeReference: 'Energy Code',
            });
          }
        }
      }
    }
  }
  
  return violations;
}

/**
 * Calculate separation between two pipe segments
 */
function calculateSegmentSeparation(seg1: MEPSegment, seg2: MEPSegment): {
  minDistance: number;
  parallelLength: number;
  closestPoint: Point3D;
} {
  // Check if segments are parallel (same direction)
  const dir1 = normalizeDirection(seg1);
  const dir2 = normalizeDirection(seg2);
  const isParallel = Math.abs(dir1.x * dir2.x + dir1.y * dir2.y) > 0.9;
  
  // Calculate minimum distance between segment lines
  const mid1 = {
    x: (seg1.startPoint.x + seg1.endPoint.x) / 2,
    y: (seg1.startPoint.y + seg1.endPoint.y) / 2,
    z: (seg1.startPoint.z + seg1.endPoint.z) / 2,
  };
  const mid2 = {
    x: (seg2.startPoint.x + seg2.endPoint.x) / 2,
    y: (seg2.startPoint.y + seg2.endPoint.y) / 2,
    z: (seg2.startPoint.z + seg2.endPoint.z) / 2,
  };
  
  const distance = Math.sqrt(
    Math.pow(mid1.x - mid2.x, 2) +
    Math.pow(mid1.y - mid2.y, 2) +
    Math.pow(mid1.z - mid2.z, 2)
  );
  
  // Calculate overlap length if parallel
  let parallelLength = 0;
  if (isParallel) {
    const len1 = segmentLength(seg1);
    const len2 = segmentLength(seg2);
    parallelLength = Math.min(len1, len2);
  }
  
  return {
    minDistance: distance,
    parallelLength,
    closestPoint: mid1,
  };
}

function normalizeDirection(seg: MEPSegment): { x: number; y: number } {
  const dx = seg.endPoint.x - seg.startPoint.x;
  const dy = seg.endPoint.y - seg.startPoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

function segmentLength(seg: MEPSegment): number {
  const dx = seg.endPoint.x - seg.startPoint.x;
  const dy = seg.endPoint.y - seg.startPoint.y;
  const dz = seg.endPoint.z - seg.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// =============================================================================
// ISOLATION VALVE PLACEMENT
// =============================================================================

/**
 * Auto-place isolation valves for water lines
 */
export function placeIsolationValves(
  routes: MEPRoute[],
  fixtures: MEPFixture[],
  nodes: MEPNode[]
): IsolationValve[] {
  const valves: IsolationValve[] = [];
  
  // Water routes only
  const waterRoutes = routes.filter(r => 
    r.systemType === 'cold-water' || r.systemType === 'hot-water'
  );
  
  for (const route of waterRoutes) {
    // 1. Fixture shutoff at destination
    if (route.destination.type === 'fixture') {
      const fixture = fixtures.find(f => f.id === route.destination.id);
      if (fixture && route.segments.length > 0) {
        const lastSeg = route.segments[route.segments.length - 1];
        
        valves.push({
          id: uuidv4(),
          type: 'quarter-turn',
          position: {
            x: lastSeg.endPoint.x,
            y: lastSeg.endPoint.y,
            z: lastSeg.endPoint.z,
          },
          size: route.requiredSize,
          routeId: route.id,
          purpose: 'fixture-shutoff',
          isAccessible: true,
        });
      }
    }
    
    // 2. Main shutoff at source (manifold or heater)
    const sourceNode = nodes.find(n => n.id === route.source.nodeId);
    if (sourceNode && route.segments.length > 0) {
      const firstSeg = route.segments[0];
      
      let purpose: IsolationValve['purpose'] = 'main-shutoff';
      if (sourceNode.type === 'water-heater') {
        purpose = route.systemType === 'hot-water' ? 'heater-outlet' : 'heater-inlet';
      }
      
      valves.push({
        id: uuidv4(),
        type: 'ball',
        position: {
          x: firstSeg.startPoint.x + 12,
          y: firstSeg.startPoint.y,
          z: firstSeg.startPoint.z,
        },
        size: route.requiredSize,
        routeId: route.id,
        purpose,
        isAccessible: true,
      });
    }
  }
  
  return valves;
}

/**
 * Validate that required isolation valves are present
 */
export function validateIsolationValves(
  routes: MEPRoute[],
  valves: IsolationValve[]
): WaterLineViolation[] {
  const violations: WaterLineViolation[] = [];
  
  const waterRoutes = routes.filter(r => 
    r.systemType === 'cold-water' || r.systemType === 'hot-water'
  );
  
  for (const route of waterRoutes) {
    const routeValves = valves.filter(v => v.routeId === route.id);
    
    // Check for fixture shutoff
    const hasFixtureShutoff = routeValves.some(v => v.purpose === 'fixture-shutoff');
    if (!hasFixtureShutoff && route.destination.type === 'fixture') {
      violations.push({
        type: 'no-isolation-valve',
        message: 'Missing fixture shutoff valve',
        severity: 'warning',
        codeReference: 'IRC P2903.9.3',
      });
    }
  }
  
  return violations;
}

// =============================================================================
// WATER HEATER CONNECTIONS
// =============================================================================

/**
 * Validate water heater connections
 */
export function validateWaterHeaterConnections(
  waterHeaters: MEPNode[],
  routes: MEPRoute[],
  valves: IsolationValve[]
): WaterHeaterConnection[] {
  return waterHeaters.map(heater => {
    const violations: string[] = [];
    
    // Find cold inlet route
    const coldInletRoute = routes.find(r => 
      r.source.nodeId === heater.id && r.systemType === 'cold-water'
    ) || routes.find(r =>
      r.destination.type === 'node' && 
      r.destination.id === heater.id && 
      r.systemType === 'cold-water'
    );
    
    // Find hot outlet route
    const hotOutletRoute = routes.find(r => 
      r.source.nodeId === heater.id && r.systemType === 'hot-water'
    );
    
    // Check for shutoff valves
    const heaterValves = valves.filter(v => 
      v.purpose === 'heater-inlet' || v.purpose === 'heater-outlet'
    );
    
    const hasColdShutoff = heaterValves.some(v => v.purpose === 'heater-inlet');
    const hasHotShutoff = heaterValves.some(v => v.purpose === 'heater-outlet');
    
    // Validate connections
    if (!coldInletRoute) {
      violations.push('Cold water inlet not connected');
    }
    if (!hotOutletRoute) {
      violations.push('Hot water outlet not connected');
    }
    if (coldInletRoute && !hasColdShutoff) {
      violations.push('Cold inlet missing shutoff valve');
    }
    if (hotOutletRoute && !hasHotShutoff) {
      violations.push('Hot outlet missing shutoff valve');
    }
    
    // Note: Relief valve and expansion tank would be detected by 
    // checking for specific node types connected to the heater
    
    return {
      nodeId: heater.id,
      coldInlet: {
        connected: !!coldInletRoute,
        routeId: coldInletRoute?.id,
        hasShutoff: hasColdShutoff,
      },
      hotOutlet: {
        connected: !!hotOutletRoute,
        routeId: hotOutletRoute?.id,
        hasShutoff: hasHotShutoff,
      },
      reliefValve: false, // Would need to check for relief valve node
      expansionTank: false, // Would need to check for expansion tank node
      isValid: violations.length === 0,
      violations,
    };
  });
}

// =============================================================================
// VALVE VISUALIZATION
// =============================================================================

/**
 * Draw isolation valve symbol on 2D canvas
 */
export function drawValveSymbol(
  ctx: CanvasRenderingContext2D,
  valve: IsolationValve,
  scale: number
): void {
  const { position, type, size } = valve;
  
  ctx.save();
  ctx.translate(position.x, position.y);
  
  const symbolSize = Math.max(8, size * 4);
  
  // Valve body
  ctx.strokeStyle = valve.purpose.includes('shutoff') ? '#3B82F6' : '#10B981';
  ctx.lineWidth = 2 / scale;
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
  
  if (type === 'ball' || type === 'quarter-turn') {
    // Ball valve - circle with line through
    ctx.beginPath();
    ctx.arc(0, 0, symbolSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Handle line
    ctx.beginPath();
    ctx.moveTo(-symbolSize / 2, 0);
    ctx.lineTo(symbolSize / 2, 0);
    ctx.stroke();
  } else {
    // Gate valve - bowtie shape
    ctx.beginPath();
    ctx.moveTo(-symbolSize / 2, -symbolSize / 3);
    ctx.lineTo(0, 0);
    ctx.lineTo(-symbolSize / 2, symbolSize / 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(symbolSize / 2, -symbolSize / 3);
    ctx.lineTo(0, 0);
    ctx.lineTo(symbolSize / 2, symbolSize / 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  // Label
  const label = valve.purpose === 'fixture-shutoff' ? 'V' : 
                valve.purpose === 'main-shutoff' ? 'MV' :
                valve.purpose === 'heater-inlet' ? 'CI' :
                valve.purpose === 'heater-outlet' ? 'HO' : 'V';
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${6 / scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  
  ctx.restore();
}
