/**
 * Unified Collision Detection
 * 
 * Centralized collision and overlap detection for all placeable objects.
 * Single source of truth for fixture, furniture, and clearance zone checks.
 */

import type { Point2D, Dimensions, SimpleClearance, BoundingBox2D, FloorPlanPoint } from '@/types/geometry';
import { calculateBoundingBox, degreesToRadians } from './dimensions';
import { calculateWallLength, getWallStartPoint, getWallEndPoint } from './wallGeometry';
import type { Wall } from '@/types/floorPlan';

// =============================================================================
// BOUNDING BOX COLLISION
// =============================================================================

/**
 * Check if two axis-aligned bounding boxes overlap
 */
export function checkAABBOverlap(a: BoundingBox2D, b: BoundingBox2D): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Check if a point is inside a bounding box
 */
export function pointInAABB(point: Point2D, box: BoundingBox2D): boolean {
  return point.x >= box.minX && point.x <= box.maxX && 
         point.y >= box.minY && point.y <= box.maxY;
}

// =============================================================================
// ORIENTED RECTANGLE COLLISION
// =============================================================================

/**
 * Oriented rectangle for collision checks
 */
export interface OrientedRect {
  center: Point2D;
  halfExtents: Point2D;  // Half width and half depth
  rotation: number;      // Radians
}

/**
 * Create oriented rectangle from center, dimensions, and rotation
 */
export function createOrientedRect(
  center: Point2D,
  dims: Dimensions,
  rotationDegrees: number
): OrientedRect {
  return {
    center,
    halfExtents: { x: dims.width / 2, y: dims.depth / 2 },
    rotation: degreesToRadians(rotationDegrees),
  };
}

/**
 * Check if two oriented rectangles overlap using SAT (Separating Axis Theorem)
 */
export function checkOrientedRectOverlap(a: OrientedRect, b: OrientedRect): boolean {
  // Get axes to test (normals of both rectangles' edges)
  const axes = [
    { x: Math.cos(a.rotation), y: Math.sin(a.rotation) },
    { x: -Math.sin(a.rotation), y: Math.cos(a.rotation) },
    { x: Math.cos(b.rotation), y: Math.sin(b.rotation) },
    { x: -Math.sin(b.rotation), y: Math.cos(b.rotation) },
  ];

  const getCorners = (rect: OrientedRect): Point2D[] => {
    const cos = Math.cos(rect.rotation);
    const sin = Math.sin(rect.rotation);
    const hw = rect.halfExtents.x;
    const hh = rect.halfExtents.y;
    
    return [
      { x: rect.center.x + hw * cos - hh * sin, y: rect.center.y + hw * sin + hh * cos },
      { x: rect.center.x - hw * cos - hh * sin, y: rect.center.y - hw * sin + hh * cos },
      { x: rect.center.x - hw * cos + hh * sin, y: rect.center.y - hw * sin - hh * cos },
      { x: rect.center.x + hw * cos + hh * sin, y: rect.center.y + hw * sin - hh * cos },
    ];
  };

  const cornersA = getCorners(a);
  const cornersB = getCorners(b);

  const project = (corners: Point2D[], axis: Point2D): { min: number; max: number } => {
    const dots = corners.map(c => c.x * axis.x + c.y * axis.y);
    return { min: Math.min(...dots), max: Math.max(...dots) };
  };

  for (const axis of axes) {
    const projA = project(cornersA, axis);
    const projB = project(cornersB, axis);
    
    if (projA.max < projB.min || projB.max < projA.min) {
      return false; // Separating axis found
    }
  }

  return true; // No separating axis found, rectangles overlap
}

// =============================================================================
// PLACEABLE OBJECT COLLISION
// =============================================================================

/**
 * Standard interface for placeable objects (fixtures, furniture)
 */
export interface PlaceableObject {
  id: string;
  position: Point2D;
  dimensions: Dimensions;
  rotation: number;  // Degrees
}

/**
 * Check if two placeable objects collide
 */
export function checkPlaceableCollision(a: PlaceableObject, b: PlaceableObject): boolean {
  const rectA = createOrientedRect(a.position, a.dimensions, a.rotation);
  const rectB = createOrientedRect(b.position, b.dimensions, b.rotation);
  return checkOrientedRectOverlap(rectA, rectB);
}

/**
 * Check if a new position would cause a collision with existing objects
 */
export function wouldCollide(
  newObject: PlaceableObject,
  existingObjects: PlaceableObject[]
): boolean {
  return existingObjects.some(
    existing => existing.id !== newObject.id && checkPlaceableCollision(newObject, existing)
  );
}

// =============================================================================
// CLEARANCE ZONE CHECKS
// =============================================================================

/**
 * Create a clearance bounding box around an object
 */
export function createClearanceBoundingBox(
  object: PlaceableObject,
  clearance: SimpleClearance
): BoundingBox2D {
  const baseBB = calculateBoundingBox(object.position, object.dimensions, object.rotation);
  
  // For now, use simple expansion (doesn't account for rotation direction)
  // A more accurate version would project clearance zones based on rotation
  const maxClearance = Math.max(clearance.front, clearance.sides, clearance.rear);
  
  return {
    minX: baseBB.minX - maxClearance,
    minY: baseBB.minY - maxClearance,
    maxX: baseBB.maxX + maxClearance,
    maxY: baseBB.maxY + maxClearance,
  };
}

/**
 * Check if clearance zones of two objects overlap
 */
export function checkClearanceOverlap(
  objectA: PlaceableObject,
  clearanceA: SimpleClearance,
  objectB: PlaceableObject,
  clearanceB: SimpleClearance
): boolean {
  const bbA = createClearanceBoundingBox(objectA, clearanceA);
  const bbB = createClearanceBoundingBox(objectB, clearanceB);
  return checkAABBOverlap(bbA, bbB);
}

// =============================================================================
// WALL PROXIMITY CHECKS
// =============================================================================

/**
 * Calculate distance from a point to a line segment
 */
export function distanceToLineSegment(
  point: Point2D,
  segStart: Point2D,
  segEnd: Point2D
): number {
  const dx = segEnd.x - segStart.x;
  const dy = segEnd.y - segStart.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    // Segment is a point
    return Math.sqrt(
      (point.x - segStart.x) ** 2 + (point.y - segStart.y) ** 2
    );
  }
  
  // Project point onto line, clamped to segment
  let t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  const projX = segStart.x + t * dx;
  const projY = segStart.y + t * dy;
  
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Find the nearest wall to a point
 */
export function findNearestWall(
  point: Point2D,
  walls: Wall[],
  points: FloorPlanPoint[]
): { wall: Wall; distance: number } | null {
  let nearest: { wall: Wall; distance: number } | null = null;
  
  for (const wall of walls) {
    const startPoint = getWallStartPoint(wall, points);
    const endPoint = getWallEndPoint(wall, points);
    
    if (!startPoint || !endPoint) continue;
    
    const distance = distanceToLineSegment(point, startPoint, endPoint);
    
    if (!nearest || distance < nearest.distance) {
      nearest = { wall, distance };
    }
  }
  
  return nearest;
}

/**
 * Check if a point is within a certain distance of any wall
 */
export function isNearWall(
  point: Point2D,
  walls: Wall[],
  points: FloorPlanPoint[],
  maxDistance: number
): boolean {
  const nearest = findNearestWall(point, walls, points);
  return nearest !== null && nearest.distance <= maxDistance;
}

/**
 * Get the position on a wall that is closest to a given point
 */
export function getClosestPointOnWall(
  point: Point2D,
  wall: Wall,
  points: FloorPlanPoint[]
): Point2D | null {
  const startPoint = getWallStartPoint(wall, points);
  const endPoint = getWallEndPoint(wall, points);
  
  if (!startPoint || !endPoint) return null;
  
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) return { ...startPoint };
  
  let t = ((point.x - startPoint.x) * dx + (point.y - startPoint.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  
  return {
    x: startPoint.x + t * dx,
    y: startPoint.y + t * dy,
  };
}

// =============================================================================
// ROOM BOUNDARY CHECKS
// =============================================================================

/**
 * Check if a point is inside a polygon defined by walls
 * Uses ray casting algorithm
 */
export function isPointInRoom(
  point: Point2D,
  walls: Wall[],
  points: FloorPlanPoint[]
): boolean {
  // Build polygon from walls
  const polygon: Point2D[] = [];
  
  for (const wall of walls) {
    const startPoint = getWallStartPoint(wall, points);
    if (startPoint && !polygon.some(p => p.x === startPoint.x && p.y === startPoint.y)) {
      polygon.push(startPoint);
    }
  }
  
  if (polygon.length < 3) return false;
  
  // Ray casting
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Check if an object (with dimensions) is fully inside the room
 */
export function isObjectInRoom(
  object: PlaceableObject,
  walls: Wall[],
  points: FloorPlanPoint[]
): boolean {
  const bb = calculateBoundingBox(object.position, object.dimensions, object.rotation);
  
  // Check all four corners
  const corners: Point2D[] = [
    { x: bb.minX, y: bb.minY },
    { x: bb.maxX, y: bb.minY },
    { x: bb.maxX, y: bb.maxY },
    { x: bb.minX, y: bb.maxY },
  ];
  
  return corners.every(corner => isPointInRoom(corner, walls, points));
}
