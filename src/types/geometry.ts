/**
 * Unified Geometry Types
 * 
 * Single source of truth for all geometric primitives.
 * All position and dimension types in the codebase should use these.
 */

// =============================================================================
// POINT TYPES
// =============================================================================

/**
 * 2D point/position in centimeters
 * Used for floor plan coordinates
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 3D point/position in centimeters
 * Used for elevation coordinates and 3D positions
 */
export interface Point3D extends Point2D {
  z: number;
}

/**
 * Floor plan point with unique ID
 * Used for wall endpoints that can be shared
 */
export interface FloorPlanPoint extends Point2D {
  id: string;
}

// =============================================================================
// DIMENSION TYPES
// =============================================================================

/**
 * 3D dimensions in centimeters
 * Standard dimension container for all placeable objects
 */
export interface Dimensions {
  width: number;   // X-axis extent
  depth: number;   // Y-axis extent (into the scene)
  height: number;  // Z-axis extent (vertical)
}

/**
 * 2D dimensions in centimeters
 * For flat objects like tiles
 */
export interface Dimensions2D {
  width: number;
  height: number;
}

// =============================================================================
// TRANSFORM TYPES
// =============================================================================

/**
 * 2D transform for placeable objects
 * Position is CENTER-based (not corner-based)
 */
export interface Transform2D {
  position: Point2D;
  rotation: number;  // Degrees, counter-clockwise from positive X-axis
}

/**
 * 3D transform for placeable objects
 */
export interface Transform3D {
  position: Point3D;
  rotation: Point3D;  // Euler angles in degrees (x, y, z)
}

// =============================================================================
// BOUNDING BOX TYPES
// =============================================================================

/**
 * Axis-aligned bounding box in 2D
 */
export interface BoundingBox2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Axis-aligned bounding box in 3D
 */
export interface BoundingBox3D extends BoundingBox2D {
  minZ: number;
  maxZ: number;
}

/**
 * Oriented bounding box (with rotation)
 */
export interface OrientedBoundingBox2D {
  center: Point2D;
  halfExtents: Point2D;  // Half width and half depth
  rotation: number;      // Degrees
}

// =============================================================================
// CLEARANCE ZONE
// =============================================================================

/**
 * Required clearance around an object
 * Used for fixtures and furniture placement validation
 */
export interface ClearanceZone {
  front: number;   // Clearance in front (positive Y from object center)
  back: number;    // Clearance behind (negative Y from object center)
  left: number;    // Clearance to left (negative X from object center)
  right: number;   // Clearance to right (positive X from object center)
}

/**
 * Simplified clearance (symmetric sides)
 */
export interface SimpleClearance {
  front: number;
  sides: number;
  rear: number;
}

// =============================================================================
// LINE & SEGMENT TYPES
// =============================================================================

/**
 * Line segment defined by two points
 */
export interface LineSegment2D {
  start: Point2D;
  end: Point2D;
}

/**
 * Line segment with thickness (for walls)
 */
export interface ThickLineSegment2D extends LineSegment2D {
  thickness: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Vector in 2D (same structure as Point2D but semantically different)
 */
export type Vector2D = Point2D;

/**
 * Vector in 3D
 */
export type Vector3D = Point3D;

/**
 * Range of values
 */
export interface Range {
  min: number;
  max: number;
}

/**
 * Z-range for vertical extent
 */
export interface ZRange {
  bottom: number;
  top: number;
}
