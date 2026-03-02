/**
 * Stack-Centric MEP Routing Engine
 * 
 * Routes fixtures to vertical drain/vent stacks with short horizontal branches.
 * Implements gravity-based drainage routing with proper 3D elevation modeling.
 * 
 * Enhanced Features:
 * - Structural obstruction avoidance (columns, beams)
 * - Under-slab routing for slab-on-grade construction
 * - Slab penetration tracking
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  MEPFixture,
  MEPRoute,
  MEPSegment,
  MEPNode,
  MEPSystemType,
  PlumbingSystemType,
  Point2D,
  Point3D,
  FittingType,
  StructuralObstruction,
  FloorConfiguration,
  SlabPenetration,
} from '@/types/mep';
import { 
  SYSTEM_PRIORITY, 
  SYSTEM_COLORS, 
  DEFAULT_PIPE_MATERIALS,
  DEFAULT_FLOOR_CONFIG,
} from '@/types/mep';
import { getConnectionWorldPosition } from '@/data/fixtureLibrary';
import { getDrainPipeSize, getVentPipeSize, getWaterPipeSize, getMinSlope } from '@/data/plumbingCodes';
import type { Column } from '@/types/floorPlan';

// =============================================================================
// CONSTANTS
// =============================================================================

// Maximum horizontal branch lengths per code (in cm)
const MAX_BRANCH_LENGTHS: Record<string, number> = {
  'toilet': 180,        // 6 feet max for toilet
  'sink': 240,          // 8 feet for other fixtures
  'default': 240,
};

// Fixture trap heights (cm from floor)
const FIXTURE_DRAIN_HEIGHTS: Record<string, number> = {
  'toilet': 30,         // Floor-mounted
  'sink': 70,           // Standard vanity
  'kitchen-sink': 85,   // Kitchen counter height
  'shower': 15,         // Floor level
  'bathtub': 25,        // Low
  'floor-drain': 5,     // At floor
  'washing-machine': 90,
  'utility-sink': 80,
  'dishwasher': 15,
  'default': 50,
};

// Vent connection heights (must be 6" above flood rim)
const VENT_OFFSET_ABOVE_FIXTURE = 20; // cm above fixture drain

// Obstruction avoidance buffer (cm)
const OBSTRUCTION_BUFFER = 15;

// =============================================================================
// TYPES
// =============================================================================

interface Point3DPath extends Point2D {
  z: number;
}

interface StackRoutingContext {
  fixtures: MEPFixture[];
  nodes: MEPNode[];
  existingRoutes: MEPRoute[];
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface StackRoutingConfig {
  canvasWidth: number;
  canvasHeight: number;
  walls: WallSegment[];
  floorHeight?: number;        // Default floor height (cm)
  ceilingHeight?: number;      // Default ceiling height (cm)
  preferWallFollowing?: boolean; // Route along walls when possible
  
  // NEW: Structural obstruction support
  columns?: Column[];          // Structural columns from floor plan
  obstructions?: StructuralObstruction[];  // Additional obstructions
  
  // NEW: Floor construction for under-slab routing
  floorConfig?: FloorConfiguration;
}

export interface StackRoutingResult {
  routes: MEPRoute[];
  successCount: number;
  failureCount: number;
  messages: string[];
  
  // NEW: Track slab penetrations
  slabPenetrations?: SlabPenetration[];
}

// =============================================================================
// STRUCTURAL OBSTRUCTION UTILITIES
// =============================================================================

/**
 * Convert floor plan columns to structural obstructions
 */
export function columnsToObstructions(columns: Column[]): StructuralObstruction[] {
  return columns
    .filter(col => col.isStructural)
    .map(col => ({
      id: col.id,
      type: 'structural-column' as const,
      geometry: {
        type: (col.shape === 'round' ? 'circle' : 'rectangle') as 'circle' | 'rectangle',
        center: { x: col.x, y: col.y },
        radius: col.shape === 'round' ? col.width / 2 : undefined,
        width: col.width,
        depth: col.depth,
        rotation: col.rotation,
      },
      zRange: { bottom: 0, top: col.height },
      bufferDistance: OBSTRUCTION_BUFFER,
      allowsPenetration: false, // Structural columns = NO penetration
    }));
}

/**
 * Check if a line segment intersects a circle (with buffer)
 */
function lineIntersectsCircle(
  p1: Point2D, 
  p2: Point2D, 
  center: Point2D, 
  radius: number
): boolean {
  // Vector from p1 to p2
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  
  // Vector from p1 to circle center
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;
  
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  
  const discriminant = b * b - 4 * a * c;
  
  if (discriminant < 0) return false;
  
  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / (2 * a);
  const t2 = (-b + sqrtD) / (2 * a);
  
  // Check if intersection is within segment
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

/**
 * Check if a line segment intersects a rotated rectangle (with buffer)
 */
function lineIntersectsRotatedRect(
  p1: Point2D,
  p2: Point2D,
  center: Point2D,
  width: number,
  depth: number,
  rotation: number,
  buffer: number
): boolean {
  // Add buffer to dimensions
  const halfW = (width + buffer * 2) / 2;
  const halfD = (depth + buffer * 2) / 2;
  
  // Transform points to rectangle's local coordinate system
  const rad = -rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Transform segment endpoints to local coords
  const localP1 = {
    x: cos * (p1.x - center.x) - sin * (p1.y - center.y),
    y: sin * (p1.x - center.x) + cos * (p1.y - center.y),
  };
  const localP2 = {
    x: cos * (p2.x - center.x) - sin * (p2.y - center.y),
    y: sin * (p2.x - center.x) + cos * (p2.y - center.y),
  };
  
  // Now check line-AABB intersection in local coords
  return lineIntersectsAABB(localP1, localP2, -halfW, -halfD, halfW, halfD);
}

/**
 * Line-AABB intersection test (Cohen-Sutherland inspired)
 */
function lineIntersectsAABB(
  p1: Point2D,
  p2: Point2D,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  // Check if either endpoint is inside
  if (p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY) return true;
  if (p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY) return true;
  
  // Check line-edge intersections
  const edges = [
    { a: { x: minX, y: minY }, b: { x: maxX, y: minY } }, // Bottom
    { a: { x: maxX, y: minY }, b: { x: maxX, y: maxY } }, // Right
    { a: { x: maxX, y: maxY }, b: { x: minX, y: maxY } }, // Top
    { a: { x: minX, y: maxY }, b: { x: minX, y: minY } }, // Left
  ];
  
  for (const edge of edges) {
    if (segmentsIntersect(p1, p2, edge.a, edge.b)) return true;
  }
  
  return false;
}

/**
 * Check if two line segments intersect
 */
function segmentsIntersect(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  
  return false;
}

function direction(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

function onSegment(p1: Point2D, p2: Point2D, p3: Point2D): boolean {
  return p3.x >= Math.min(p1.x, p2.x) && p3.x <= Math.max(p1.x, p2.x) &&
         p3.y >= Math.min(p1.y, p2.y) && p3.y <= Math.max(p1.y, p2.y);
}

/**
 * Check if a path segment intersects any obstruction
 */
function pathIntersectsObstruction(
  p1: Point2D,
  p2: Point2D,
  obstructions: StructuralObstruction[],
  z?: number // Optional Z level to check vertical range
): { intersects: boolean; obstruction?: StructuralObstruction } {
  for (const obs of obstructions) {
    // Check Z range if provided
    if (z !== undefined) {
      if (z < obs.zRange.bottom || z > obs.zRange.top) {
        continue; // Path is outside obstruction's vertical range
      }
    }
    
    const buffer = obs.bufferDistance;
    
    if (obs.geometry.type === 'circle' && obs.geometry.center && obs.geometry.radius) {
      if (lineIntersectsCircle(p1, p2, obs.geometry.center, obs.geometry.radius + buffer)) {
        return { intersects: true, obstruction: obs };
      }
    } else if (obs.geometry.type === 'rectangle' && obs.geometry.center) {
      const width = obs.geometry.width || 30;
      const depth = obs.geometry.depth || 30;
      const rotation = obs.geometry.rotation || 0;
      if (lineIntersectsRotatedRect(p1, p2, obs.geometry.center, width, depth, rotation, buffer)) {
        return { intersects: true, obstruction: obs };
      }
    }
  }
  
  return { intersects: false };
}

/**
 * Calculate detour waypoints around an obstruction
 */
function calculateDetourPoints(
  p1: Point2D,
  p2: Point2D,
  obstruction: StructuralObstruction
): Point2D[] {
  const center = obstruction.geometry.center;
  if (!center) return [];
  
  const buffer = obstruction.bufferDistance + 10; // Extra margin
  
  // Determine which side to go around
  // Use cross product to determine if we should go left or right
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const toCenterX = center.x - p1.x;
  const toCenterY = center.y - p1.y;
  const cross = dx * toCenterY - dy * toCenterX;
  
  // Calculate perpendicular direction
  const len = Math.sqrt(dx * dx + dy * dy);
  const perpX = -dy / len;
  const perpY = dx / len;
  
  // Get effective radius
  let radius = buffer;
  if (obstruction.geometry.type === 'circle' && obstruction.geometry.radius) {
    radius = obstruction.geometry.radius + buffer;
  } else if (obstruction.geometry.type === 'rectangle') {
    const w = (obstruction.geometry.width || 30) / 2;
    const d = (obstruction.geometry.depth || 30) / 2;
    radius = Math.sqrt(w * w + d * d) + buffer;
  }
  
  // Create two waypoints on opposite sides of the obstruction
  const sign = cross > 0 ? 1 : -1;
  
  return [
    {
      x: center.x + perpX * radius * sign,
      y: center.y + perpY * radius * sign,
    },
  ];
}

/**
 * Route a path avoiding obstructions
 */
function avoidObstructions(
  path: Point2D[],
  obstructions: StructuralObstruction[],
  z?: number,
  maxIterations: number = 5
): Point2D[] {
  if (obstructions.length === 0 || path.length < 2) return path;
  
  let currentPath = [...path];
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let modified = false;
    const newPath: Point2D[] = [currentPath[0]];
    
    for (let i = 1; i < currentPath.length; i++) {
      const prev = newPath[newPath.length - 1];
      const next = currentPath[i];
      
      const collision = pathIntersectsObstruction(prev, next, obstructions, z);
      
      if (collision.intersects && collision.obstruction) {
        // Calculate detour points
        const detour = calculateDetourPoints(prev, next, collision.obstruction);
        newPath.push(...detour);
        modified = true;
      }
      
      newPath.push(next);
    }
    
    currentPath = newPath;
    
    // If no modifications, we're done
    if (!modified) break;
  }
  
  // Remove duplicate consecutive points
  const cleanPath: Point2D[] = [currentPath[0]];
  for (let i = 1; i < currentPath.length; i++) {
    const prev = cleanPath[cleanPath.length - 1];
    if (distance2D(prev, currentPath[i]) > 2) {
      cleanPath.push(currentPath[i]);
    }
  }
  
  return cleanPath;
}

// =============================================================================
// WALL-FOLLOWING UTILITIES
// =============================================================================

// Maximum distance from fixture to wall for stub-out (in cm)
const MAX_STUB_LENGTH = 60; // ~2 feet max exposed stub from fixture to wall

/**
 * Find the nearest wall to a point with projection onto wall
 */
function findNearestWall(
  point: Point2D,
  walls: WallSegment[]
): { wall: WallSegment; distance: number; projectedPoint: Point2D; isHorizontal: boolean } | null {
  let nearest: { wall: WallSegment; distance: number; projectedPoint: Point2D; isHorizontal: boolean } | null = null;
  
  for (const wall of walls) {
    const wallVec = { x: wall.x2 - wall.x1, y: wall.y2 - wall.y1 };
    const wallLen = Math.sqrt(wallVec.x ** 2 + wallVec.y ** 2);
    if (wallLen === 0) continue;
    
    // Project point onto wall line
    const t = Math.max(0, Math.min(1, 
      ((point.x - wall.x1) * wallVec.x + (point.y - wall.y1) * wallVec.y) / (wallLen ** 2)
    ));
    
    const projectedPoint = {
      x: wall.x1 + t * wallVec.x,
      y: wall.y1 + t * wallVec.y,
    };
    
    const distance = Math.sqrt(
      (point.x - projectedPoint.x) ** 2 + (point.y - projectedPoint.y) ** 2
    );
    
    // Determine if wall is mostly horizontal or vertical
    const isHorizontal = Math.abs(wallVec.x / wallLen) > 0.7;
    
    if (!nearest || distance < nearest.distance) {
      nearest = { wall, distance, projectedPoint, isHorizontal };
    }
  }
  
  return nearest;
}

/**
 * Find where two walls intersect (corner point)
 */
function findWallIntersection(
  wall1: WallSegment,
  wall2: WallSegment
): Point2D | null {
  const tolerance = 20; // cm - walls considered connected if within this distance
  
  // Check all endpoint combinations
  const points1 = [{ x: wall1.x1, y: wall1.y1 }, { x: wall1.x2, y: wall1.y2 }];
  const points2 = [{ x: wall2.x1, y: wall2.y1 }, { x: wall2.x2, y: wall2.y2 }];
  
  for (const p1 of points1) {
    for (const p2 of points2) {
      const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      if (dist < tolerance) {
        // Return average point
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      }
    }
  }
  
  return null;
}

/**
 * Find the best wall that routes toward the destination
 * Prioritizes walls that:
 * 1. Are close to the fixture (for short stub-out)
 * 2. Run in the general direction of the destination
 */
function findBestWallForRoute(
  start: Point2D,
  end: Point2D,
  walls: WallSegment[]
): { wall: WallSegment; entryPoint: Point2D; isHorizontal: boolean } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const destAngle = Math.atan2(dy, dx);
  
  let bestMatch: { wall: WallSegment; entryPoint: Point2D; isHorizontal: boolean; score: number } | null = null;
  
  for (const wall of walls) {
    const wallVec = { x: wall.x2 - wall.x1, y: wall.y2 - wall.y1 };
    const wallLen = Math.sqrt(wallVec.x ** 2 + wallVec.y ** 2);
    if (wallLen === 0) continue;
    
    // Project start point onto wall
    const t = Math.max(0, Math.min(1, 
      ((start.x - wall.x1) * wallVec.x + (start.y - wall.y1) * wallVec.y) / (wallLen ** 2)
    ));
    
    const projectedPoint = {
      x: wall.x1 + t * wallVec.x,
      y: wall.y1 + t * wallVec.y,
    };
    
    const distToWall = Math.sqrt((start.x - projectedPoint.x) ** 2 + (start.y - projectedPoint.y) ** 2);
    
    // Skip walls that are too far (stub would be too long)
    if (distToWall > MAX_STUB_LENGTH) continue;
    
    // Check if wall runs toward destination
    const wallAngle = Math.atan2(wallVec.y, wallVec.x);
    const angleDiff = Math.abs(Math.atan2(Math.sin(wallAngle - destAngle), Math.cos(wallAngle - destAngle)));
    
    // Score: prefer closer walls that run toward destination
    // Lower score = better
    const distScore = distToWall / MAX_STUB_LENGTH;
    const angleScore = angleDiff / Math.PI;
    const score = distScore + angleScore * 0.5;
    
    const isHorizontal = Math.abs(wallVec.x / wallLen) > 0.7;
    
    if (!bestMatch || score < bestMatch.score) {
      bestMatch = { wall, entryPoint: projectedPoint, isHorizontal, score };
    }
  }
  
  return bestMatch;
}

/**
 * Convert 90° turns to double 45° for drainage systems
 * This is critical for proper drainage flow and code compliance
 * Horizontal drainage turns must use two 45° fittings instead of one 90°
 */
function convertDrainageToDouble45(path: Point2D[]): Point2D[] {
  if (path.length < 3) return path;
  
  const result: Point2D[] = [path[0]];
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];
    
    // Calculate directions
    const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const dir2 = { x: next.x - curr.x, y: next.y - curr.y };
    
    // Normalize
    const mag1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
    const mag2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
    
    if (mag1 > 0 && mag2 > 0) {
      const norm1 = { x: dir1.x / mag1, y: dir1.y / mag1 };
      const norm2 = { x: dir2.x / mag2, y: dir2.y / mag2 };
      
      // Calculate angle between segments
      const dot = norm1.x * norm2.x + norm1.y * norm2.y;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      
      // If it's approximately a 90° turn, split into two 45° turns
      if (angle >= 80 && angle <= 100) {
        // Offset distance for the intermediate section between the two 45° elbows
        const offset = 15;
        
        // Point before the corner (first 45° elbow location)
        const pt1: Point2D = {
          x: curr.x - norm1.x * offset,
          y: curr.y - norm1.y * offset,
        };
        
        // Point after the corner (second 45° elbow location)  
        const pt2: Point2D = {
          x: curr.x + norm2.x * offset,
          y: curr.y + norm2.y * offset,
        };
        
        result.push(pt1);
        result.push(pt2);
      } else {
        result.push(curr);
      }
    } else {
      result.push(curr);
    }
  }
  
  result.push(path[path.length - 1]);
  return result;
}

/**
 * Create wall-centric routing path:
 * 1. Short stub-out from fixture perpendicular to nearest wall
 * 2. Route INSIDE wall cavity toward destination
 * 3. Turn at wall corners as needed
 * 4. Exit wall near destination
 */
function createWallFollowingPath(
  start: Point2D,
  end: Point2D,
  walls: WallSegment[],
  maxStubLength: number = MAX_STUB_LENGTH
): Point2D[] {
  const path: Point2D[] = [start];
  
  if (walls.length === 0) {
    // No walls - simple orthogonal route
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx > dy) {
      path.push({ x: end.x, y: start.y });
    } else {
      path.push({ x: start.x, y: end.y });
    }
    path.push(end);
    return path;
  }
  
  // Find nearest wall to fixture (start) for entry point
  const fixtureWall = findNearestWall(start, walls);
  
  // Find nearest wall to destination (stack/source) for exit point
  const destWall = findNearestWall(end, walls);
  
  if (!fixtureWall || !destWall) {
    // Fallback to simple orthogonal
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx > dy) {
      path.push({ x: end.x, y: start.y });
    } else {
      path.push({ x: start.x, y: end.y });
    }
    path.push(end);
    return path;
  }
  
  // Step 1: Stub-out from fixture to wall (perpendicular)
  // Make sure stub is perpendicular to wall
  const fixtureEntry = fixtureWall.projectedPoint;
  
  // Step 2: Check if source and destination are on SAME wall
  const sameWall = fixtureWall.wall.x1 === destWall.wall.x1 && 
                   fixtureWall.wall.y1 === destWall.wall.y1 &&
                   fixtureWall.wall.x2 === destWall.wall.x2 &&
                   fixtureWall.wall.y2 === destWall.wall.y2;
  
  if (sameWall || distance2D(fixtureWall.projectedPoint, destWall.projectedPoint) < 50) {
    // Same wall or very close walls - simple route along wall
    path.push(fixtureEntry);
    path.push(destWall.projectedPoint);
    path.push(end);
  } else {
    // Different walls - need to find corner and route through it
    const corner = findWallIntersection(fixtureWall.wall, destWall.wall);
    
    if (corner) {
      // Route: fixture → wall entry → corner → wall exit → destination
      path.push(fixtureEntry);
      path.push(corner);
      path.push(destWall.projectedPoint);
      path.push(end);
    } else {
      // No direct corner - create orthogonal path through walls
      // Route along fixture wall first, then turn toward destination wall
      if (fixtureWall.isHorizontal) {
        // Fixture wall is horizontal - route along X first
        path.push(fixtureEntry);
        path.push({ x: end.x, y: fixtureEntry.y }); // Follow wall horizontally
        path.push({ x: end.x, y: end.y }); // Turn to destination
      } else {
        // Fixture wall is vertical - route along Y first
        path.push(fixtureEntry);
        path.push({ x: fixtureEntry.x, y: end.y }); // Follow wall vertically
        path.push({ x: end.x, y: end.y }); // Turn to destination
      }
    }
  }
  
  // Remove duplicate points
  const cleanPath: Point2D[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const prev = cleanPath[cleanPath.length - 1];
    if (distance2D(prev, path[i]) > 2) {
      cleanPath.push(path[i]);
    }
  }
  
  return cleanPath;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isStackNode(node: MEPNode): boolean {
  return ['drain-stack', 'vent-stack', 'wet-vent-stack'].includes(node.type);
}

function getFixtureDrainHeight(fixtureType: string): number {
  return FIXTURE_DRAIN_HEIGHTS[fixtureType] || FIXTURE_DRAIN_HEIGHTS['default'];
}

function getMaxBranchLength(fixtureType: string): number {
  return MAX_BRANCH_LENGTHS[fixtureType] || MAX_BRANCH_LENGTHS['default'];
}

function distance2D(p1: Point2D, p2: Point2D): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

function distance3D(p1: Point3D, p2: Point3D): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2);
}

function isPlumbingSystem(type: MEPSystemType): type is PlumbingSystemType {
  return ['cold-water', 'hot-water', 'drainage', 'vent'].includes(type);
}

// =============================================================================
// STACK FINDING
// =============================================================================

/**
 * Find the nearest appropriate stack for a given fixture and system type
 */
function findNearestStack(
  fixture: MEPFixture,
  systemType: MEPSystemType,
  nodes: MEPNode[]
): MEPNode | null {
  const stackNodes = nodes.filter(n => {
    if (systemType === 'drainage') {
      return n.type === 'drain-stack' || n.type === 'wet-vent-stack';
    }
    if (systemType === 'vent') {
      return n.type === 'vent-stack' || n.type === 'drain-stack' || n.type === 'wet-vent-stack';
    }
    return false;
  });
  
  if (stackNodes.length === 0) return null;
  
  // Find closest stack by 2D distance
  let nearest: MEPNode | null = null;
  let minDist = Infinity;
  
  for (const stack of stackNodes) {
    const dist = distance2D(fixture.position, stack.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = stack;
    }
  }
  
  return nearest;
}

/**
 * Find water source node
 */
function findWaterNode(systemType: MEPSystemType, nodes: MEPNode[]): MEPNode | null {
  if (systemType === 'cold-water') {
    return nodes.find(n => n.type === 'water-main' || n.type === 'water-manifold') || null;
  }
  if (systemType === 'hot-water') {
    return nodes.find(n => n.type === 'water-heater') || null;
  }
  return null;
}

/**
 * Find electrical panel
 */
function findElectricalNode(nodes: MEPNode[]): MEPNode | null {
  return nodes.find(n => n.type === 'electrical-panel' || n.type === 'sub-panel') || null;
}

// =============================================================================
// 3D ROUTE GENERATION
// =============================================================================

/**
 * Create a route from fixture to vertical stack with proper 3D geometry
 * Uses WALL-CENTRIC routing: pipes run inside walls with short stub-outs
 * 
 * Enhanced with:
 * - Obstruction avoidance (routes around structural columns)
 * - Under-slab routing for slab-on-grade construction
 */
function createDrainageRouteToStack(
  fixture: MEPFixture,
  stack: MEPNode,
  connection: { id: string; systemType: MEPSystemType; localPosition: Point3D; isRequired: boolean },
  walls?: WallSegment[],
  obstructions?: StructuralObstruction[],
  floorConfig?: FloorConfiguration
): { route: MEPRoute; penetrations: SlabPenetration[] } | null {
  const routeId = uuidv4();
  const segments: MEPSegment[] = [];
  const penetrations: SlabPenetration[] = [];
  
  // Get fixture connection point in world coordinates
  const fixturePos = getConnectionWorldPosition(fixture, connection);
  const fixtureZ = getFixtureDrainHeight(fixture.type);
  
  // Stack connection point (where branch enters stack)
  const stackZ = stack.stackProperties 
    ? Math.min(fixtureZ, (stack.stackProperties.topElevation + stack.stackProperties.bottomElevation) / 2)
    : fixtureZ;
  
  // Calculate horizontal distance
  const horizDist = distance2D(fixturePos, stack.position);
  
  // Check if within max branch length
  const maxBranch = getMaxBranchLength(fixture.type);
  if (horizDist > maxBranch) {
    console.warn(`Fixture ${fixture.name} is ${horizDist}cm from stack, exceeds max ${maxBranch}cm`);
  }
  
  // Calculate slope for drainage (1/4" per foot = ~2% grade)
  const slopeRatio = 0.02;
  
  // Get pipe sizing
  const pipeSize = getDrainPipeSize(fixture.dfu);
  const material = DEFAULT_PIPE_MATERIALS['drainage'];
  const slope = getMinSlope(pipeSize);
  
  // Determine if we should use under-slab routing
  const useUnderSlab = floorConfig?.constructionType === 'slab-on-grade' && 
                       fixture.type !== 'floor-drain'; // Floor drains already at slab level
  
  // Create base 2D path
  let path2D = walls && walls.length > 0
    ? createWallFollowingPath(
        { x: fixturePos.x, y: fixturePos.y },
        stack.position,
        walls
      )
    : [
        { x: fixturePos.x, y: fixturePos.y },
        { x: stack.position.x, y: fixturePos.y },
        { x: stack.position.x, y: stack.position.y }
      ];
  
  // Apply obstruction avoidance if obstructions are provided
  if (obstructions && obstructions.length > 0) {
    const routingZ = useUnderSlab 
      ? -(floorConfig?.slabThickness || 12) - 5 // Under slab
      : fixtureZ - 10; // Above slab
    path2D = avoidObstructions(path2D, obstructions, routingZ);
  }
  
  // Convert 90° turns to double 45° for drainage (code compliance)
  path2D = convertDrainageToDouble45(path2D);
  
  // =========================================================================
  // UNDER-SLAB ROUTING (for slab-on-grade construction)
  // =========================================================================
  if (useUnderSlab && floorConfig) {
    const slabThickness = floorConfig.slabThickness;
    const underSlabZ = -slabThickness - 10; // 10cm into soil beneath slab
    
    // Segment 1: P-trap outlet (vertical from fixture)
    const trapOutlet: Point3D = {
      x: fixturePos.x,
      y: fixturePos.y,
      z: fixtureZ - 10,
    };
    
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex: 0,
      systemType: 'drainage',
      startPoint: { x: fixturePos.x, y: fixturePos.y, z: fixtureZ },
      endPoint: trapOutlet,
      size: pipeSize,
      material,
      orientation: 'vertical',
      fittingAtStart: 'p-trap',
    });
    
    // Segment 2: Vertical drop through slab to under-slab level
    const slabPenetrationPoint: Point3D = {
      x: fixturePos.x,
      y: fixturePos.y,
      z: underSlabZ,
    };
    
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex: 1,
      systemType: 'drainage',
      startPoint: trapOutlet,
      endPoint: slabPenetrationPoint,
      size: pipeSize,
      material,
      orientation: 'vertical',
    });
    
    // Track slab penetration at fixture
    penetrations.push({
      id: uuidv4(),
      position: { x: fixturePos.x, y: fixturePos.y },
      direction: 'down',
      pipeSize,
      systemType: 'drainage',
      sleeveRequired: true,
      sleeveSize: pipeSize + 1, // Sleeve 1" larger than pipe
      fixtureId: fixture.id,
      routeId,
    });
    
    // Segment 3+: Horizontal run UNDER slab (no wall-following needed - can go direct)
    // Under-slab routing can be more direct since there are no walls underground
    let currentZ = underSlabZ;
    let segmentIndex = 2;
    
    for (let i = 0; i < path2D.length - 1; i++) {
      const segStart = path2D[i];
      const segEnd = path2D[i + 1];
      const segDist = distance2D(segStart, segEnd);
      
      if (segDist < 5) continue;
      
      const elevDrop = segDist * slopeRatio;
      const endZ = currentZ - elevDrop;
      
      const isLast = i === path2D.length - 2;
      const fittingAtEnd: FittingType = isLast ? 'wye' : 'elbow-45';
      
      segments.push({
        id: uuidv4(),
        routeId,
        segmentIndex,
        systemType: 'drainage',
        startPoint: { x: segStart.x, y: segStart.y, z: currentZ },
        endPoint: { x: segEnd.x, y: segEnd.y, z: endZ },
        size: pipeSize,
        material,
        slope,
        orientation: 'sloped',
        fittingAtEnd,
        color: '#8B4513', // Brown for under-slab (to indicate soil/underground)
      });
      
      currentZ = endZ;
      segmentIndex++;
    }
    
    // Final segment: Vertical rise up to connect with stack base
    const stackEntry = stack.stackProperties?.bottomElevation || 0;
    const lastSegEnd = segments[segments.length - 1]?.endPoint;
    
    if (lastSegEnd) {
      // Rise from under-slab to stack connection
      segments.push({
        id: uuidv4(),
        routeId,
        segmentIndex,
        systemType: 'drainage',
        startPoint: lastSegEnd,
        endPoint: { x: stack.position.x, y: stack.position.y, z: stackEntry + 10 },
        size: pipeSize,
        material,
        orientation: 'vertical',
      });
      
      // Track slab penetration at stack
      penetrations.push({
        id: uuidv4(),
        position: { x: stack.position.x, y: stack.position.y },
        direction: 'up',
        pipeSize: stack.stackProperties?.diameter || pipeSize,
        systemType: 'drainage',
        sleeveRequired: true,
        sleeveSize: (stack.stackProperties?.diameter || pipeSize) + 1,
        routeId,
      });
    }
  } else {
    // =========================================================================
    // STANDARD ABOVE-SLAB ROUTING
    // =========================================================================
    
    // Segment 1: P-trap outlet (short vertical from fixture)
    const trapOutlet: Point3D = {
      x: fixturePos.x,
      y: fixturePos.y,
      z: fixtureZ - 10,
    };
    
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex: 0,
      systemType: 'drainage',
      startPoint: { x: fixturePos.x, y: fixturePos.y, z: fixtureZ },
      endPoint: trapOutlet,
      size: pipeSize,
      material,
      orientation: 'vertical',
      fittingAtStart: 'p-trap',
    });
    
    // Create horizontal segments following wall path
    let currentZ = trapOutlet.z;
    let segmentIndex = 1;
    
    for (let i = 0; i < path2D.length - 1; i++) {
      const segStart = path2D[i];
      const segEnd = path2D[i + 1];
      const segDist = distance2D(segStart, segEnd);
      
      // Skip very short segments
      if (segDist < 5) continue;
      
      // Calculate elevation drop for this segment
      const elevDrop = segDist * slopeRatio;
      const endZ = currentZ - elevDrop;
      
      const isLast = i === path2D.length - 2;
      const fittingAtEnd: FittingType = isLast ? 'sanitary-tee' : 'elbow-45';
      
      segments.push({
        id: uuidv4(),
        routeId,
        segmentIndex,
        systemType: 'drainage',
        startPoint: { x: segStart.x, y: segStart.y, z: currentZ },
        endPoint: { x: segEnd.x, y: segEnd.y, z: endZ },
        size: pipeSize,
        material,
        slope,
        orientation: 'sloped',
        fittingAtEnd,
      });
      
      currentZ = endZ;
      segmentIndex++;
    }
    
    // Final vertical drop into stack (if needed)
    const stackEntry = stack.stackProperties?.bottomElevation || 0;
    const lastSegEnd = segments[segments.length - 1]?.endPoint;
    
    if (lastSegEnd && lastSegEnd.z > stackEntry + 20) {
      segments.push({
        id: uuidv4(),
        routeId,
        segmentIndex,
        systemType: 'drainage',
        startPoint: lastSegEnd,
        endPoint: { x: stack.position.x, y: stack.position.y, z: stackEntry + 10 },
        size: pipeSize,
        material,
        orientation: 'vertical',
      });
    }
  }
  
  const totalLength = segments.reduce((sum, seg) => sum + distance3D(seg.startPoint, seg.endPoint), 0);
  
  const route: MEPRoute = {
    id: routeId,
    systemType: 'drainage',
    segments,
    source: { type: 'node', nodeId: stack.id },
    destination: { type: 'fixture', id: fixture.id },
    totalLength,
    totalDFU: fixture.dfu,
    requiredSize: pipeSize,
    elevation: { start: stack.stackProperties?.bottomElevation || 0, end: fixtureZ },
    isValid: true,
    validationErrors: [],
  };
  
  return { route, penetrations };
}

/**
 * Create a vent route from fixture to vent stack
 * Uses WALL-CENTRIC routing: vent pipes run inside walls
 */
function createVentRouteToStack(
  fixture: MEPFixture,
  stack: MEPNode,
  connection: { id: string; systemType: MEPSystemType; localPosition: Point3D; isRequired: boolean },
  walls?: WallSegment[]
): MEPRoute | null {
  const routeId = uuidv4();
  const segments: MEPSegment[] = [];
  
  const fixturePos = getConnectionWorldPosition(fixture, connection);
  const fixtureZ = getFixtureDrainHeight(fixture.type);
  
  // Vent must rise 6" (15cm) above flood rim before going horizontal
  const ventRiseHeight = fixtureZ + VENT_OFFSET_ABOVE_FIXTURE;
  
  const pipeSize = getVentPipeSize(fixture.dfu);
  const material = DEFAULT_PIPE_MATERIALS['vent'];
  
  // Segment 1: Vertical rise from trap arm
  const ventRise: Point3D = {
    x: fixturePos.x,
    y: fixturePos.y,
    z: ventRiseHeight,
  };
  
  segments.push({
    id: uuidv4(),
    routeId,
    segmentIndex: 0,
    systemType: 'vent',
    startPoint: { x: fixturePos.x, y: fixturePos.y, z: fixtureZ },
    endPoint: ventRise,
    size: pipeSize,
    material,
    orientation: 'vertical',
  });
  
  // Create WALL-CENTRIC horizontal path
  const path2D = walls && walls.length > 0
    ? createWallFollowingPath(
        { x: fixturePos.x, y: fixturePos.y },
        stack.position,
        walls
      )
    : [
        { x: fixturePos.x, y: fixturePos.y },
        { x: stack.position.x, y: fixturePos.y },
        { x: stack.position.x, y: stack.position.y }
      ];
  
  const stackZ = stack.stackProperties?.topElevation 
    ? Math.min(ventRiseHeight, stack.stackProperties.topElevation - 20)
    : ventRiseHeight;
  
  // Create horizontal segments following wall path
  let segmentIndex = 1;
  
  for (let i = 0; i < path2D.length - 1; i++) {
    const segStart = path2D[i];
    const segEnd = path2D[i + 1];
    const segDist = distance2D(segStart, segEnd);
    
    if (segDist < 5) continue;
    
    const isFirst = i === 0;
    const isLast = i === path2D.length - 2;
    
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex,
      systemType: 'vent',
      startPoint: { x: segStart.x, y: segStart.y, z: ventRiseHeight },
      endPoint: { x: segEnd.x, y: segEnd.y, z: isLast ? stackZ : ventRiseHeight },
      size: pipeSize,
      material,
      orientation: 'horizontal',
      fittingAtStart: isFirst ? 'elbow-90' : undefined,
      fittingAtEnd: isLast ? 'tee' : 'elbow-90',
    });
    
    segmentIndex++;
  }
  
  const totalLength = segments.reduce((sum, seg) => sum + distance3D(seg.startPoint, seg.endPoint), 0);
  
  return {
    id: routeId,
    systemType: 'vent',
    segments,
    source: { type: 'node', nodeId: stack.id },
    destination: { type: 'fixture', id: fixture.id },
    totalLength,
    totalDFU: fixture.dfu,
    requiredSize: pipeSize,
    elevation: { start: stackZ, end: fixtureZ },
    isValid: true,
    validationErrors: [],
  };
}

/**
 * Calculate the proper connection height for a water node based on its type and mounting
 * This is critical for ceiling-mounted water heaters to route pipes correctly
 */
function getWaterNodeConnectionHeight(
  node: MEPNode,
  connectionType: 'cold-water' | 'hot-water',
  ceilingHeight: number = 280
): number {
  // Water heater: adjust inlet/outlet based on mounting type
  if (node.type === 'water-heater' && node.waterHeaterProps) {
    const { inletHeight, outletHeight } = node.waterHeaterProps;
    
    if (node.mountingType === 'ceiling') {
      // For ceiling mount, connections are on the BOTTOM of the heater
      // The heater body is at (ceilingHeight - heightFromCeiling)
      // Connections hang below that position
      const heaterBottomZ = ceilingHeight - (node.heightFromCeiling ?? 0);
      
      // Inlet (cold) and outlet (hot) both connect at bottom of ceiling-mounted heater
      if (connectionType === 'cold-water') {
        return heaterBottomZ - 15; // Cold inlet at bottom
      } else {
        return heaterBottomZ - 10; // Hot outlet slightly higher than inlet
      }
    }
    
    // Floor/wall mounted: use heights as-is (from floor)
    if (connectionType === 'cold-water') {
      return inletHeight;
    } else {
      return outletHeight;
    }
  }
  
  // Default for other nodes (water main, manifold)
  if (node.mountingType === 'ceiling') {
    return ceilingHeight - (node.heightFromCeiling ?? 20) - 10;
  }
  
  return node.position.z || 50; // Default supply height
}

/**
 * Create water supply route (horizontal, no gravity requirement)
 * Optionally uses wall-following for more realistic pipe runs
 * NOW SUPPORTS: Ceiling-mounted water heaters with vertical drop segments
 */
function createWaterRoute(
  fixture: MEPFixture,
  sourceNode: MEPNode,
  systemType: 'cold-water' | 'hot-water',
  connection: { id: string; systemType: MEPSystemType; localPosition: Point3D; isRequired: boolean },
  walls?: WallSegment[],
  ceilingHeight?: number
): MEPRoute | null {
  const routeId = uuidv4();
  const segments: MEPSegment[] = [];
  
  const fixturePos = getConnectionWorldPosition(fixture, connection);
  const fixtureSupplyHeight = fixture.supplyHeight || 50; // cm from floor - where fixture expects water
  
  // Calculate source node connection height (critical for ceiling-mounted heaters)
  const effectiveCeilingHeight = ceilingHeight ?? 280;
  const sourceZ = getWaterNodeConnectionHeight(sourceNode, systemType, effectiveCeilingHeight);
  
  // Determine horizontal routing height
  // For ceiling-mounted sources, route at fixture level (pipes drop from ceiling to fixture level)
  // For floor/wall-mounted sources, route at source level
  const isCeilingMounted = sourceNode.mountingType === 'ceiling';
  const routingZ = isCeilingMounted ? fixtureSupplyHeight : sourceZ;
  
  const pipeSize = getWaterPipeSize(fixture.gpm);
  const material = DEFAULT_PIPE_MATERIALS[systemType];
  
  let segmentIndex = 0;
  
  // =========================================================================
  // VERTICAL DROP FROM CEILING-MOUNTED SOURCE
  // =========================================================================
  if (isCeilingMounted && Math.abs(sourceZ - routingZ) > 20) {
    // First point of the 2D path (source node position)
    const firstPathPoint = sourceNode.position;
    
    // Vertical segment from ceiling-mounted source down to routing level
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex: segmentIndex++,
      systemType,
      startPoint: { x: firstPathPoint.x, y: firstPathPoint.y, z: sourceZ },
      endPoint: { x: firstPathPoint.x, y: firstPathPoint.y, z: routingZ },
      size: pipeSize,
      material,
      orientation: 'vertical',
      fittingAtEnd: 'elbow-90', // Elbow to transition to horizontal
    });
  }
  
  // =========================================================================
  // HORIZONTAL PATH (wall-following or direct)
  // =========================================================================
  // Create wall-following path if walls are provided
  const path2D = walls && walls.length > 0
    ? createWallFollowingPath(sourceNode.position, { x: fixturePos.x, y: fixturePos.y }, walls)
    : [sourceNode.position, { x: fixturePos.x, y: sourceNode.position.y }, { x: fixturePos.x, y: fixturePos.y }];
  
  // Convert 2D path to 3D segments at routing height
  for (let i = 0; i < path2D.length - 1; i++) {
    const isLast = i === path2D.length - 2;
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex: segmentIndex++,
      systemType,
      startPoint: { x: path2D[i].x, y: path2D[i].y, z: routingZ },
      endPoint: { x: path2D[i + 1].x, y: path2D[i + 1].y, z: routingZ },
      size: pipeSize,
      material,
      orientation: 'horizontal',
      fittingAtEnd: isLast ? undefined : 'elbow-90',
    });
  }
  
  // =========================================================================
  // VERTICAL RISER TO FIXTURE (if needed)
  // =========================================================================
  const fixtureZ = connection.localPosition.z || fixtureSupplyHeight;
  if (Math.abs(fixtureZ - routingZ) > 5) {
    segments.push({
      id: uuidv4(),
      routeId,
      segmentIndex: segmentIndex++,
      systemType,
      startPoint: { x: fixturePos.x, y: fixturePos.y, z: routingZ },
      endPoint: { x: fixturePos.x, y: fixturePos.y, z: fixtureZ },
      size: pipeSize,
      material,
      orientation: 'vertical',
      fittingAtEnd: 'valve-ball',
    });
  } else {
    // Add valve to last segment
    if (segments.length > 0) {
      segments[segments.length - 1].fittingAtEnd = 'valve-ball';
    }
  }
  
  const totalLength = segments.reduce((sum, seg) => sum + distance3D(seg.startPoint, seg.endPoint), 0);
  
  return {
    id: routeId,
    systemType,
    segments,
    source: { type: 'node', nodeId: sourceNode.id },
    destination: { type: 'fixture', id: fixture.id },
    totalLength,
    totalDFU: 0,
    requiredSize: pipeSize,
    elevation: { start: sourceZ, end: fixtureZ },
    isValid: true,
    validationErrors: [],
  };
}

// =============================================================================
// MAIN AUTO-ROUTING FUNCTION
// =============================================================================

/**
 * Auto-route all fixtures using stack-centric approach
 */
export function autoRouteAllFixturesStackCentric(
  fixtures: MEPFixture[],
  nodes: MEPNode[],
  existingRoutes: MEPRoute[],
  config: StackRoutingConfig
): StackRoutingResult {
  const result: StackRoutingResult = {
    routes: [],
    successCount: 0,
    failureCount: 0,
    messages: [],
  };
  
  if (fixtures.length === 0) {
    result.messages.push('No fixtures to route');
    return result;
  }
  
  // Build routing requests sorted by system priority
  const requests: Array<{
    fixture: MEPFixture;
    systemType: MEPSystemType;
    connection: { id: string; systemType: MEPSystemType; localPosition: Point3D; isRequired: boolean };
    priority: number;
  }> = [];
  
  for (const fixture of fixtures) {
    for (const connection of fixture.connections) {
      if (!connection.isRequired) continue;
      
      requests.push({
        fixture,
        systemType: connection.systemType,
        connection,
        priority: SYSTEM_PRIORITY[connection.systemType],
      });
    }
  }
  
  // Sort by priority (drainage first)
  requests.sort((a, b) => a.priority - b.priority);
  
  // Track slab penetrations
  const allPenetrations: SlabPenetration[] = [];
  
  // Convert columns to obstructions if provided
  const obstructions = config.columns 
    ? columnsToObstructions(config.columns) 
    : config.obstructions || [];
  
  // Process each routing request
  for (const request of requests) {
    let route: MEPRoute | null = null;
    
    try {
      if (request.systemType === 'drainage') {
        const stack = findNearestStack(request.fixture, 'drainage', nodes);
        if (stack) {
          const wallsForRouting = config.preferWallFollowing !== false ? config.walls : undefined;
          const routeResult = createDrainageRouteToStack(
            request.fixture, 
            stack, 
            request.connection, 
            wallsForRouting,
            obstructions,
            config.floorConfig
          );
          if (routeResult) {
            route = routeResult.route;
            allPenetrations.push(...routeResult.penetrations);
            const routingMode = config.floorConfig?.constructionType === 'slab-on-grade' 
              ? 'under-slab' : 'wall-centric';
            result.messages.push(`✓ Drainage: ${request.fixture.name} → ${stack.name} (${routingMode})`);
          }
        } else {
          result.messages.push(`✗ No drain stack found for ${request.fixture.name}`);
        }
      } else if (request.systemType === 'vent') {
        const stack = findNearestStack(request.fixture, 'vent', nodes);
        if (stack) {
          // Pass walls for wall-centric routing
          const wallsForRouting = config.preferWallFollowing !== false ? config.walls : undefined;
          route = createVentRouteToStack(request.fixture, stack, request.connection, wallsForRouting);
          result.messages.push(`✓ Vent: ${request.fixture.name} → ${stack.name} (wall-centric)`);
        } else {
          result.messages.push(`✗ No vent stack found for ${request.fixture.name}`);
        }
      } else if (request.systemType === 'cold-water' || request.systemType === 'hot-water') {
        const waterNode = findWaterNode(request.systemType, nodes);
        if (waterNode) {
          // Pass walls for wall-following routing if preferWallFollowing is enabled
          const wallsForRouting = config.preferWallFollowing !== false ? config.walls : undefined;
          // Pass ceiling height for proper ceiling-mounted water heater routing
          route = createWaterRoute(
            request.fixture, 
            waterNode, 
            request.systemType, 
            request.connection, 
            wallsForRouting,
            config.ceilingHeight
          );
          const mountInfo = waterNode.mountingType === 'ceiling' ? ' (ceiling-drop)' : '';
          result.messages.push(`✓ ${request.systemType}: ${request.fixture.name} ← ${waterNode.name}${mountInfo}`);
        } else {
          result.messages.push(`✗ No ${request.systemType} source for ${request.fixture.name}`);
        }
      } else if (['power', 'dedicated', 'lighting'].includes(request.systemType)) {
        const panel = findElectricalNode(nodes);
        if (panel) {
          // Create simple electrical route (horizontal)
          const routeId = uuidv4();
          const fixturePos = getConnectionWorldPosition(request.fixture, request.connection);
          route = {
            id: routeId,
            systemType: request.systemType,
            segments: [{
              id: uuidv4(),
              routeId,
              segmentIndex: 0,
              systemType: request.systemType,
              startPoint: panel.position,
              endPoint: { x: fixturePos.x, y: fixturePos.y, z: panel.position.z },
              size: 12,
              material: 'THHN',
              orientation: 'horizontal',
            }],
            source: { type: 'node', nodeId: panel.id },
            destination: { type: 'fixture', id: request.fixture.id },
            totalLength: distance3D(panel.position, { x: fixturePos.x, y: fixturePos.y, z: panel.position.z }),
            totalDFU: 0,
            requiredSize: 12,
            elevation: { start: panel.position.z, end: panel.position.z },
            isValid: true,
            validationErrors: [],
          };
          result.messages.push(`✓ ${request.systemType}: ${request.fixture.name} ← ${panel.name}`);
        }
      }
      
      if (route) {
        result.routes.push(route);
        result.successCount++;
      } else {
        result.failureCount++;
      }
    } catch (error) {
      result.failureCount++;
      result.messages.push(`✗ Error routing ${request.systemType} for ${request.fixture.name}`);
      console.error('Routing error:', error);
    }
  }
  
  // Add slab penetrations to result
  result.slabPenetrations = allPenetrations;
  
  return result;
}
