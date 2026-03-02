/**
 * Dimension Conversion Utilities
 * 
 * Centralized functions for converting between coordinate systems.
 * Single source of truth for 2D ↔ 3D conversions.
 */

import { CM_TO_METERS, METERS_TO_CM } from '@/constants/units';
import type { Point2D, Point3D, Dimensions, Dimensions2D } from '@/types/geometry';

// =============================================================================
// 2D TO 3D CONVERSIONS
// =============================================================================

/**
 * Convert a 2D position (in cm) to 3D position (in meters)
 * Uses floor plan convention: X stays X, Y becomes Z, height becomes Y
 * 
 * @param pos - 2D position in centimeters
 * @param height - Height from floor in centimeters (default 0)
 * @returns 3D position in meters (Three.js convention: Y is up)
 */
export function position2Dto3D(pos: Point2D, height: number = 0): Point3D {
  return {
    x: pos.x * CM_TO_METERS,
    y: height * CM_TO_METERS,  // Height becomes Y in 3D
    z: pos.y * CM_TO_METERS,   // Floor plan Y becomes 3D Z
  };
}

/**
 * Convert 3D position (in meters) to 2D position (in cm)
 * 
 * @param pos - 3D position in meters
 * @returns 2D position in centimeters (floor plan coords)
 */
export function position3Dto2D(pos: Point3D): Point2D {
  return {
    x: pos.x * METERS_TO_CM,
    y: pos.z * METERS_TO_CM,  // 3D Z becomes floor plan Y
  };
}

/**
 * Get height from 3D position
 */
export function getHeightFrom3D(pos: Point3D): number {
  return pos.y * METERS_TO_CM;
}

// =============================================================================
// DIMENSION CONVERSIONS
// =============================================================================

/**
 * Convert dimensions from cm to meters
 * Preserves the semantic meaning (width, depth, height)
 */
export function dimensionsCmToMeters(dims: Dimensions): Dimensions {
  return {
    width: dims.width * CM_TO_METERS,
    depth: dims.depth * CM_TO_METERS,
    height: dims.height * CM_TO_METERS,
  };
}

/**
 * Convert dimensions from meters to cm
 */
export function dimensionsMetersToCm(dims: Dimensions): Dimensions {
  return {
    width: dims.width * METERS_TO_CM,
    depth: dims.depth * METERS_TO_CM,
    height: dims.height * METERS_TO_CM,
  };
}

/**
 * Convert 2D dimensions from cm to meters
 */
export function dimensions2DCmToMeters(dims: Dimensions2D): Dimensions2D {
  return {
    width: dims.width * CM_TO_METERS,
    height: dims.height * CM_TO_METERS,
  };
}

// =============================================================================
// SCALE FACTOR CALCULATIONS
// =============================================================================

/**
 * Calculate uniform scale factor for a 3D model to match target dimensions
 * 
 * @param modelSize - Current model bounding box size
 * @param targetDims - Target dimensions in cm
 * @returns Uniform scale factor
 */
export function calculateUniformScale(
  modelSize: { x: number; y: number; z: number },
  targetDims: Dimensions
): number {
  const targetMeters = dimensionsCmToMeters(targetDims);
  
  // Find the largest ratio needed
  const scaleX = targetMeters.width / modelSize.x;
  const scaleY = targetMeters.height / modelSize.y;
  const scaleZ = targetMeters.depth / modelSize.z;
  
  // Use the smallest scale to fit within bounds
  return Math.min(scaleX, scaleY, scaleZ);
}

/**
 * Calculate per-axis scale factors for exact dimension matching
 * 
 * @param modelSize - Current model bounding box size
 * @param targetDims - Target dimensions in cm
 * @returns Per-axis scale factors
 */
export function calculateAxisScale(
  modelSize: { x: number; y: number; z: number },
  targetDims: Dimensions
): Point3D {
  const targetMeters = dimensionsCmToMeters(targetDims);
  
  return {
    x: modelSize.x > 0 ? targetMeters.width / modelSize.x : 1,
    y: modelSize.y > 0 ? targetMeters.height / modelSize.y : 1,
    z: modelSize.z > 0 ? targetMeters.depth / modelSize.z : 1,
  };
}

// =============================================================================
// CANVAS SCALE CONVERSIONS
// =============================================================================

/**
 * Convert pixels to centimeters based on canvas scale
 * 
 * @param pixels - Value in pixels
 * @param scale - Canvas scale (pixels per cm)
 * @returns Value in centimeters
 */
export function pixelsToCm(pixels: number, scale: number): number {
  return pixels / scale;
}

/**
 * Convert centimeters to pixels based on canvas scale
 * 
 * @param cm - Value in centimeters
 * @param scale - Canvas scale (pixels per cm)
 * @returns Value in pixels
 */
export function cmToPixels(cm: number, scale: number): number {
  return cm * scale;
}

/**
 * Convert a 2D point from pixels to cm
 */
export function pointPixelsToCm(point: Point2D, scale: number): Point2D {
  return {
    x: pixelsToCm(point.x, scale),
    y: pixelsToCm(point.y, scale),
  };
}

/**
 * Convert a 2D point from cm to pixels
 */
export function pointCmToPixels(point: Point2D, scale: number): Point2D {
  return {
    x: cmToPixels(point.x, scale),
    y: cmToPixels(point.y, scale),
  };
}

// =============================================================================
// ROTATION CONVERSIONS
// =============================================================================

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Normalize angle to -180 to 180 range
 */
export function normalizeAngleSigned(degrees: number): number {
  const normalized = normalizeAngle(degrees);
  return normalized > 180 ? normalized - 360 : normalized;
}

// =============================================================================
// BOUNDING BOX HELPERS
// =============================================================================

/**
 * Calculate bounding box from center position, dimensions, and rotation
 */
export function calculateBoundingBox(
  center: Point2D,
  dims: Dimensions,
  rotationDegrees: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const halfWidth = dims.width / 2;
  const halfDepth = dims.depth / 2;
  
  // If no rotation, simple calculation
  if (rotationDegrees === 0) {
    return {
      minX: center.x - halfWidth,
      minY: center.y - halfDepth,
      maxX: center.x + halfWidth,
      maxY: center.y + halfDepth,
    };
  }
  
  // With rotation, calculate corners and find extents
  const rad = degreesToRadians(rotationDegrees);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  const corners = [
    { x: -halfWidth, y: -halfDepth },
    { x: halfWidth, y: -halfDepth },
    { x: halfWidth, y: halfDepth },
    { x: -halfWidth, y: halfDepth },
  ];
  
  const rotatedCorners = corners.map(c => ({
    x: center.x + c.x * cos - c.y * sin,
    y: center.y + c.x * sin + c.y * cos,
  }));
  
  const xs = rotatedCorners.map(c => c.x);
  const ys = rotatedCorners.map(c => c.y);
  
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}
