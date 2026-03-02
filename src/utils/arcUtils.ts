import type { Point } from '@/types/floorPlan';

/**
 * Arc utilities for curved wall calculations
 * Bulge value: -1 to 1 where:
 * - 0 = straight line
 * - positive = curve bulges to the right (when looking from start to end)
 * - negative = curve bulges to the left
 * - |bulge| = tan(angle/4) where angle is the central angle of the arc
 */

export interface ArcInfo {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
}

/**
 * Calculate arc center and parameters from start, end points and bulge value
 */
export function calculateArcInfo(
  start: Point,
  end: Point,
  bulge: number
): ArcInfo | null {
  if (Math.abs(bulge) < 0.001) {
    return null; // Straight line
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLength = Math.sqrt(dx * dx + dy * dy);
  
  if (chordLength < 0.001) {
    return null; // Points too close
  }

  // Sagitta (distance from chord midpoint to arc)
  const sagitta = Math.abs(bulge) * chordLength / 2;
  
  // Radius from sagitta formula: r = (s/2) + (c²)/(8s)
  // where s = sagitta, c = chord length
  const radius = (sagitta / 2) + (chordLength * chordLength) / (8 * sagitta);

  // Midpoint of chord
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  // Perpendicular direction (normalized)
  const perpX = -dy / chordLength;
  const perpY = dx / chordLength;

  // Distance from midpoint to center
  const distToCenter = radius - sagitta;

  // Center is on opposite side of bulge
  const centerX = midX + perpX * distToCenter * (bulge > 0 ? -1 : 1);
  const centerY = midY + perpY * distToCenter * (bulge > 0 ? -1 : 1);

  // Calculate angles
  const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
  const endAngle = Math.atan2(end.y - centerY, end.x - centerX);

  return {
    center: { id: '', x: centerX, y: centerY },
    radius,
    startAngle,
    endAngle,
    clockwise: bulge > 0
  };
}

/**
 * Generate points along an arc for rendering
 */
export function getArcPoints(
  start: Point,
  end: Point,
  bulge: number,
  segments: number = 32
): Point[] {
  const arcInfo = calculateArcInfo(start, end, bulge);
  
  if (!arcInfo) {
    return [start, end]; // Straight line
  }

  const { center, radius, startAngle, endAngle, clockwise } = arcInfo;
  const points: Point[] = [];

  // Calculate angle difference
  let angleDiff = endAngle - startAngle;
  if (clockwise) {
    if (angleDiff > 0) angleDiff -= 2 * Math.PI;
  } else {
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
  }

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + angleDiff * t;
    points.push({
      id: '',
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    });
  }

  return points;
}

/**
 * Get a point at position t (0-1) along the arc
 */
export function pointOnArc(
  start: Point,
  end: Point,
  bulge: number,
  t: number
): Point {
  const arcInfo = calculateArcInfo(start, end, bulge);
  
  if (!arcInfo) {
    // Straight line interpolation
    return {
      id: '',
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  }

  const { center, radius, startAngle, endAngle, clockwise } = arcInfo;

  let angleDiff = endAngle - startAngle;
  if (clockwise) {
    if (angleDiff > 0) angleDiff -= 2 * Math.PI;
  } else {
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
  }

  const angle = startAngle + angleDiff * t;
  return {
    id: '',
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius
  };
}

/**
 * Calculate the total length of an arc
 */
export function arcLength(
  start: Point,
  end: Point,
  bulge: number
): number {
  const arcInfo = calculateArcInfo(start, end, bulge);
  
  if (!arcInfo) {
    // Straight line
    return Math.sqrt(
      (end.x - start.x) ** 2 + (end.y - start.y) ** 2
    );
  }

  const { startAngle, endAngle, radius, clockwise } = arcInfo;

  let angleDiff = Math.abs(endAngle - startAngle);
  if (clockwise && angleDiff > Math.PI) {
    angleDiff = 2 * Math.PI - angleDiff;
  } else if (!clockwise && angleDiff > Math.PI) {
    angleDiff = 2 * Math.PI - angleDiff;
  }

  return radius * angleDiff;
}

/**
 * Check if a point is near an arc (for hit testing)
 */
export function hitTestArc(
  start: Point,
  end: Point,
  bulge: number,
  testPoint: Point,
  threshold: number
): boolean {
  const arcInfo = calculateArcInfo(start, end, bulge);
  
  if (!arcInfo) {
    // Straight line hit test
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLen = Math.sqrt(dx * dx + dy * dy);
    const dot = ((testPoint.x - start.x) * dx + (testPoint.y - start.y) * dy) / (lineLen * lineLen);
    
    if (dot < 0 || dot > 1) return false;
    
    const closestX = start.x + dot * dx;
    const closestY = start.y + dot * dy;
    const dist = Math.sqrt((testPoint.x - closestX) ** 2 + (testPoint.y - closestY) ** 2);
    
    return dist < threshold;
  }

  const { center, radius, startAngle, endAngle, clockwise } = arcInfo;

  // Check distance from center
  const distFromCenter = Math.sqrt(
    (testPoint.x - center.x) ** 2 + (testPoint.y - center.y) ** 2
  );
  
  if (Math.abs(distFromCenter - radius) > threshold) {
    return false;
  }

  // Check if angle is within arc range
  const testAngle = Math.atan2(testPoint.y - center.y, testPoint.x - center.x);
  
  // Normalize angles
  const normalizeAngle = (a: number) => {
    while (a < 0) a += 2 * Math.PI;
    while (a >= 2 * Math.PI) a -= 2 * Math.PI;
    return a;
  };

  const normStart = normalizeAngle(startAngle);
  const normEnd = normalizeAngle(endAngle);
  const normTest = normalizeAngle(testAngle);

  if (clockwise) {
    if (normStart > normEnd) {
      return normTest <= normStart && normTest >= normEnd;
    } else {
      return normTest <= normStart || normTest >= normEnd;
    }
  } else {
    if (normStart < normEnd) {
      return normTest >= normStart && normTest <= normEnd;
    } else {
      return normTest >= normStart || normTest <= normEnd;
    }
  }
}

/**
 * Calculate the bulge handle position (midpoint of arc, perpendicular to chord)
 */
export function getBulgeHandlePosition(
  start: Point,
  end: Point,
  bulge: number
): Point {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  if (Math.abs(bulge) < 0.001) {
    return { id: '', x: midX, y: midY };
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLength = Math.sqrt(dx * dx + dy * dy);
  
  // Sagitta (how far the arc bulges from the chord)
  const sagitta = bulge * chordLength / 2;

  // Perpendicular direction
  const perpX = -dy / chordLength;
  const perpY = dx / chordLength;

  return {
    id: '',
    x: midX + perpX * sagitta,
    y: midY + perpY * sagitta
  };
}

/**
 * Calculate bulge value from handle position
 */
export function bulgeFromHandlePosition(
  start: Point,
  end: Point,
  handlePos: Point
): number {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLength = Math.sqrt(dx * dx + dy * dy);

  if (chordLength < 0.001) return 0;

  // Perpendicular direction
  const perpX = -dy / chordLength;
  const perpY = dx / chordLength;

  // Project handle offset onto perpendicular
  const offsetX = handlePos.x - midX;
  const offsetY = handlePos.y - midY;
  const sagitta = offsetX * perpX + offsetY * perpY;

  // Bulge = 2 * sagitta / chordLength
  const bulge = (2 * sagitta) / chordLength;
  
  // Clamp to valid range
  return Math.max(-1, Math.min(1, bulge));
}

/**
 * Split an arc at a given position t (0-1)
 * Returns the bulge values for the two resulting arcs
 */
export function splitArc(
  start: Point,
  end: Point,
  bulge: number,
  t: number
): { bulge1: number; bulge2: number; midPoint: Point } {
  const midPoint = pointOnArc(start, end, bulge, t);
  
  if (Math.abs(bulge) < 0.001) {
    return { bulge1: 0, bulge2: 0, midPoint };
  }

  // For an arc split at t, both sub-arcs have the same bulge value
  // This is an approximation that works well for small bulge values
  // For more accurate splitting, we'd need to recalculate based on the arc angles
  
  const arcInfo = calculateArcInfo(start, end, bulge);
  if (!arcInfo) {
    return { bulge1: 0, bulge2: 0, midPoint };
  }

  // Calculate the actual angular positions
  const { startAngle, endAngle, clockwise } = arcInfo;
  
  let angleDiff = endAngle - startAngle;
  if (clockwise) {
    if (angleDiff > 0) angleDiff -= 2 * Math.PI;
  } else {
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
  }

  // Each sub-arc has half the central angle, so same bulge ratio
  return { 
    bulge1: bulge, 
    bulge2: bulge, 
    midPoint 
  };
}
