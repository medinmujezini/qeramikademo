/**
 * Fixture Collision Detection Utilities
 * 
 * Provides collision detection for fixtures using centralized utilities.
 * Works with unified fixture types.
 */

import type { UnifiedFixture } from '@/types/fixture';
import type { Point2D, Dimensions, FloorPlanPoint } from '@/types/geometry';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import { 
  createOrientedRect, 
  checkOrientedRectOverlap, 
  checkAABBOverlap,
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
 * Convert UnifiedFixture to PlaceableObject for collision checking
 */
function fixtureToPlaceable(fixture: UnifiedFixture): PlaceableObject {
  return {
    id: fixture.id,
    position: fixture.position,
    dimensions: fixture.dimensions,
    rotation: fixture.rotation,
  };
}

/**
 * Convert FurnitureItem to PlaceableObject for collision checking
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
 * Get the rotated corners of a fixture (in cm)
 */
export function getFixtureCorners(fixture: UnifiedFixture): Point[] {
  const { width, depth } = fixture.dimensions;
  const halfW = width / 2;
  const halfD = depth / 2;
  const rad = (fixture.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localCorners = [
    { x: -halfW, y: -halfD },
    { x: halfW, y: -halfD },
    { x: halfW, y: halfD },
    { x: -halfW, y: halfD },
  ];

  return localCorners.map(c => ({
    x: fixture.position.x + c.x * cos - c.y * sin,
    y: fixture.position.y + c.x * sin + c.y * cos,
  }));
}

/**
 * Get axis-aligned bounding box for quick rejection
 */
export function getFixtureAABB(fixture: UnifiedFixture): { minX: number; maxX: number; minY: number; maxY: number } {
  return calculateBoundingBox(fixture.position, fixture.dimensions, fixture.rotation);
}

// =============================================================================
// FIXTURE-TO-FIXTURE COLLISION
// =============================================================================

/**
 * Check if two fixtures collide using centralized collision detection
 */
export function fixturesCollide(fixture1: UnifiedFixture, fixture2: UnifiedFixture): boolean {
  const rect1 = createOrientedRect(fixture1.position, fixture1.dimensions, fixture1.rotation);
  const rect2 = createOrientedRect(fixture2.position, fixture2.dimensions, fixture2.rotation);
  return checkOrientedRectOverlap(rect1, rect2);
}

// =============================================================================
// FIXTURE-TO-FURNITURE COLLISION
// =============================================================================

/**
 * Check if a fixture collides with a furniture item
 */
export function fixtureCollidesWithFurniture(fixture: UnifiedFixture, furniture: FurnitureItem): boolean {
  const fixtureRect = createOrientedRect(fixture.position, fixture.dimensions, fixture.rotation);
  const furnitureRect = createOrientedRect(furniture.position, furniture.dimensions, furniture.rotation);
  return checkOrientedRectOverlap(fixtureRect, furnitureRect);
}

// =============================================================================
// FIXTURE-TO-WALL COLLISION
// =============================================================================

/**
 * Get wall polygon with thickness
 */
function getWallPolygon(start: FloorPlanPoint, end: FloorPlanPoint, thickness: number): Point[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [];

  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);

  return [
    { x: start.x + nx, y: start.y + ny },
    { x: end.x + nx, y: end.y + ny },
    { x: end.x - nx, y: end.y - ny },
    { x: start.x - nx, y: start.y - ny },
  ];
}

/**
 * SAT polygon collision check
 */
function polygonsCollide(corners1: Point[], corners2: Point[]): boolean {
  const getAxes = (corners: Point[]): Point[] => {
    const axes: Point[] = [];
    for (let i = 0; i < corners.length; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % corners.length];
      const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
      const normal = { x: -edge.y, y: edge.x };
      const len = Math.sqrt(normal.x ** 2 + normal.y ** 2);
      if (len > 0) {
        axes.push({ x: normal.x / len, y: normal.y / len });
      }
    }
    return axes;
  };

  const projectPolygon = (corners: Point[], axis: Point): { min: number; max: number } => {
    let min = Infinity;
    let max = -Infinity;
    for (const c of corners) {
      const proj = c.x * axis.x + c.y * axis.y;
      min = Math.min(min, proj);
      max = Math.max(max, proj);
    }
    return { min, max };
  };

  const overlaps = (p1: { min: number; max: number }, p2: { min: number; max: number }): boolean => {
    return !(p1.max < p2.min || p2.max < p1.min);
  };

  const axes = [...getAxes(corners1), ...getAxes(corners2)];
  for (const axis of axes) {
    const proj1 = projectPolygon(corners1, axis);
    const proj2 = projectPolygon(corners2, axis);
    if (!overlaps(proj1, proj2)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a fixture collides with a wall
 */
export function fixtureCollidesWithWall(
  fixture: UnifiedFixture,
  wall: Wall,
  points: FloorPlanPoint[]
): boolean {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return false;

  const wallPolygon = getWallPolygon(start, end, wall.thickness);
  if (wallPolygon.length === 0) return false;

  const fixtureCorners = getFixtureCorners(fixture);
  return polygonsCollide(fixtureCorners, wallPolygon);
}

// =============================================================================
// COMPREHENSIVE VALIDATION
// =============================================================================

export interface FixtureCollisionResult {
  valid: boolean;
  collidingWith: string[];
}

/**
 * Check if a fixture position is valid (no collisions)
 */
export function isFixturePositionValid(
  fixture: UnifiedFixture,
  otherFixtures: UnifiedFixture[],
  furniture: FurnitureItem[],
  walls: Wall[],
  points: FloorPlanPoint[]
): FixtureCollisionResult {
  const collidingWith: string[] = [];

  // Check against other fixtures
  for (const other of otherFixtures) {
    if (other.id === fixture.id) continue;
    if (fixturesCollide(fixture, other)) {
      collidingWith.push(`fixture:${other.id}`);
    }
  }

  // Check against furniture
  for (const item of furniture) {
    if (fixtureCollidesWithFurniture(fixture, item)) {
      collidingWith.push(`furniture:${item.id}`);
    }
  }

  // Check against walls
  for (const wall of walls) {
    if (fixtureCollidesWithWall(fixture, wall, points)) {
      collidingWith.push(`wall:${wall.id}`);
    }
  }

  return {
    valid: collidingWith.length === 0,
    collidingWith,
  };
}

/**
 * Find a valid position for a fixture by searching in a spiral pattern
 */
export function findValidFixturePosition(
  fixture: UnifiedFixture,
  targetPosition: Point2D,
  otherFixtures: UnifiedFixture[],
  furniture: FurnitureItem[],
  walls: Wall[],
  points: FloorPlanPoint[],
  maxAttempts: number = 16
): Point2D {
  const testFixture = { ...fixture, position: targetPosition };
  
  const result = isFixturePositionValid(testFixture, otherFixtures, furniture, walls, points);
  if (result.valid) {
    return targetPosition;
  }

  // Try pushing in different directions
  const pushDistance = 20; // cm
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = (attempt / maxAttempts) * Math.PI * 2;
    const offset = {
      x: Math.cos(angle) * pushDistance * (1 + attempt / maxAttempts),
      y: Math.sin(angle) * pushDistance * (1 + attempt / maxAttempts),
    };

    const tryPosition = {
      x: targetPosition.x + offset.x,
      y: targetPosition.y + offset.y,
    };

    const tryFixture = { ...fixture, position: tryPosition };
    const tryResult = isFixturePositionValid(tryFixture, otherFixtures, furniture, walls, points);
    
    if (tryResult.valid) {
      return tryPosition;
    }
  }

  // Return original position if no valid position found
  return fixture.position;
}

// =============================================================================
// LEGACY TYPE ALIASES
// =============================================================================

/**
 * @deprecated Use UnifiedFixture from @/types/fixture instead
 */
export type MEPFixture = UnifiedFixture;
