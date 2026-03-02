/**
 * Unified Fixture Types
 * 
 * Single source of truth for all fixture definitions.
 * Consolidates the old Fixture (floorPlan.ts) and MEPFixture (mep.ts) types.
 * 
 * KEY DESIGN DECISIONS:
 * - Uses center-based position: Point2D (not cx/cy)
 * - Uses nested dimensions: Dimensions { width, depth, height }
 * - MEP-specific fields are optional for non-MEP fixtures
 * - Connection types are unified
 */

import type { Point2D, Point3D, Dimensions, SimpleClearance } from '@/types/geometry';

// =============================================================================
// FIXTURE CATEGORIES & TYPES
// =============================================================================

/**
 * Fixture categories for grouping
 */
export type FixtureCategory = 
  | 'bathroom'
  | 'kitchen'
  | 'laundry'
  | 'utility'
  | 'general';

/**
 * All fixture types supported by the system
 */
export type FixtureType =
  // Bathroom
  | 'toilet'
  | 'sink'
  | 'shower'
  | 'bathtub'
  | 'bidet'
  | 'mirror'
  | 'cabinet'
  // Kitchen
  | 'kitchen-sink'
  | 'dishwasher'
  | 'garbage-disposal'
  | 'stove'
  | 'refrigerator'
  | 'island'
  // Laundry
  | 'washing-machine'
  | 'utility-sink'
  // Utility
  | 'floor-drain'
  | 'hose-bib'
  // General (furniture-like, no MEP connections)
  | 'table'
  | 'chair'
  | 'sofa'
  | 'bed'
  | 'wardrobe';

// =============================================================================
// CONNECTION TYPES
// =============================================================================

/**
 * MEP system types for connections
 */
export type MEPSystemType = 
  | 'cold-water'
  | 'hot-water'
  | 'drainage'
  | 'vent'
  | 'power'
  | 'lighting'
  | 'dedicated';

/**
 * Plumbing system subset
 */
export type PlumbingSystemType = 'cold-water' | 'hot-water' | 'drainage' | 'vent';

/**
 * Electrical system subset
 */
export type ElectricalSystemType = 'power' | 'lighting' | 'dedicated';

/**
 * Where a connection prefers to route
 */
export type ConnectionTarget = 'wall' | 'floor' | 'ceiling';

/**
 * Unified connection point for fixtures
 * Works for both plumbing and electrical
 */
export interface FixtureConnection {
  id: string;
  
  /** System type this connection belongs to */
  systemType: MEPSystemType;
  
  /** Position relative to fixture center (in cm) */
  localPosition: Point3D;
  
  /** Preferred routing target */
  targetPreference?: ConnectionTarget;
  
  /** Allowed routing targets */
  allowedTargets?: ConnectionTarget[];
  
  /** Default side for this connection (for routing hints) */
  defaultSide?: 'back' | 'left' | 'right' | 'bottom' | 'top';
  
  /** Is this connection required for the fixture to function? */
  isRequired: boolean;
  
  /** For electrical: wattage requirement */
  wattage?: number;
  
  /** Calculated pipe diameter (inches) - set by routing system */
  pipeSize?: number;
  
  /** Calculated wire gauge (AWG) - set by routing system */
  wireGauge?: number;
  
  /** Height from floor in cm (for legacy compatibility) */
  heightFromFloor?: number;
}

// =============================================================================
// WALL ANCHORING
// =============================================================================

/**
 * How a fixture is anchored to walls
 */
export type FixtureAnchorMode = 'free' | 'single-wall' | 'corner';

// =============================================================================
// UNIFIED FIXTURE TYPE
// =============================================================================

/**
 * Unified Fixture type - the single source of truth
 * 
 * This replaces both:
 * - Fixture from floorPlan.ts (which used cx/cy)
 * - MEPFixture from mep.ts (which used position: Point2D)
 */
export interface UnifiedFixture {
  id: string;
  
  /** Fixture type identifier */
  type: FixtureType;
  
  /** Category for grouping */
  category: FixtureCategory;
  
  /** Display name */
  name?: string;
  
  // =========================================================================
  // POSITION & DIMENSIONS (center-based)
  // =========================================================================
  
  /** Center position in floor plan (cm) */
  position: Point2D;
  
  /** Rotation in degrees (counter-clockwise from positive X) */
  rotation: number;
  
  /** Physical dimensions (cm) */
  dimensions: Dimensions;
  
  // =========================================================================
  // CONNECTIONS
  // =========================================================================
  
  /** All MEP connection points */
  connections: FixtureConnection[];
  
  // =========================================================================
  // MEP VALUES (optional for non-MEP fixtures)
  // =========================================================================
  
  /** Drainage Fixture Units (IPC Table 709.1) */
  dfu?: number;
  
  /** Gallons per minute (water demand) */
  gpm?: number;
  
  /** Electrical load in watts */
  wattage?: number;
  
  // =========================================================================
  // CLEARANCE & PLACEMENT
  // =========================================================================
  
  /** Required clearance zones */
  clearance?: SimpleClearance;
  
  /** Does this fixture require a wall behind it? */
  requiresWall?: boolean;
  
  /** Distance from wall when placed (cm) */
  wallOffset?: number;
  
  // =========================================================================
  // WALL ANCHORING
  // =========================================================================
  
  /** Current anchor mode */
  anchorMode?: FixtureAnchorMode;
  
  /** Primary anchored wall ID */
  anchoredToWallId?: string;
  
  /** Secondary wall ID (for corner anchoring) */
  secondaryWallId?: string;
  
  // =========================================================================
  // INSTALLATION HEIGHTS
  // =========================================================================
  
  /** Trap height from floor (cm) - for drainage */
  trapHeight?: number;
  
  /** Supply height from floor (cm) - for water supply */
  supplyHeight?: number;
  
  // =========================================================================
  // CIRCUIT ASSIGNMENT
  // =========================================================================
  
  /** Assigned electrical circuit ID */
  circuitId?: string;
  
  // =========================================================================
  // 3D MODEL
  // =========================================================================
  
  /** URL to 3D model (GLB/GLTF) */
  modelUrl?: string;
  
  /** URL to thumbnail image */
  thumbnailUrl?: string;
}

// =============================================================================
// FIXTURE TEMPLATE (for creating new fixtures)
// =============================================================================

/**
 * Template for creating fixtures
 * Used in fixture library and database
 */
export interface FixtureTemplate {
  type: FixtureType;
  category: FixtureCategory;
  name: string;
  
  /** Physical dimensions (cm) */
  dimensions: Dimensions;
  
  /** Required clearance zones */
  clearance: SimpleClearance;
  
  /** Does this fixture require a wall? */
  requiresWall: boolean;
  
  /** Distance from wall when placed (cm) */
  wallOffset: number;
  
  /** Trap height from floor (cm) */
  trapHeight: number;
  
  /** Supply height from floor (cm) */
  supplyHeight: number;
  
  /** Electrical load in watts */
  wattage: number;
  
  /** Connection point templates */
  connectionTemplates: Array<{
    systemType: MEPSystemType;
    localPosition: Point3D;
    targetPreference?: ConnectionTarget;
    allowedTargets?: ConnectionTarget[];
    defaultSide?: 'back' | 'left' | 'right' | 'bottom' | 'top';
    isRequired: boolean;
    wattage?: number;
  }>;
  
  /** Lucide icon name */
  icon?: string;
  
  /** URL to 3D model */
  modelUrl?: string;
  
  /** URL to thumbnail */
  thumbnailUrl?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

import { v4 as uuidv4 } from 'uuid';

/**
 * Create a fixture from a template
 */
export function createFixtureFromTemplate(
  template: FixtureTemplate,
  position: Point2D,
  rotation: number = 0
): UnifiedFixture {
  const connections: FixtureConnection[] = template.connectionTemplates.map(ct => ({
    id: uuidv4(),
    systemType: ct.systemType,
    localPosition: { ...ct.localPosition },
    targetPreference: ct.targetPreference,
    allowedTargets: ct.allowedTargets,
    defaultSide: ct.defaultSide,
    isRequired: ct.isRequired,
    wattage: ct.wattage,
    heightFromFloor: ct.localPosition.z,
  }));
  
  return {
    id: uuidv4(),
    type: template.type,
    category: template.category,
    name: template.name,
    position,
    rotation,
    dimensions: { ...template.dimensions },
    connections,
    clearance: { ...template.clearance },
    requiresWall: template.requiresWall,
    wallOffset: template.wallOffset,
    trapHeight: template.trapHeight,
    supplyHeight: template.supplyHeight,
    wattage: template.wattage,
    anchorMode: 'free',
    modelUrl: template.modelUrl,
    thumbnailUrl: template.thumbnailUrl,
  };
}

/**
 * Check if a fixture has plumbing connections
 */
export function hasPlumbingConnections(fixture: UnifiedFixture): boolean {
  return fixture.connections.some(c => 
    c.systemType === 'cold-water' || 
    c.systemType === 'hot-water' || 
    c.systemType === 'drainage' ||
    c.systemType === 'vent'
  );
}

/**
 * Check if a fixture has electrical connections
 */
export function hasElectricalConnections(fixture: UnifiedFixture): boolean {
  return fixture.connections.some(c => 
    c.systemType === 'power' || 
    c.systemType === 'lighting' || 
    c.systemType === 'dedicated'
  );
}

/**
 * Get connections by system type
 */
export function getConnectionsBySystem(
  fixture: UnifiedFixture, 
  systemType: MEPSystemType
): FixtureConnection[] {
  return fixture.connections.filter(c => c.systemType === systemType);
}

/**
 * Get the world position of a connection point
 */
export function getConnectionWorldPosition(
  fixture: UnifiedFixture,
  connection: FixtureConnection
): Point3D {
  const rad = (fixture.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Rotate local position around fixture center
  const rotatedX = connection.localPosition.x * cos - connection.localPosition.y * sin;
  const rotatedY = connection.localPosition.x * sin + connection.localPosition.y * cos;
  
  return {
    x: fixture.position.x + rotatedX,
    y: fixture.position.y + rotatedY,
    z: connection.localPosition.z,
  };
}

// =============================================================================
// DEFAULT CONNECTION HEIGHTS
// =============================================================================

/**
 * Default heights for different fixture/connection types (in cm)
 */
export const DEFAULT_CONNECTION_HEIGHTS: Record<string, number> = {
  // Toilet
  'toilet-cold-water': 20,
  'toilet-drainage': 0,
  // Sink
  'sink-cold-water': 55,
  'sink-hot-water': 55,
  'sink-drainage': 45,
  // Shower
  'shower-cold-water': 120,
  'shower-hot-water': 120,
  'shower-drainage': 0,
  // Bathtub
  'bathtub-cold-water': 45,
  'bathtub-hot-water': 45,
  'bathtub-drainage': 10,
  // Bidet
  'bidet-cold-water': 35,
  'bidet-hot-water': 35,
  'bidet-drainage': 25,
  // Kitchen sink
  'kitchen-sink-cold-water': 55,
  'kitchen-sink-hot-water': 55,
  'kitchen-sink-drainage': 45,
  // Electrical defaults
  'outlet-general': 30,
  'outlet-counter': 110,
  'switch': 110,
  'light': 220,
};

// =============================================================================
// BACKWARD COMPATIBILITY TYPES
// =============================================================================

/**
 * Legacy Fixture type alias (for gradual migration)
 * @deprecated Use UnifiedFixture instead
 */
export type Fixture = UnifiedFixture;

/**
 * Legacy MEPFixture type alias (for gradual migration)
 * @deprecated Use UnifiedFixture instead
 */
export type MEPFixture = UnifiedFixture;
