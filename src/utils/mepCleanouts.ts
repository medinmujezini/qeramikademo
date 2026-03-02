/**
 * MEP Cleanout System - Phase 3
 * 
 * Auto-placement of cleanouts per plumbing code requirements:
 * - At base of every drain stack
 * - At every 90-degree direction change
 * - At maximum 15m (50 ft) intervals on horizontal runs
 */

import { v4 as uuidv4 } from 'uuid';
import type { MEPRoute, MEPSegment, Point3D, MEPNode, FittingType } from '@/types/mep';

// =============================================================================
// TYPES
// =============================================================================

export type CleanoutType = 
  | 'stack-base'      // At bottom of vertical stack
  | 'directional'     // At direction changes (90°)
  | 'line-cleanout'   // Along long horizontal runs
  | 'test-tee'        // For testing purposes
  | 'building-drain'; // At building drain exit

export interface Cleanout {
  id: string;
  type: CleanoutType;
  position: Point3D;
  size: number;              // Pipe size (inches)
  accessDirection: number;   // Rotation in degrees (for access orientation)
  routeId: string;
  segmentId?: string;
  isAccessible: boolean;     // Meets 18" clearance requirement
  codeReference: string;
}

export interface CleanoutPlacementResult {
  cleanouts: Cleanout[];
  violations: CleanoutViolation[];
  coverage: number;          // Percentage of route covered by cleanouts
}

export interface CleanoutViolation {
  type: 'missing-stack-cleanout' | 'excessive-distance' | 'missing-directional' | 'inaccessible';
  message: string;
  location?: Point3D;
  severity: 'error' | 'warning';
  codeReference: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_CLEANOUT_SPACING_INCHES = 600;  // 50 feet = 600 inches
const MAX_CLEANOUT_SPACING_MM = 15000;    // 15 meters
const MIN_ACCESS_CLEARANCE = 18;          // 18 inches minimum clearance
const CLEANOUT_SIZE_RATIO = 1.0;          // Same size as pipe

// =============================================================================
// CLEANOUT PLACEMENT
// =============================================================================

/**
 * Auto-place cleanouts along a drainage route
 */
export function placeCleanouts(
  route: MEPRoute,
  nodes: MEPNode[],
  options: { metric?: boolean; maxSpacing?: number } = {}
): CleanoutPlacementResult {
  if (route.systemType !== 'drainage') {
    return { cleanouts: [], violations: [], coverage: 100 };
  }
  
  const cleanouts: Cleanout[] = [];
  const violations: CleanoutViolation[] = [];
  const maxSpacing = options.maxSpacing ?? MAX_CLEANOUT_SPACING_INCHES;
  
  // 1. Place cleanout at stack base (if route starts at drain stack)
  const sourceNode = nodes.find(n => n.id === route.source.nodeId);
  if (sourceNode?.type === 'drain-stack') {
    cleanouts.push({
      id: uuidv4(),
      type: 'stack-base',
      position: {
        x: sourceNode.position.x,
        y: sourceNode.position.y,
        z: 0,  // At floor level
      },
      size: route.requiredSize * CLEANOUT_SIZE_RATIO,
      accessDirection: 0,
      routeId: route.id,
      isAccessible: true,
      codeReference: 'IPC 708.1',
    });
  }
  
  // 2. ALWAYS place a cleanout at the start of every drainage route (fixture end)
  // This ensures every drainage connection has an accessible cleanout per code
  if (route.segments.length > 0) {
    const firstSeg = route.segments[0];
    // Place cleanout near the fixture (start of drainage run)
    cleanouts.push({
      id: uuidv4(),
      type: 'line-cleanout',
      position: {
        x: firstSeg.startPoint.x,
        y: firstSeg.startPoint.y,
        z: firstSeg.startPoint.z,
      },
      size: (route.requiredSize || firstSeg.size) * CLEANOUT_SIZE_RATIO,
      accessDirection: 0,
      routeId: route.id,
      segmentId: firstSeg.id,
      isAccessible: true,
      codeReference: 'IPC 708.2',
    });
  }
  
  // 2. Place cleanouts at direction changes and along long runs
  let distanceSinceLastCleanout = 0;
  let lastCleanoutPosition: Point3D | null = sourceNode 
    ? { ...sourceNode.position, z: 0 }
    : null;
  
  for (let i = 0; i < route.segments.length; i++) {
    const segment = route.segments[i];
    const segmentLength = calculateSegmentLength(segment);
    
    // Check for direction change (90-degree turn)
    if (i > 0) {
      const prevSegment = route.segments[i - 1];
      const angle = calculateAngleBetweenSegments(prevSegment, segment);
      
      if (Math.abs(angle) >= 80 && Math.abs(angle) <= 100) {
        // Place directional cleanout
        cleanouts.push({
          id: uuidv4(),
          type: 'directional',
          position: { ...segment.startPoint },
          size: segment.size * CLEANOUT_SIZE_RATIO,
          accessDirection: calculateAccessDirection(prevSegment, segment),
          routeId: route.id,
          segmentId: segment.id,
          isAccessible: true,
          codeReference: 'IPC 708.3',
        });
        
        distanceSinceLastCleanout = 0;
        lastCleanoutPosition = { ...segment.startPoint };
      }
    }
    
    // Check for maximum spacing
    distanceSinceLastCleanout += segmentLength;
    
    if (distanceSinceLastCleanout > maxSpacing) {
      // Place line cleanout at midpoint of current segment
      const midPoint: Point3D = {
        x: (segment.startPoint.x + segment.endPoint.x) / 2,
        y: (segment.startPoint.y + segment.endPoint.y) / 2,
        z: (segment.startPoint.z + segment.endPoint.z) / 2,
      };
      
      cleanouts.push({
        id: uuidv4(),
        type: 'line-cleanout',
        position: midPoint,
        size: segment.size * CLEANOUT_SIZE_RATIO,
        accessDirection: calculateSegmentDirection(segment),
        routeId: route.id,
        segmentId: segment.id,
        isAccessible: true,
        codeReference: 'IPC 708.4',
      });
      
      distanceSinceLastCleanout = segmentLength / 2;
      lastCleanoutPosition = midPoint;
    }
  }
  
  // 3. Check for violations
  
  // No stack cleanout
  if (sourceNode?.type === 'drain-stack' && !cleanouts.some(c => c.type === 'stack-base')) {
    violations.push({
      type: 'missing-stack-cleanout',
      message: 'Missing cleanout at drain stack base',
      location: sourceNode.position,
      severity: 'error',
      codeReference: 'IPC 708.1',
    });
  }
  
  // Check if any long runs are uncovered
  const totalLength = route.segments.reduce((sum, s) => sum + calculateSegmentLength(s), 0);
  const cleanoutCount = cleanouts.length;
  
  if (totalLength > maxSpacing * 2 && cleanoutCount < 2) {
    violations.push({
      type: 'excessive-distance',
      message: `Insufficient cleanouts for ${(totalLength / 12).toFixed(1)} ft run`,
      severity: 'warning',
      codeReference: 'IPC 708.4',
    });
  }
  
  // Calculate coverage
  const coverage = cleanoutCount > 0 
    ? Math.min(100, (cleanoutCount * maxSpacing / totalLength) * 100)
    : 0;
  
  return {
    cleanouts,
    violations,
    coverage,
  };
}

/**
 * Check if a cleanout position is accessible
 */
export function checkCleanoutAccessibility(
  cleanout: Cleanout,
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>,
  fixtures: Array<{ position: { x: number; y: number }; dimensions: { width: number; depth: number } }>
): { isAccessible: boolean; clearance: number; message: string } {
  let minClearance = Infinity;
  
  // Check distance to walls
  for (const wall of walls) {
    const dist = pointToLineDistance(
      cleanout.position.x,
      cleanout.position.y,
      wall.x1,
      wall.y1,
      wall.x2,
      wall.y2
    );
    minClearance = Math.min(minClearance, dist);
  }
  
  // Check distance to fixtures
  for (const fixture of fixtures) {
    const dx = Math.abs(cleanout.position.x - fixture.position.x) - fixture.dimensions.width / 2;
    const dy = Math.abs(cleanout.position.y - fixture.position.y) - fixture.dimensions.depth / 2;
    const dist = Math.max(0, Math.min(dx, dy));
    minClearance = Math.min(minClearance, dist);
  }
  
  const isAccessible = minClearance >= MIN_ACCESS_CLEARANCE;
  
  return {
    isAccessible,
    clearance: minClearance,
    message: isAccessible
      ? `Cleanout accessible with ${minClearance.toFixed(1)}" clearance`
      : `Cleanout blocked - only ${minClearance.toFixed(1)}" clearance (min: ${MIN_ACCESS_CLEARANCE}")`,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function calculateSegmentLength(segment: MEPSegment): number {
  const dx = segment.endPoint.x - segment.startPoint.x;
  const dy = segment.endPoint.y - segment.startPoint.y;
  const dz = segment.endPoint.z - segment.startPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateAngleBetweenSegments(seg1: MEPSegment, seg2: MEPSegment): number {
  const dir1 = {
    x: seg1.endPoint.x - seg1.startPoint.x,
    y: seg1.endPoint.y - seg1.startPoint.y,
  };
  const dir2 = {
    x: seg2.endPoint.x - seg2.startPoint.x,
    y: seg2.endPoint.y - seg2.startPoint.y,
  };
  
  const angle1 = Math.atan2(dir1.y, dir1.x);
  const angle2 = Math.atan2(dir2.y, dir2.x);
  
  let angleDiff = (angle2 - angle1) * (180 / Math.PI);
  
  // Normalize to 0-180
  while (angleDiff < 0) angleDiff += 360;
  while (angleDiff > 180) angleDiff = 360 - angleDiff;
  
  return angleDiff;
}

function calculateSegmentDirection(segment: MEPSegment): number {
  const dx = segment.endPoint.x - segment.startPoint.x;
  const dy = segment.endPoint.y - segment.startPoint.y;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

function calculateAccessDirection(prevSeg: MEPSegment, currSeg: MEPSegment): number {
  // Access should be opposite the flow direction
  const prevDir = calculateSegmentDirection(prevSeg);
  return (prevDir + 180) % 360;
}

function pointToLineDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  
  if (len2 === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  
  return Math.hypot(px - projX, py - projY);
}

// =============================================================================
// CLEANOUT VISUALIZATION
// =============================================================================

export interface CleanoutSymbol {
  x: number;
  y: number;
  size: number;
  rotation: number;
  type: CleanoutType;
  label: string;
}

/**
 * Get cleanout symbols for 2D visualization
 */
export function getCleanoutSymbols(cleanouts: Cleanout[]): CleanoutSymbol[] {
  return cleanouts.map(c => ({
    x: c.position.x,
    y: c.position.y,
    size: Math.max(12, c.size * 4),
    rotation: c.accessDirection,
    type: c.type,
    label: c.type === 'stack-base' ? 'CO-S' :
           c.type === 'directional' ? 'CO-D' :
           c.type === 'line-cleanout' ? 'CO' :
           c.type === 'building-drain' ? 'CO-B' : 'CO-T',
  }));
}

/**
 * Draw cleanout symbol on 2D canvas
 */
export function drawCleanoutSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: CleanoutSymbol,
  scale: number
): void {
  const { x, y, size, rotation, type, label } = symbol;
  
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation * Math.PI / 180);
  
  // Cleanout circle with cap line
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2 / scale;
  ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
  
  // Main circle
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Access direction indicator (line pointing outward)
  ctx.beginPath();
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(0, -size);
  ctx.stroke();
  
  // Cap/plug indicator
  ctx.fillStyle = '#22C55E';
  ctx.beginPath();
  ctx.arc(0, -size * 0.75, size / 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${8 / scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);
  
  ctx.restore();
}
