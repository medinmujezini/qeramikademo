/**
 * Unified Unit Constants
 * 
 * Single source of truth for all unit conversions and default values.
 * All dimensions in the codebase should use these constants.
 */

// =============================================================================
// UNIT CONVERSIONS
// =============================================================================

/** Convert centimeters to meters (for 3D rendering) */
export const CM_TO_METERS = 0.01;

/** Convert millimeters to centimeters */
export const MM_TO_CM = 0.1;

/** Convert meters to centimeters */
export const METERS_TO_CM = 100;

/** Convert inches to centimeters */
export const INCHES_TO_CM = 2.54;

/** Convert feet to centimeters */
export const FEET_TO_CM = 30.48;

// =============================================================================
// DEFAULT DIMENSIONS (in centimeters)
// =============================================================================

/** Standard wall height for residential construction */
export const DEFAULT_WALL_HEIGHT = 280;

/** Standard wall thickness */
export const DEFAULT_WALL_THICKNESS = 15;

/** Standard door width */
export const DEFAULT_DOOR_WIDTH = 80;

/** Standard door height */
export const DEFAULT_DOOR_HEIGHT = 210;

/** Standard window sill height */
export const DEFAULT_WINDOW_SILL_HEIGHT = 90;

/** Standard ceiling height */
export const DEFAULT_CEILING_HEIGHT = 280;

// =============================================================================
// GRID & CANVAS
// =============================================================================

/** Default grid cell size in pixels (for 2D canvas) */
export const DEFAULT_GRID_SIZE = 20;

/** Default canvas scale (pixels per cm) */
export const DEFAULT_CANVAS_SCALE = 1;

/** Snap threshold in pixels for point snapping */
export const SNAP_THRESHOLD_PIXELS = 10;

// =============================================================================
// 3D RENDERING
// =============================================================================

/** Default field of view for 3D camera */
export const DEFAULT_FOV = 50;

/** Near clipping plane */
export const NEAR_CLIP = 0.1;

/** Far clipping plane */
export const FAR_CLIP = 1000;

// =============================================================================
// MEP STANDARDS (in centimeters unless noted)
// =============================================================================

/** Minimum drain slope (inches per foot - standard) */
export const MIN_DRAIN_SLOPE_INCH_PER_FOOT = 0.25;

/** Standard drain pipe clearance from other systems */
export const DRAIN_CLEARANCE = 10;

/** Standard water pipe clearance from other systems */
export const WATER_PIPE_CLEARANCE = 5;

/** Standard electrical clearance from plumbing */
export const ELECTRICAL_CLEARANCE = 15;

// =============================================================================
// TILE STANDARDS
// =============================================================================

/** Default grout width in millimeters */
export const DEFAULT_GROUT_WIDTH_MM = 3;

/** Default grout width in centimeters */
export const DEFAULT_GROUT_WIDTH = DEFAULT_GROUT_WIDTH_MM * MM_TO_CM;

/** Default tile width in centimeters */
export const DEFAULT_TILE_WIDTH = 30;

/** Default tile height in centimeters */
export const DEFAULT_TILE_HEIGHT = 30;

/** Default tile thickness in centimeters */
export const DEFAULT_TILE_THICKNESS = 0.8;

/** Default grout color (light gray) */
export const DEFAULT_GROUT_COLOR = '#d1d5db';

/** Default tile color (white) */
export const DEFAULT_TILE_COLOR = '#ffffff';

/** Default tile pattern */
export const DEFAULT_TILE_PATTERN = 'grid' as const;

/** Default tile orientation */
export const DEFAULT_TILE_ORIENTATION = 'horizontal' as const;

/** Default tile material */
export const DEFAULT_TILE_MATERIAL = 'ceramic';

/** Default price per tile unit */
export const DEFAULT_TILE_PRICE = 2.5;
