/**
 * Wall Geometry Utilities
 * 
 * Centralized functions for wall length, area, and angle calculations.
 * Single source of truth - other files should import from here.
 */

import type { Point2D, FloorPlanPoint } from '@/types/geometry';
import type { Wall } from '@/types/floorPlan';

// =============================================================================
// POINT LOOKUP
// =============================================================================

/**
 * Get a point by ID from the points array
 */
export function getPointById(points: FloorPlanPoint[], id: string): FloorPlanPoint | undefined {
  return points.find(p => p.id === id);
}

/**
 * Get wall start point
 */
export function getWallStartPoint(wall: Wall, points: FloorPlanPoint[]): FloorPlanPoint | undefined {
  return getPointById(points, wall.startPointId);
}

/**
 * Get wall end point
 */
export function getWallEndPoint(wall: Wall, points: FloorPlanPoint[]): FloorPlanPoint | undefined {
  return getPointById(points, wall.endPointId);
}

// =============================================================================
// LENGTH CALCULATIONS
// =============================================================================

/**
 * Calculate the straight-line distance between two points
 */
export function distanceBetweenPoints(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate wall length (handles both straight and curved walls)
 * 
 * @param wall - The wall to measure
 * @param points - Array of floor plan points
 * @returns Length in centimeters
 */
export function calculateWallLength(wall: Wall, points: FloorPlanPoint[]): number {
  const startPoint = getWallStartPoint(wall, points);
  const endPoint = getWallEndPoint(wall, points);
  
  if (!startPoint || !endPoint) {
    console.warn('Wall points not found:', wall.id);
    return 0;
  }
  
  const chordLength = distanceBetweenPoints(startPoint, endPoint);
  
  // For straight walls or no bulge
  if (!wall.isCurved || !wall.bulge || wall.bulge === 0) {
    return chordLength;
  }
  
  // For curved walls, calculate arc length
  return calculateArcLength(chordLength, wall.bulge);
}

/**
 * Calculate arc length given chord length and bulge factor
 * 
 * @param chordLength - Straight-line distance between endpoints
 * @param bulge - Bulge factor (-1 to 1)
 * @returns Arc length
 */
export function calculateArcLength(chordLength: number, bulge: number): number {
  if (bulge === 0) return chordLength;
  
  // Bulge = tan(angle/4), where angle is the central angle
  const angle = 4 * Math.atan(Math.abs(bulge));
  
  // Radius = chord / (2 * sin(angle/2))
  const halfAngle = angle / 2;
  if (Math.sin(halfAngle) === 0) return chordLength;
  
  const radius = chordLength / (2 * Math.sin(halfAngle));
  
  // Arc length = radius * angle
  return radius * angle;
}

/**
 * Calculate the radius of a curved wall
 */
export function calculateCurveRadius(chordLength: number, bulge: number): number {
  if (bulge === 0) return Infinity;
  
  const angle = 4 * Math.atan(Math.abs(bulge));
  const halfAngle = angle / 2;
  
  if (Math.sin(halfAngle) === 0) return Infinity;
  
  return chordLength / (2 * Math.sin(halfAngle));
}

// =============================================================================
// ANGLE CALCULATIONS
// =============================================================================

/**
 * Calculate the angle of a wall in radians
 * 
 * @param wall - The wall
 * @param points - Array of floor plan points
 * @returns Angle in radians (0 = pointing right, counter-clockwise positive)
 */
export function calculateWallAngle(wall: Wall, points: FloorPlanPoint[]): number {
  const startPoint = getWallStartPoint(wall, points);
  const endPoint = getWallEndPoint(wall, points);
  
  if (!startPoint || !endPoint) return 0;
  
  return Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
}

/**
 * Calculate the angle of a wall in degrees
 */
export function calculateWallAngleDegrees(wall: Wall, points: FloorPlanPoint[]): number {
  return (calculateWallAngle(wall, points) * 180) / Math.PI;
}

/**
 * Get the perpendicular angle (normal) to a wall
 */
export function calculateWallNormal(wall: Wall, points: FloorPlanPoint[]): number {
  return calculateWallAngle(wall, points) + Math.PI / 2;
}

// =============================================================================
// AREA CALCULATIONS
// =============================================================================

/**
 * Calculate the area of a wall face (one side)
 * 
 * @param wall - The wall
 * @param points - Array of floor plan points
 * @returns Area in square centimeters
 */
export function calculateWallArea(wall: Wall, points: FloorPlanPoint[]): number {
  const length = calculateWallLength(wall, points);
  
  // For sloped walls, use average height
  const startHeight = wall.startHeight ?? wall.height;
  const endHeight = wall.endHeight ?? wall.height;
  const averageHeight = (startHeight + endHeight) / 2;
  
  return length * averageHeight;
}

/**
 * Calculate total wall area minus openings (doors, windows)
 */
export function calculateNetWallArea(
  wall: Wall,
  points: FloorPlanPoint[],
  doorAreas: number[],
  windowAreas: number[]
): number {
  const grossArea = calculateWallArea(wall, points);
  const totalOpenings = [...doorAreas, ...windowAreas].reduce((sum, area) => sum + area, 0);
  return Math.max(0, grossArea - totalOpenings);
}

// =============================================================================
// MIDPOINT & POSITION CALCULATIONS
// =============================================================================

/**
 * Get the midpoint of a wall (for straight walls)
 */
export function calculateWallMidpoint(wall: Wall, points: FloorPlanPoint[]): Point2D | null {
  const startPoint = getWallStartPoint(wall, points);
  const endPoint = getWallEndPoint(wall, points);
  
  if (!startPoint || !endPoint) return null;
  
  return {
    x: (startPoint.x + endPoint.x) / 2,
    y: (startPoint.y + endPoint.y) / 2,
  };
}

/**
 * Get a point along the wall at a given position (0-1)
 * Handles curved walls correctly
 */
export function getPointAlongWall(
  wall: Wall,
  points: FloorPlanPoint[],
  position: number // 0-1
): Point2D | null {
  const startPoint = getWallStartPoint(wall, points);
  const endPoint = getWallEndPoint(wall, points);
  
  if (!startPoint || !endPoint) return null;
  
  // Clamp position
  const t = Math.max(0, Math.min(1, position));
  
  // For straight walls, simple linear interpolation
  if (!wall.isCurved || !wall.bulge || wall.bulge === 0) {
    return {
      x: startPoint.x + (endPoint.x - startPoint.x) * t,
      y: startPoint.y + (endPoint.y - startPoint.y) * t,
    };
  }
  
  // For curved walls, calculate point on arc
  const chordLength = distanceBetweenPoints(startPoint, endPoint);
  const angle = 4 * Math.atan(Math.abs(wall.bulge));
  const halfAngle = angle / 2;
  const radius = chordLength / (2 * Math.sin(halfAngle));
  
  // Find center of the arc
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;
  
  const chordAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
  const perpAngle = chordAngle + (wall.bulge > 0 ? -Math.PI / 2 : Math.PI / 2);
  
  const sagitta = radius * (1 - Math.cos(halfAngle));
  const centerDist = radius - sagitta;
  
  const centerX = midX + Math.cos(perpAngle) * centerDist;
  const centerY = midY + Math.sin(perpAngle) * centerDist;
  
  // Calculate point on arc
  const startAngleFromCenter = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
  const sweepAngle = wall.bulge > 0 ? angle : -angle;
  const pointAngle = startAngleFromCenter + sweepAngle * t;
  
  return {
    x: centerX + Math.cos(pointAngle) * radius,
    y: centerY + Math.sin(pointAngle) * radius,
  };
}

// =============================================================================
// HEIGHT CALCULATIONS
// =============================================================================

/**
 * Get wall height at a specific position along the wall (0-1)
 * Handles sloped walls
 */
export function getWallHeightAtPosition(wall: Wall, position: number): number {
  const t = Math.max(0, Math.min(1, position));
  
  const startHeight = wall.startHeight ?? wall.height;
  const endHeight = wall.endHeight ?? wall.height;
  
  return startHeight + (endHeight - startHeight) * t;
}

/**
 * Check if a wall is sloped (has different heights at endpoints)
 */
export function isWallSloped(wall: Wall): boolean {
  const startHeight = wall.startHeight ?? wall.height;
  const endHeight = wall.endHeight ?? wall.height;
  return Math.abs(startHeight - endHeight) > 0.1; // 1mm tolerance
}
