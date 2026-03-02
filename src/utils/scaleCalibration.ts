// Scale calibration utilities for floor plan digitization

import type { ScaleCalibration } from '@/types/floorPlanDigitizer';

/**
 * Convert a distance to centimeters based on the unit
 */
export function convertToCm(distance: number, unit: ScaleCalibration['unit']): number {
  switch (unit) {
    case 'mm':
      return distance / 10;
    case 'cm':
      return distance;
    case 'm':
      return distance * 100;
    case 'in':
      return distance * 2.54;
    case 'ft':
      return distance * 30.48;
    default:
      return distance;
  }
}

/**
 * Convert centimeters to a target unit
 */
export function convertFromCm(distanceCm: number, unit: ScaleCalibration['unit']): number {
  switch (unit) {
    case 'mm':
      return distanceCm * 10;
    case 'cm':
      return distanceCm;
    case 'm':
      return distanceCm / 100;
    case 'in':
      return distanceCm / 2.54;
    case 'ft':
      return distanceCm / 30.48;
    default:
      return distanceCm;
  }
}

/**
 * Calculate the pixel distance between two points
 */
export function calculatePixelDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate the scale (pixels per centimeter) from a calibration
 */
export function calculateScale(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
  realWorldDistance: number,
  unit: ScaleCalibration['unit']
): number {
  const pixelDistance = calculatePixelDistance(point1, point2);
  const distanceInCm = convertToCm(realWorldDistance, unit);
  
  if (distanceInCm <= 0) {
    throw new Error('Real world distance must be greater than 0');
  }
  
  return pixelDistance / distanceInCm;
}

/**
 * Create a complete scale calibration object
 */
export function createScaleCalibration(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
  realWorldDistance: number,
  unit: ScaleCalibration['unit']
): ScaleCalibration {
  const pixelsPerCm = calculateScale(point1, point2, realWorldDistance, unit);
  
  return {
    point1,
    point2,
    realWorldDistance,
    unit,
    pixelsPerCm,
  };
}

/**
 * Convert pixel coordinates to real-world coordinates (in cm)
 */
export function pixelsToCm(pixels: number, pixelsPerCm: number): number {
  return pixels / pixelsPerCm;
}

/**
 * Convert real-world coordinates (in cm) to pixels
 */
export function cmToPixels(cm: number, pixelsPerCm: number): number {
  return cm * pixelsPerCm;
}

/**
 * Convert a point from pixel space to world space (cm)
 */
export function pixelPointToWorld(
  point: { x: number; y: number },
  pixelsPerCm: number
): { x: number; y: number } {
  return {
    x: pixelsToCm(point.x, pixelsPerCm),
    y: pixelsToCm(point.y, pixelsPerCm),
  };
}

/**
 * Convert a point from world space (cm) to pixel space
 */
export function worldPointToPixel(
  point: { x: number; y: number },
  pixelsPerCm: number
): { x: number; y: number } {
  return {
    x: cmToPixels(point.x, pixelsPerCm),
    y: cmToPixels(point.y, pixelsPerCm),
  };
}

/**
 * Get human-readable format string for a distance
 */
export function formatDistance(
  distanceCm: number,
  unit: ScaleCalibration['unit'],
  precision: number = 1
): string {
  const converted = convertFromCm(distanceCm, unit);
  return `${converted.toFixed(precision)} ${unit}`;
}

/**
 * Validate a scale calibration
 */
export function validateCalibration(calibration: ScaleCalibration): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check if points are different
  if (
    calibration.point1.x === calibration.point2.x &&
    calibration.point1.y === calibration.point2.y
  ) {
    errors.push('Calibration points must be different');
  }
  
  // Check if distance is positive
  if (calibration.realWorldDistance <= 0) {
    errors.push('Real world distance must be greater than 0');
  }
  
  // Check if pixels per cm is reasonable (1-100 pixels per cm is typical)
  if (calibration.pixelsPerCm < 0.1) {
    errors.push('Scale seems too small - points may be too close together');
  }
  
  if (calibration.pixelsPerCm > 500) {
    errors.push('Scale seems too large - the reference distance may be too small');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
