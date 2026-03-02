/**
 * Furniture Collision Detection Utilities
 * 
 * Handles collision detection between furniture items and walls.
 * Uses centralized collision utilities for consistency.
 */

import type { FurnitureItem } from '@/data/furnitureLibrary';
import type { Point2D, FloorPlanPoint } from '@/types/geometry';
import { 
  createOrientedRect, 
  checkOrientedRectOverlap,
  type PlaceableObject 
} from '@/utils/collision';
import { calculateBoundingBox } from '@/utils/dimensions';

interface Point {
  x: number;
  y: number;
}

interface Wall {
  id: string;
  startPointId: string;
  endPointId: string;
  thickness: number;
}

// =============================================================================
// CONVERSION HELPERS
// =============================================================================

/**
 * Convert FurnitureItem to PlaceableObject
 */
function furnitureToPlaceable(item: FurnitureItem): PlaceableObject {
  return {
    id: item.id,
    position: item.position,
    dimensions: item.dimensions,
    rotation: item.rotation,
  };
}

// =============================================================================
// GEOMETRY HELPERS
// =============================================================================

/**
 * Get the rotated bounding box corners of a furniture item
 */
export function getFurnitureCorners(item: FurnitureItem): Point[] {
  const { position, dimensions, rotation } = item;
  const halfWidth = dimensions.width / 2;
  const halfDepth = dimensions.depth / 2;
  
  // Local corners (before rotation)
  const localCorners: Point[] = [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ];
  
  // Rotate and translate to world coordinates
  const radians = -rotation * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  return localCorners.map(corner => ({
    x: position.x + corner.x * cos - corner.y * sin,
    y: position.y + corner.x * sin + corner.y * cos,
  }));
}

/**
 * Get axis-aligned bounding box for a furniture item (for quick rejection)
 */
export function getFurnitureAABB(item: FurnitureItem): { minX: number; maxX: number; minY: number; maxY: number } {
  return calculateBoundingBox(item.position, item.dimensions, item.rotation);
}

// =============================================================================
// FURNITURE-TO-FURNITURE COLLISION
// =============================================================================

/**
 * Check if two furniture items collide using centralized collision detection
 */
export function furnitureCollides(item1: FurnitureItem, item2: FurnitureItem): boolean {
  const rect1 = createOrientedRect(item1.position, item1.dimensions, item1.rotation);
  const rect2 = createOrientedRect(item2.position, item2.dimensions, item2.rotation);
  return checkOrientedRectOverlap(rect1, rect2);
}

// =============================================================================
// FURNITURE-TO-WALL COLLISION
// =============================================================================

/**
 * Get wall as a polygon (rectangle with thickness)
 */
function getWallPolygon(
  start: FloorPlanPoint,
  end: FloorPlanPoint,
  thickness: number
): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return [];
  
  // Perpendicular unit vector
  const perpX = -dy / length;
  const perpY = dx / length;
  
  const halfThick = thickness / 2;
  
  return [
    { x: start.x + perpX * halfThick, y: start.y + perpY * halfThick },
    { x: end.x + perpX * halfThick, y: end.y + perpY * halfThick },
    { x: end.x - perpX * halfThick, y: end.y - perpY * halfThick },
    { x: start.x - perpX * halfThick, y: start.y - perpY * halfThick },
  ];
}

/**
 * SAT polygon collision check
 */
function polygonsCollide(poly1: Point[], poly2: Point[]): boolean {
  const polygons = [poly1, poly2];
  
  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      
      // Get perpendicular axis
      const edge = {
        x: polygon[j].x - polygon[i].x,
        y: polygon[j].y - polygon[i].y,
      };
      const axis = { x: -edge.y, y: edge.x };
      
      // Project both polygons onto axis
      let min1 = Infinity, max1 = -Infinity;
      let min2 = Infinity, max2 = -Infinity;
      
      for (const p of poly1) {
        const proj = p.x * axis.x + p.y * axis.y;
        min1 = Math.min(min1, proj);
        max1 = Math.max(max1, proj);
      }
      
      for (const p of poly2) {
        const proj = p.x * axis.x + p.y * axis.y;
        min2 = Math.min(min2, proj);
        max2 = Math.max(max2, proj);
      }
      
      // Check for gap
      if (max1 < min2 || max2 < min1) {
        return false; // Separating axis found
      }
    }
  }
  
  return true; // No separating axis found
}

/**
 * Check if furniture collides with a wall
 */
export function furnitureCollidesWithWall(
  item: FurnitureItem,
  wall: Wall,
  points: FloorPlanPoint[]
): boolean {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  
  if (!start || !end) return false;
  
  const wallPolygon = getWallPolygon(start, end, wall.thickness);
  if (wallPolygon.length === 0) return false;
  
  const furnitureCorners = getFurnitureCorners(item);
  
  return polygonsCollide(furnitureCorners, wallPolygon);
}

// =============================================================================
// COMPREHENSIVE VALIDATION
// =============================================================================

/**
 * Check if a furniture position is valid (no collisions)
 */
export function isPositionValid(
  item: FurnitureItem,
  otherFurniture: FurnitureItem[],
  walls: Wall[],
  points: FloorPlanPoint[]
): { valid: boolean; collidingWith: string[] } {
  const collidingWith: string[] = [];
  
  // Check furniture-furniture collisions
  for (const other of otherFurniture) {
    if (other.id === item.id) continue;
    
    if (furnitureCollides(item, other)) {
      collidingWith.push(`furniture:${other.id}`);
    }
  }
  
  // Check furniture-wall collisions
  for (const wall of walls) {
    if (furnitureCollidesWithWall(item, wall, points)) {
      collidingWith.push(`wall:${wall.id}`);
    }
  }
  
  return {
    valid: collidingWith.length === 0,
    collidingWith,
  };
}

/**
 * Find a valid position using a robust spiral search pattern.
 * Tests positions in concentric rings around the target position.
 */
export function findValidPositionSpiral(
  item: FurnitureItem,
  targetPosition: Point2D,
  otherFurniture: FurnitureItem[],
  walls: Wall[],
  points: FloorPlanPoint[],
  gridSize: number = 10,
  maxRadius: number = 500
): Point2D | null {
  // Try the target position first
  const testItem = { ...item, position: targetPosition };
  if (isPositionValid(testItem, otherFurniture, walls, points).valid) {
    return targetPosition;
  }
  
  // Spiral search: test rings of increasing radius
  const directionsPerRing = 16;
  
  for (let radius = gridSize; radius <= maxRadius; radius += gridSize) {
    for (let i = 0; i < directionsPerRing; i++) {
      const angle = (i / directionsPerRing) * 2 * Math.PI;
      const testPos = {
        x: Math.round((targetPosition.x + Math.cos(angle) * radius) / gridSize) * gridSize,
        y: Math.round((targetPosition.y + Math.sin(angle) * radius) / gridSize) * gridSize,
      };
      
      const testItem2 = { ...item, position: testPos };
      if (isPositionValid(testItem2, otherFurniture, walls, points).valid) {
        return testPos;
      }
    }
  }
  
  return null;
}

/**
 * Legacy function for backwards compatibility.
 */
export function findValidPosition(
  item: FurnitureItem,
  targetPosition: Point2D,
  otherFurniture: FurnitureItem[],
  walls: Wall[],
  points: FloorPlanPoint[],
  maxAttempts: number = 8
): Point2D {
  const result = findValidPositionSpiral(item, targetPosition, otherFurniture, walls, points);
  return result ?? item.position;
}
