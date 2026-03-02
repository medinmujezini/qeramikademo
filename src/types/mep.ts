/**
 * MEP (Mechanical, Electrical, Plumbing) Type Definitions
 * 
 * Comprehensive type system for professional-grade MEP design.
 * Based on IPC (International Plumbing Code) and NEC (National Electrical Code).
 */

// =============================================================================
// CORE GEOMETRY TYPES - Imported from unified geometry module
// =============================================================================

import type { Point2D, Point3D, Dimensions } from './geometry';
export type { Point2D, Point3D, Dimensions };

// =============================================================================
// SYSTEM TYPES
// =============================================================================

export type PlumbingSystemType = 
  | 'cold-water'
  | 'hot-water'
  | 'drainage'
  | 'vent';

export type ElectricalSystemType = 
  | 'power'
  | 'lighting'
  | 'dedicated';  // For appliances like dishwashers

export type MEPSystemType = PlumbingSystemType | ElectricalSystemType;

// =============================================================================
// FIXTURE TYPES
// =============================================================================

export type FixtureCategory = 
  | 'bathroom'
  | 'kitchen'
  | 'laundry'
  | 'utility';

export type FixtureType =
  // Bathroom
  | 'toilet'
  | 'sink'
  | 'shower'
  | 'bathtub'
  | 'bidet'
  // Kitchen
  | 'kitchen-sink'
  | 'dishwasher'
  | 'garbage-disposal'
  // Laundry
  | 'washing-machine'
  | 'utility-sink'
  // Utility
  | 'floor-drain'
  | 'hose-bib';

export interface FixtureConnection {
  id: string;
  systemType: MEPSystemType;
  localPosition: Point3D;        // Position relative to fixture center
  pipeSize?: number;             // Calculated pipe diameter (inches)
  wireGauge?: number;            // Calculated wire gauge (AWG)
  isRequired: boolean;
}

export interface MEPFixture {
  id: string;
  type: FixtureType;
  category: FixtureCategory;
  name: string;                  // Display name
  
  // Position in floor plan
  position: Point2D;             // Center position
  rotation: number;              // Degrees
  
  // Physical dimensions
  dimensions: Dimensions;
  
  // Code-based values
  dfu: number;                   // Drainage Fixture Units (IPC Table 709.1)
  gpm: number;                   // Gallons per minute (water demand)
  wattage: number;               // Electrical load (watts)
  
  // Clearance requirements (code minimums)
  clearance: {
    front: number;               // Clearance in front of fixture
    sides: number;               // Clearance on sides
    rear: number;                // Clearance behind
  };
  
  // Wall mounting
  requiresWall: boolean;
  wallOffset: number;            // Distance from wall when placed
  
  // Connection points
  connections: FixtureConnection[];
  
  // Installation height (floor to connection)
  trapHeight?: number;           // For drainage (cm from floor)
  supplyHeight?: number;         // For water supply (cm from floor)
  
  // Assigned circuit (electrical)
  circuitId?: string;
}

// =============================================================================
// ROUTE SEGMENT TYPES
// =============================================================================

export type FittingType =
  | 'elbow-90'
  | 'elbow-45'
  | 'tee'
  | 'wye'
  | 'sanitary-tee'
  | 'coupling'
  | 'reducer'
  | 'cap'
  | 'cleanout'
  | 'p-trap'
  | 'valve-gate'
  | 'valve-ball'
  | 'valve-check';

export interface MEPSegment {
  id: string;
  routeId: string;
  segmentIndex: number;
  
  systemType: MEPSystemType;
  
  // Geometry
  startPoint: Point3D;
  endPoint: Point3D;
  
  // Sizing
  size: number;                  // Pipe diameter (inches) or wire gauge (AWG)
  material: string;              // PVC, copper, PEX, CPVC, etc.
  
  // For drainage
  slope?: number;                // Fall per foot (inches)
  
  // Segment orientation (for 3D routing)
  orientation?: 'horizontal' | 'vertical' | 'sloped';
  
  // Fittings at segment ends
  fittingAtStart?: FittingType;
  fittingAtEnd?: FittingType;
  
  // Visual
  color?: string;
}

// =============================================================================
// ROUTE TYPES
// =============================================================================

export interface MEPRoute {
  id: string;
  systemType: MEPSystemType;
  
  // Route composition
  segments: MEPSegment[];
  
  // Source and destination
  source: {
    type: 'main' | 'branch' | 'node';
    nodeId: string;
  };
  destination: {
    type: 'fixture' | 'node';
    id: string;
  };
  
  // Calculated values
  totalLength: number;           // Total length in cm
  totalDFU: number;              // Accumulated DFU for drainage
  requiredSize: number;          // Calculated minimum size
  
  // Elevation data
  elevation: {
    start: number;
    end: number;
  };
  
  // Validation status
  isValid: boolean;
  validationErrors: string[];
}

// =============================================================================
// INFRASTRUCTURE NODES
// =============================================================================

export type NodeType =
  // Water
  | 'water-main'
  | 'water-heater'
  | 'water-manifold'
  // Drainage
  | 'drain-stack'
  | 'vent-stack'
  | 'wet-vent-stack'
  | 'stack-base'
  | 'stack-through-roof'
  | 'floor-cleanout'
  // Electrical
  | 'electrical-panel'
  | 'junction-box'
  | 'sub-panel';

export type MountingType = 'floor' | 'wall' | 'ceiling' | 'underground';

export type WaterHeaterType = 'tank' | 'tankless' | 'point-of-use';
export type FuelType = 'electric' | 'gas' | 'solar';

// Water heater specific properties
export interface WaterHeaterProps {
  type: WaterHeaterType;
  capacity: number;              // Gallons for tank, GPM for tankless
  inletHeight: number;           // Cold water inlet height (cm from floor)
  outletHeight: number;          // Hot water outlet height (cm from floor)
  fuelType: FuelType;
}

// Stack-specific properties for vertical drain/vent stacks
export interface StackProperties {
  bottomElevation: number;       // Floor level (cm from floor 0)
  topElevation: number;          // Ceiling or roof level
  diameter: number;              // Stack pipe size (inches)
  isVentTermination?: boolean;   // True if stack terminates through roof
}

export interface MEPNode {
  id: string;
  type: NodeType;
  name: string;
  
  position: Point3D;
  
  // Mounting configuration
  mountingType?: MountingType;
  heightFromFloor?: number;        // cm - distance above floor (for floor/wall mounted)
  heightFromCeiling?: number;      // cm - distance below ceiling (for ceiling mounted)
  penetratesFloor?: boolean;       // For stacks and mains
  penetratesCeiling?: boolean;     // For vent stacks
  
  // Capacity
  capacity?: number;             // GPM for water, DFU for drain, Amps for electrical
  
  // Connected routes
  connectedRouteIds: string[];
  
  // For electrical panels
  circuitCount?: number;
  mainBreakerSize?: number;      // Amps
  
  // For vertical stacks
  stackProperties?: StackProperties;
  
  // For water heaters
  waterHeaterProps?: WaterHeaterProps;
}

// =============================================================================
// CLASH DETECTION
// =============================================================================

export interface MEPClash {
  id: string;
  type: 'hard' | 'soft';         // Hard = physical collision, Soft = clearance violation
  
  // Elements involved
  element1: {
    type: 'route' | 'fixture' | 'node';
    id: string;
    systemType: MEPSystemType;
  };
  element2: {
    type: 'route' | 'fixture' | 'node';
    id: string;
    systemType: MEPSystemType;
  };
  
  // Location
  position: Point3D;
  
  // Severity
  severity: 'critical' | 'warning' | 'info';
  
  // Suggested resolution
  resolution?: string;
  canAutoResolve: boolean;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  id: string;
  category: 'slope' | 'size' | 'clearance' | 'connection' | 'code';
  message: string;
  elementId: string;
  elementType: 'fixture' | 'route' | 'segment' | 'node';
  codeReference?: string;        // e.g., "IPC 704.1"
}

export interface ValidationWarning {
  id: string;
  category: string;
  message: string;
  elementId: string;
  elementType: 'fixture' | 'route' | 'segment' | 'node';
}

// =============================================================================
// ELECTRICAL CIRCUITS
// =============================================================================

export interface ElectricalCircuit {
  id: string;
  name: string;
  panelId: string;
  breakerPosition: number;
  
  // Circuit specs
  voltage: 120 | 240;
  amperage: number;              // Breaker size
  wireGauge: number;             // AWG
  
  // Load calculation
  connectedFixtures: string[];   // Fixture IDs
  totalLoad: number;             // Watts
  demandLoad: number;            // After demand factors
  
  // Type
  circuitType: 'general' | 'dedicated' | 'lighting';
}

// =============================================================================
// MEP SYSTEM STATE
// =============================================================================

export interface MEPSystemState {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  circuits: ElectricalCircuit[];
  clashes: MEPClash[];
  
  // Layer visibility
  layerVisibility: {
    coldWater: boolean;
    hotWater: boolean;
    drainage: boolean;
    vent: boolean;
    electrical: boolean;
    fixtures: boolean;
  };
  
  // Routing settings
  routingConfig: {
    preferWallHugging: boolean;
    maxBends: number;
    minClearance: number;
    autoSize: boolean;
  };
}

// =============================================================================
// ROUTING TYPES
// =============================================================================

export interface RoutingRequest {
  fixtureId: string;
  connectionId: string;
  targetNodeId: string;
  systemType: MEPSystemType;
  priority: number;              // Lower = route first
}

export interface RoutingResult {
  route: MEPRoute | null;
  success: boolean;
  message?: string;
  clashesAvoided: number;
  fallbackUsed: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SYSTEM_COLORS: Record<MEPSystemType, string> = {
  'cold-water': '#3B82F6',       // Blue
  'hot-water': '#EF4444',        // Red
  'drainage': '#22C55E',         // Green
  'vent': '#06B6D4',             // Cyan
  'power': '#F59E0B',            // Amber
  'lighting': '#FBBF24',         // Yellow
  'dedicated': '#F97316',        // Orange
};

export const SYSTEM_PRIORITY: Record<MEPSystemType, number> = {
  'drainage': 1,                 // Route first (needs slope, largest pipes)
  'vent': 2,
  'hot-water': 3,
  'cold-water': 4,
  'dedicated': 5,
  'power': 6,
  'lighting': 7,
};

export const DEFAULT_PIPE_MATERIALS: Record<PlumbingSystemType, string> = {
  'cold-water': 'PEX',
  'hot-water': 'PEX',
  'drainage': 'PVC',
  'vent': 'PVC',
};

export const MIN_CLEARANCES: Record<MEPSystemType, number> = {
  'cold-water': 5,               // cm between parallel runs
  'hot-water': 5,
  'drainage': 10,
  'vent': 5,
  'power': 15,                   // Greater clearance from plumbing
  'lighting': 15,
  'dedicated': 15,
};

// =============================================================================
// STRUCTURAL OBSTRUCTIONS
// =============================================================================

/**
 * Types of structural elements that pipes cannot pass through
 */
export type ObstructionType = 
  | 'structural-column'    // Cannot penetrate under any circumstances
  | 'load-bearing-wall'    // Limited penetration with proper sleeves
  | 'beam'                 // Horizontal structural element
  | 'joist-zone'           // Area where joists run (parallel routing only)
  | 'no-drill-zone'        // User-defined exclusion area
  | 'post-tension-cable';  // Embedded cables in slab (critical no-go)

/**
 * Represents a structural element that pipes must route around
 */
export interface StructuralObstruction {
  id: string;
  type: ObstructionType;
  
  // Geometry - supports various shapes
  geometry: {
    type: 'polygon' | 'circle' | 'rectangle';
    points?: Point2D[];       // For polygon (vertices)
    center?: Point2D;         // For circle/rectangle (center point)
    radius?: number;          // For circle
    width?: number;           // For rectangle
    depth?: number;           // For rectangle
    rotation?: number;        // For rectangle (degrees)
  };
  
  // Vertical extent - defines what Z levels are blocked
  zRange: {
    bottom: number;           // Bottom of obstruction (cm from floor)
    top: number;              // Top of obstruction (cm from floor)
  };
  
  // Required clearance from this obstruction
  bufferDistance: number;     // Minimum distance pipes must maintain (cm)
  
  // Penetration rules
  allowsPenetration: boolean; // Can pipes pass through with sleeve?
  maxPenetrationSize?: number; // Maximum pipe size allowed if penetrable (inches)
}

// =============================================================================
// FLOOR CONSTRUCTION & UNDERGROUND ROUTING
// =============================================================================

/**
 * Types of floor construction affecting drainage routing
 */
export type FloorConstructionType = 
  | 'slab-on-grade'        // Drainage runs UNDER the slab
  | 'raised-floor'         // Drainage runs in crawl space or between floors
  | 'basement'             // Drainage runs along basement ceiling, then down
  | 'suspended-slab';      // Multi-story with drainage in interstitial space

/**
 * Configuration for floor/slab construction
 */
export interface FloorConfiguration {
  constructionType: FloorConstructionType;
  slabThickness: number;           // Thickness of concrete slab (cm), typically 10-15
  underSlabDepth: number;          // Available depth under slab for pipes (cm)
  
  // Slab details
  hasRebar: boolean;               // Standard rebar reinforcement
  hasPostTension: boolean;         // Post-tension cables (critical no-drill zones)
  postTensionZones?: Point2D[][];  // Polygon paths of PT cable zones
  
  // Soil conditions (affects under-slab routing difficulty)
  soilType?: 'sand' | 'clay' | 'rock' | 'mixed';
  waterTableDepth?: number;        // Depth to water table (cm) - affects deep routing
}

/**
 * Defines vertical routing zones and what systems can use them
 */
export interface RoutingZone {
  name: string;
  minZ: number;                    // Bottom elevation (cm)
  maxZ: number;                    // Top elevation (cm)
  allowedSystems: MEPSystemType[]; // Systems that can route in this zone
  description: string;             // Human-readable description
}

/**
 * Tracks where a pipe penetrates the slab
 */
export interface SlabPenetration {
  id: string;
  position: Point2D;               // X/Y location of penetration
  direction: 'up' | 'down';        // Pipe going up or down through slab
  pipeSize: number;                // Pipe diameter (inches)
  systemType: MEPSystemType;       // Which system this pipe serves
  sleeveRequired: boolean;         // Does this need a waterproof sleeve?
  sleeveSize?: number;             // Sleeve size if required (inches)
  fixtureId?: string;              // Associated fixture if any
  routeId?: string;                // Associated route
}

/**
 * Extended routing configuration with obstruction and floor data
 */
export interface ExtendedRoutingConfig {
  // Canvas bounds
  canvasWidth: number;
  canvasHeight: number;
  
  // Wall data (for wall-following)
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  
  // Structural elements to avoid
  obstructions: StructuralObstruction[];
  
  // Floor/slab configuration
  floorConfig: FloorConfiguration;
  
  // Vertical dimensions
  floorHeight: number;             // Floor level (usually 0)
  ceilingHeight: number;           // Ceiling height (cm)
  
  // Routing preferences
  preferWallFollowing: boolean;
  preferUnderSlab: boolean;        // For drainage, prefer under-slab routing
  
  // Pre-calculated routing zones
  routingZones?: RoutingZone[];
}

// =============================================================================
// DEFAULT CONFIGURATIONS
// =============================================================================

export const DEFAULT_FLOOR_CONFIG: FloorConfiguration = {
  constructionType: 'slab-on-grade',
  slabThickness: 12,               // 12cm (~5 inches) typical
  underSlabDepth: 45,              // 45cm available under slab
  hasRebar: true,
  hasPostTension: false,
  soilType: 'mixed',
};

/**
 * Create standard routing zones based on floor configuration
 */
export function createRoutingZones(
  floorConfig: FloorConfiguration,
  ceilingHeight: number = 280
): RoutingZone[] {
  const zones: RoutingZone[] = [];
  
  // Above-slab zone (floor level to ceiling)
  zones.push({
    name: 'Above Slab',
    minZ: 0,
    maxZ: ceilingHeight,
    allowedSystems: ['cold-water', 'hot-water', 'drainage', 'vent', 'power', 'lighting', 'dedicated'],
    description: 'Standard living space - all systems allowed',
  });
  
  // In-slab zone (NO ROUTING ALLOWED)
  zones.push({
    name: 'In Slab',
    minZ: -floorConfig.slabThickness,
    maxZ: 0,
    allowedSystems: [], // Nothing can route through concrete
    description: 'Concrete slab - no routing allowed',
  });
  
  // Under-slab zone (only for slab-on-grade)
  if (floorConfig.constructionType === 'slab-on-grade') {
    zones.push({
      name: 'Under Slab',
      minZ: -floorConfig.slabThickness - floorConfig.underSlabDepth,
      maxZ: -floorConfig.slabThickness,
      allowedSystems: ['drainage'], // Only drainage in soil
      description: 'Below slab - drainage only (in soil)',
    });
  }
  
  return zones;
}
