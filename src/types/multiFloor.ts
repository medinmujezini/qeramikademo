/**
 * Multi-Floor Data Model — Step 6
 * 
 * Defines the multi-floor system with independent floor plans per level,
 * staircase connections, and floor slab configuration.
 */

import type { FloorPlan } from './floorPlan';
import { createDefaultFloorPlan } from './floorPlan';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// STAIRCASE TYPES — Step 7
// =============================================================================

export type StaircaseType = 'straight' | 'l-shaped' | 'u-shaped' | 'spiral';
export type RailingStyle = 'none' | 'simple' | 'glass' | 'metal';

export interface Staircase {
  id: string;
  type: StaircaseType;
  /** Bottom floor level (0-based) */
  fromLevel: number;
  /** Top floor level */
  toLevel: number;
  /** Position in plan coordinates (cm) — bottom-left of stairwell */
  x: number;
  y: number;
  /** Stairwell width (cm) */
  width: number;
  /** Stairwell depth/length (cm) */
  depth: number;
  /** Rotation in degrees */
  rotation: number;
  /** Tread depth (cm) — typically 25-30 */
  treadDepth: number;
  /** Individual riser height (cm) — auto-calculated from floor-to-floor / numTreads */
  riserHeight: number;
  /** Number of treads — auto-calculated */
  numTreads: number;
  /** Stair width / clear width of treads (cm) — typically 80-120 */
  stairWidth: number;
  /** Railing style */
  railing: RailingStyle;
  /** For L-shaped: landing position (0-1 along total rise) */
  landingPosition?: number;
  /** For spiral: center radius (cm) */
  centerRadius?: number;
  /** Material for treads */
  treadMaterial: 'wood' | 'concrete' | 'metal' | 'marble';
  /** Optional custom GLB model URL (blob or remote) */
  customGlbUrl?: string;
}

// =============================================================================
// FLOOR SLAB — Step 8
// =============================================================================

export interface FloorSlab {
  /** Slab thickness in cm (default 20) */
  thickness: number;
  /** Stairwell openings — rectangles cut from slab */
  openings: SlabOpening[];
  /** Material for top surface */
  topMaterial: 'concrete' | 'finished';
  /** Material for underside */
  bottomMaterial: 'concrete' | 'plaster';
}

export interface SlabOpening {
  id: string;
  /** Linked staircase ID */
  staircaseId?: string;
  /** Position & size in plan coords (cm) */
  x: number;
  y: number;
  width: number;
  depth: number;
}

// =============================================================================
// FLOOR
// =============================================================================

export interface Floor {
  id: string;
  /** Level index: 0 = ground, 1 = first floor, -1 = basement */
  level: number;
  /** Display name */
  name: string;
  /** Floor-to-floor height in cm (default 300 — includes slab) */
  floorToFloorHeight: number;
  /** The floor plan for this level */
  floorPlan: FloorPlan;
  /** Slab configuration (null for ground floor) */
  slab: FloorSlab | null;
}

// =============================================================================
// BUILDING (top-level multi-floor container)
// =============================================================================

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
  staircases: Staircase[];
  /** Currently active floor level for editing */
  activeLevel: number;
}

// =============================================================================
// DEFAULTS & HELPERS
// =============================================================================

export const DEFAULT_FLOOR_TO_FLOOR_HEIGHT = 300; // cm

export const DEFAULT_SLAB: FloorSlab = {
  thickness: 20,
  openings: [],
  topMaterial: 'concrete',
  bottomMaterial: 'plaster',
};

export function createDefaultFloor(level: number, name?: string): Floor {
  return {
    id: uuidv4(),
    level,
    name: name || (level === 0 ? 'Ground Floor' : level > 0 ? `Floor ${level}` : `Basement ${Math.abs(level)}`),
    floorToFloorHeight: DEFAULT_FLOOR_TO_FLOOR_HEIGHT,
    floorPlan: createDefaultFloorPlan(),
    slab: level > 0 ? { ...DEFAULT_SLAB, openings: [] } : null,
  };
}

export function createDefaultBuilding(): Building {
  return {
    id: uuidv4(),
    name: 'New Building',
    floors: [createDefaultFloor(0)],
    staircases: [],
    activeLevel: 0,
  };
}

/**
 * Calculate staircase properties from floor-to-floor height
 */
export function calculateStaircaseGeometry(
  floorToFloorHeight: number,
  type: StaircaseType,
  stairWidth: number = 100,
  treadDepth: number = 28,
): Pick<Staircase, 'numTreads' | 'riserHeight' | 'width' | 'depth'> {
  const idealRiserHeight = 18; // cm — comfortable step height
  const numTreads = Math.round(floorToFloorHeight / idealRiserHeight);
  const riserHeight = floorToFloorHeight / numTreads;

  switch (type) {
    case 'straight': {
      return {
        numTreads,
        riserHeight,
        width: stairWidth,
        depth: numTreads * treadDepth,
      };
    }
    case 'l-shaped': {
      const halfTreads = Math.ceil(numTreads / 2);
      const runLength = halfTreads * treadDepth;
      return {
        numTreads,
        riserHeight,
        width: runLength + stairWidth, // L footprint
        depth: runLength,
      };
    }
    case 'u-shaped': {
      const quarterTreads = Math.ceil(numTreads / 2);
      const runLength = quarterTreads * treadDepth;
      return {
        numTreads,
        riserHeight,
        width: stairWidth * 2 + 10, // two parallel runs + gap
        depth: runLength,
      };
    }
    case 'spiral': {
      const diameter = stairWidth * 2 + 40; // center void + treads
      return {
        numTreads,
        riserHeight,
        width: diameter,
        depth: diameter,
      };
    }
  }
}
