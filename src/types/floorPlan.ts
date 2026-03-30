import { v4 as uuidv4 } from 'uuid';

export interface Point {
  id: string;
  x: number;
  y: number;
}

// Height mode: 'room' follows ceiling plane, 'override' uses manual values
export type WallHeightMode = 'room' | 'override';

export interface Wall {
  id: string;
  startPointId: string;
  endPointId: string;
  thickness: number;
  material: WallMaterial;
  height: number;
  // Curved wall properties
  isCurved?: boolean;
  bulge?: number; // -1 to 1, negative = curve left, positive = curve right
  // Sloped wall heights (optional)
  startHeight?: number; // Height at start point (defaults to `height`)
  endHeight?: number; // Height at end point (defaults to `height`)
  // Enhanced slope options
  slopeAngle?: number; // Degrees (0-90) - for angle-based input mode
  slopeDirection?: 'ascending' | 'descending'; // Direction of slope
  slopeMode?: 'height' | 'angle'; // User's preferred input mode
  // Height mode: 'room' follows ceiling plane, 'override' uses manual values
  heightMode?: WallHeightMode;
  // Override values (only used when heightMode === 'override')
  overrideStartHeight?: number;
  overrideEndHeight?: number;
  // Optional: lock individual endpoints
  lockStartHeight?: boolean;
  lockEndHeight?: boolean;
}

export type WallMaterial = 'concrete' | 'brick' | 'drywall' | 'wood';

export interface Door {
  id: string;
  wallId: string;
  position: number; // 0-1, position along the wall
  width: number;
  height: number;
  type: DoorType;
}

export type DoorType = 'hinged-left' | 'hinged-right' | 'sliding' | 'pocket' | 'double';

export interface Window {
  id: string;
  wallId: string;
  position: number; // 0-1, position along the wall
  width: number;
  height: number;
  sillHeight: number;
  type: WindowType;
}

export type WindowType = 'casement' | 'sliding' | 'fixed' | 'double-hung';

// Column types - architectural column shapes
export type ColumnShape = 
  | 'rectangle'    // Default - most common in construction
  | 'square'       // Square (equal width/depth)
  | 'round'        // Circular
  | 'l-shaped'     // L-shape for corners
  | 't-shaped'     // T-shape for walls/partitions
  | 'hexagonal'    // 6-sided polygon
  | 'octagonal';   // 8-sided polygon

export interface Column {
  id: string;
  x: number;
  y: number;
  shape: ColumnShape;
  width: number; // Primary dimension (diameter for round, width for others)
  depth: number; // Secondary dimension (same as width for round/polygonal)
  height: number;
  rotation: number; // Applies to all non-round shapes
  isStructural: boolean; // Structural vs decorative
  material: WallMaterial;
  // Additional dimensions for L and T shapes
  armWidth?: number;   // Width of the arm(s) for L and T shapes
  armLength?: number;  // Length of the arm(s) for L and T shapes
}

// Fixture anchor mode for wall mounting
export type FixtureAnchorMode = 'single-wall' | 'corner' | 'free';

export interface Fixture {
  id: string;
  type: FixtureType;
  cx: number;  // CENTER X position
  cy: number;  // CENTER Y position
  rotation: number;
  width: number;
  depth: number;
  height: number;
  category: FixtureCategory;
  plumbingConnections: PlumbingConnection[];
  electricalConnections: ElectricalConnection[];
  // Wall anchoring
  anchoredToWallId?: string;
  anchorMode?: FixtureAnchorMode;
  secondaryWallId?: string;  // For corner anchoring
  wallOffset?: number;       // Distance from wall face (cm)
}

export type FixtureCategory = 'bathroom' | 'kitchen' | 'general';

export type FixtureType = 
  | 'toilet' | 'bidet' | 'sink' | 'shower' | 'bathtub' | 'mirror' | 'cabinet'
  | 'stove' | 'refrigerator' | 'dishwasher' | 'kitchen-sink' | 'island'
  | 'table' | 'chair' | 'sofa' | 'bed' | 'wardrobe';

// Connection target preference
export type ConnectionTarget = 'wall' | 'floor' | 'ceiling';

export interface PlumbingConnection {
  id: string;
  type: 'water-supply' | 'drainage';
  localX: number;  // Position relative to fixture CENTER
  localY: number;  // Position relative to fixture CENTER
  targetPreference: ConnectionTarget;
  allowedTargets: ConnectionTarget[];
  defaultSide: 'back' | 'left' | 'right' | 'bottom';
  // Height from floor in cm (for elevation views)
  heightFromFloor?: number;
}

export interface ElectricalConnection {
  id: string;
  type: 'outlet' | 'switch' | 'light';
  localX: number;  // Position relative to fixture CENTER
  localY: number;  // Position relative to fixture CENTER
  wattage: number;
  targetPreference: ConnectionTarget;
  // Height from floor in cm (for elevation views)
  heightFromFloor?: number;
}

// Default heights for different fixture/connection types (in cm)
export const DEFAULT_CONNECTION_HEIGHTS: Record<string, number> = {
  // Toilet
  'toilet-water-supply': 20,
  'toilet-drainage': 0,
  // Sink
  'sink-water-supply': 55,
  'sink-drainage': 45,
  // Shower
  'shower-water-supply': 100,
  'shower-drainage': 0,
  // Bathtub
  'bathtub-water-supply': 50,
  'bathtub-drainage': 0,
  // Bidet
  'bidet-water-supply': 25,
  'bidet-drainage': 0,
  // Kitchen sink
  'kitchen-sink-water-supply': 55,
  'kitchen-sink-drainage': 45,
  // Electrical defaults
  'outlet-general': 30,
  'outlet-counter': 110,
  'switch': 110,
  'light': 220,
};

// ============================================
// INFRASTRUCTURE NODE TYPES
// These represent the backbone of MEP systems
// ============================================

export type InfrastructureNodeType = 
  | 'water-manifold'      // Water source - distributes to fixtures
  | 'drain-stack'         // Main vertical drain
  | 'drain-collector'     // Horizontal branch collecting from fixtures
  | 'electrical-panel'    // Main power source
  | 'junction-box';       // Electrical distribution point

export interface InfrastructureNode {
  id: string;
  type: InfrastructureNodeType;
  x: number;
  y: number;
  label?: string;
  // For water manifold
  supplyType?: 'hot' | 'cold' | 'both';
  // For drain collector - defines the path from collector to stack
  collectorPath?: { x: number; y: number }[];
  // Connection to parent node (e.g., collector -> stack)
  connectedToNodeId?: string;
}

// ============================================
// ROUTE TYPES - Now with tree topology support
// ============================================

export interface PlumbingRoute {
  id: string;
  fixtureId: string;
  connectionId: string;
  points: Point[];
  type: 'water-supply' | 'drainage';
  pipeSize: number;
  length: number;
  isManual?: boolean;
  lockedPoints?: number[];
  hasWarning?: boolean;
  warningMessage?: string;
  // Tree topology references
  sourceNodeId?: string;      // Infrastructure node it originates from (water)
  targetNodeId?: string;      // Infrastructure node it flows to (drainage)
  isBranchRoute?: boolean;    // True if this is a branch to collector
  isCollectorSegment?: boolean; // True if this is a main collector line
  // Drainage slope information
  slopePercent?: number;      // 1-2% typical for drains
  flowDirection?: 'start-to-end' | 'end-to-start';
  elevationStart?: number;    // Height in cm at route start
  elevationEnd?: number;      // Height in cm at route end
}

export interface ElectricalRoute {
  id: string;
  fixtureId: string;
  connectionId: string;
  points: Point[];
  wireGauge: number;
  length: number;
  isManual?: boolean;
  lockedPoints?: number[];
  hasWarning?: boolean;
  warningMessage?: string;
  // Tree topology references
  sourceNodeId?: string;      // Infrastructure node it originates from (panel)
}

export interface Tile {
  id: string;
  name: string;
  width: number;
  height: number;
  pricePerUnit: number;
  material: string;
  color: string;
  // PBR texture support
  materialId?: string;
  textureScaleCm?: number;
  // Curve compatibility
  minCurveRadius?: number;  // Minimum radius this tile can handle (undefined = flat only)
  isFlexible?: boolean;     // Mosaic/small tiles that flex on curves
}

export type TileTextureUrls = {
  albedo?: string;
  normal?: string;
  roughness?: string;
  ao?: string;
  height?: string;
  metallic?: string;
}

export interface WallTileSection {
  id: string;
  wallId: string;
  tileId: string;
  startPosition: number;
  endPosition: number;
  startHeight: number;
  endHeight: number;
  // New tile layout properties
  orientation: 'horizontal' | 'vertical';
  pattern: 'grid' | 'staggered' | 'herringbone' | 'diagonal';
  offsetX: number;
  offsetY: number;
  groutColor: string;
  // Curved/sloped wall info (calculated from wall)
  isCurvedWall?: boolean;
  curveRadius?: number;
  isSlopedWall?: boolean;
  slopeAngle?: number;
}

export type TileOrientation = 'horizontal' | 'vertical';
export type TilePattern = 'grid' | 'staggered' | 'herringbone' | 'diagonal';

export interface TileCalculation {
  totalTiles: number;
  fullTiles: number;
  cutTiles: CutTile[];
  groutAmount: number; // in kg
  adhesiveAmount: number; // in kg
  siliconeAmount: number; // in ml
}

export interface CutTile {
  originalTileId: string;
  cutWidth: number;
  cutHeight: number;
  count: number;
  cutAngle?: number; // For angled cuts on sloped walls (degrees)
  cutType?: 'straight' | 'angled' | 'triangular'; // Type of cut
  vertices?: { x: number; y: number }[]; // Polygon vertices for complex cuts
  // Builder-friendly edge measurements for angled cuts
  leftEdgeHeight?: number;  // Height of tile at left edge after cutting (cm)
  rightEdgeHeight?: number; // Height of tile at right edge after cutting (cm)
}

export interface MainConnectionPoints {
  waterSupply: { x: number; y: number };
  drainage: { x: number; y: number };
  electrical: { x: number; y: number };
}

export interface ConnectionStatus {
  fixtureId: string;
  waterSupply: 'connected' | 'warning' | 'error';
  drainage: 'connected' | 'warning' | 'error';
  electrical: 'connected' | 'warning' | 'error';
  supplyLength: number;
  drainLength: number;
  electricalLength: number;
}

// Ceiling plane definition - room-level source of truth for wall heights
export interface CeilingPlane {
  enabled: boolean;
  direction: { x: number; y: number };  // Unit vector for slope direction
  pitch: number;                         // Angle in degrees (0-90)
  baseHeight: number;                    // Height at reference point
  referencePoint: { x: number; y: number }; // Anchor point in plan coords
}

export const DEFAULT_CEILING_PLANE: CeilingPlane = {
  enabled: false,
  direction: { x: 1, y: 0 },  // Default: slope along X-axis
  pitch: 0,                    // No slope by default
  baseHeight: 280,             // Standard ceiling height
  referencePoint: { x: 0, y: 0 }
};

// Wall's relation to the ceiling slope (for rendering mode)
export type WallSlopeRelation = 'parallel' | 'perpendicular' | 'oblique' | 'none';

// ===========================================
// WALL & FLOOR SURFACE FINISH TYPES
// ===========================================

export type WallSurfaceType = 'plain' | 'paint' | 'wallpaper' | 'tiles';
export type FloorSurfaceType = 'plain' | 'tiles' | 'hardwood' | 'carpet';

export interface WallFinish {
  id: string;
  wallId: string;
  surfaceType: WallSurfaceType;
  // For paint
  color?: string;
  // For wallpaper
  patternId?: string;
  // For tiles
  tileId?: string;
  groutColor?: string;
  pattern?: TilePattern;
  jointWidth?: number;        // Joint width in mm (1-10)
  orientation?: TileOrientation; // Tile orientation
  offsetX?: number;           // Horizontal offset in cm
  offsetY?: number;           // Vertical offset in cm
  // Cached tile properties (for 3D rendering when DB lookup fails)
  tileWidth?: number;
  tileHeight?: number;
  tileColor?: string;
  tileMaterial?: string;
}

export interface FloorFinish {
  id: string;
  surfaceType: FloorSurfaceType;
  color?: string;
  tileId?: string;
  pattern?: TilePattern;
  groutColor?: string;
  materialId?: string;
  textureScaleCm?: number;
}

// Paint color presets
export const PAINT_COLORS = [
  { id: 'white', name: 'Pure White', color: '#ffffff' },
  { id: 'cream', name: 'Cream', color: '#fdf5e6' },
  { id: 'ivory', name: 'Ivory', color: '#fffff0' },
  { id: 'light-gray', name: 'Light Gray', color: '#e5e7eb' },
  { id: 'warm-gray', name: 'Warm Gray', color: '#d6d3d1' },
  { id: 'cool-gray', name: 'Cool Gray', color: '#9ca3af' },
  { id: 'sage', name: 'Sage Green', color: '#9caf88' },
  { id: 'dusty-blue', name: 'Dusty Blue', color: '#8faabe' },
  { id: 'blush', name: 'Blush Pink', color: '#e8c4c4' },
  { id: 'taupe', name: 'Taupe', color: '#b8a99a' },
  { id: 'navy', name: 'Navy Blue', color: '#1e3a5f' },
  { id: 'charcoal', name: 'Charcoal', color: '#374151' },
] as const;

// Wallpaper pattern presets
export const WALLPAPER_PATTERNS = [
  { id: 'stripes-gray', name: 'Gray Stripes', pattern: 'stripes', baseColor: '#e5e7eb', accentColor: '#9ca3af' },
  { id: 'stripes-blue', name: 'Blue Stripes', pattern: 'stripes', baseColor: '#dbeafe', accentColor: '#93c5fd' },
  { id: 'damask-gold', name: 'Gold Damask', pattern: 'damask', baseColor: '#fef3c7', accentColor: '#d4af37' },
  { id: 'damask-silver', name: 'Silver Damask', pattern: 'damask', baseColor: '#f3f4f6', accentColor: '#9ca3af' },
  { id: 'geometric', name: 'Geometric', pattern: 'geometric', baseColor: '#f9fafb', accentColor: '#6b7280' },
  { id: 'floral-soft', name: 'Soft Floral', pattern: 'floral', baseColor: '#fdf2f8', accentColor: '#f9a8d4' },
  { id: 'herringbone', name: 'Herringbone', pattern: 'herringbone', baseColor: '#f5f5f4', accentColor: '#a8a29e' },
  { id: 'moroccan', name: 'Moroccan', pattern: 'moroccan', baseColor: '#ecfdf5', accentColor: '#6ee7b7' },
] as const;

export interface FloorPlan {
  id: string;
  name: string;
  points: Point[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  fixtures: Fixture[];
  columns: Column[];
  plumbingRoutes: PlumbingRoute[];
  electricalRoutes: ElectricalRoute[];
  tileSections: WallTileSection[];
  mainConnections: MainConnectionPoints;
  // Infrastructure nodes for tree-based MEP routing
  infrastructureNodes: InfrastructureNode[];
  roomWidth: number;
  roomHeight: number;
  wallHeight: number;
  /** Uniform scale factor: pixels per centimeter */
  pxPerCm?: number;
  /** Canvas origin offset for centering the room */
  originPx?: { x: number; y: number };
  // Ceiling plane - room-level source of truth for heights
  ceilingPlane?: CeilingPlane;
  // Wall surface finishes (paint/wallpaper)
  wallFinishes?: WallFinish[];
  // Floor finish
  floorFinish?: FloorFinish;
  // Room lights (rect lights that export to Unreal)
  roomLights?: RoomLight[];
  // Saved camera viewpoints
  savedCameraViews?: SavedCameraView[];
}

// Room light for ceiling-mounted rect lights
export interface RoomLight {
  id: string;
  /** Center X position in cm (plan coords) */
  cx: number;
  /** Center Y position in cm (plan coords) */
  cy: number;
  /** Width in cm */
  width: number;
  /** Depth in cm */
  depth: number;
  /** Rotation in degrees */
  rotation: number;
  /** Light intensity (0-10) */
  intensity: number;
  /** Light color hex */
  color: string;
  /** Whether the light is on */
  enabled: boolean;
}

export interface SavedCameraView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const DEFAULT_MAIN_CONNECTIONS: MainConnectionPoints = {
  waterSupply: { x: 0, y: 100 },
  drainage: { x: 0, y: 150 },
  electrical: { x: 0, y: 50 },
};

export const createDefaultFloorPlan = (): FloorPlan => {
  // Create a simple rectangular room with 4 walls
  const p1Id = uuidv4();
  const p2Id = uuidv4();
  const p3Id = uuidv4();
  const p4Id = uuidv4();
  
  const defaultPoints: Point[] = [
    { id: p1Id, x: 100, y: 100 },
    { id: p2Id, x: 700, y: 100 },
    { id: p3Id, x: 700, y: 500 },
    { id: p4Id, x: 100, y: 500 },
  ];
  
  const defaultWalls: Wall[] = [
    { id: uuidv4(), startPointId: p1Id, endPointId: p2Id, thickness: 15, material: 'drywall', height: 280, heightMode: 'room' }, // Top wall
    { id: uuidv4(), startPointId: p2Id, endPointId: p3Id, thickness: 15, material: 'drywall', height: 280, heightMode: 'room' }, // Right wall
    { id: uuidv4(), startPointId: p3Id, endPointId: p4Id, thickness: 15, material: 'drywall', height: 280, heightMode: 'room' }, // Bottom wall
    { id: uuidv4(), startPointId: p4Id, endPointId: p1Id, thickness: 15, material: 'drywall', height: 280, heightMode: 'room' }, // Left wall
  ];
  
  return {
    id: uuidv4(),
    name: 'New Project',
    points: defaultPoints,
    walls: defaultWalls,
    doors: [],
    windows: [],
    fixtures: [],
    columns: [],
    plumbingRoutes: [],
    electricalRoutes: [],
    tileSections: [],
    mainConnections: { ...DEFAULT_MAIN_CONNECTIONS },
    infrastructureNodes: [],
    roomWidth: 800,
    roomHeight: 600,
    wallHeight: 280,
  };
};

export const FIXTURE_LIBRARY: Omit<Fixture, 'id' | 'cx' | 'cy' | 'rotation' | 'anchoredToWallId' | 'anchorMode' | 'secondaryWallId' | 'wallOffset'>[] = [
  // Bathroom - with proper connection points
  { 
    type: 'toilet', width: 40, depth: 65, height: 40, category: 'bathroom',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: 0, localY: -28, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'drainage', localX: 0, localY: 0, targetPreference: 'floor', allowedTargets: ['floor', 'wall'], defaultSide: 'bottom' }
    ],
    electricalConnections: []
  },
  { 
    type: 'bidet', width: 40, depth: 55, height: 35, category: 'bathroom',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: 0, localY: -22, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'drainage', localX: 0, localY: 0, targetPreference: 'floor', allowedTargets: ['floor'], defaultSide: 'bottom' }
    ],
    electricalConnections: []
  },
  { 
    type: 'sink', width: 60, depth: 45, height: 85, category: 'bathroom',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: -10, localY: -18, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'water-supply', localX: 10, localY: -18, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'drainage', localX: 0, localY: -10, targetPreference: 'wall', allowedTargets: ['wall', 'floor'], defaultSide: 'back' }
    ],
    electricalConnections: []
  },
  { 
    type: 'shower', width: 90, depth: 90, height: 220, category: 'bathroom',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: 0, localY: -40, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'drainage', localX: 0, localY: 0, targetPreference: 'floor', allowedTargets: ['floor'], defaultSide: 'bottom' }
    ],
    electricalConnections: []
  },
  { 
    type: 'bathtub', width: 170, depth: 75, height: 60, category: 'bathroom',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: -70, localY: 0, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'left' },
      { id: '', type: 'drainage', localX: 70, localY: 0, targetPreference: 'floor', allowedTargets: ['floor'], defaultSide: 'bottom' }
    ],
    electricalConnections: []
  },
  { 
    type: 'mirror', width: 80, depth: 5, height: 100, category: 'bathroom',
    plumbingConnections: [],
    electricalConnections: [
      { id: '', type: 'light', localX: 0, localY: 0, wattage: 20, targetPreference: 'wall' }
    ]
  },
  { 
    type: 'cabinet', width: 60, depth: 35, height: 70, category: 'bathroom',
    plumbingConnections: [],
    electricalConnections: []
  },
  // Kitchen
  { 
    type: 'stove', width: 60, depth: 60, height: 85, category: 'kitchen',
    plumbingConnections: [],
    electricalConnections: [
      { id: '', type: 'outlet', localX: 0, localY: -25, wattage: 3000, targetPreference: 'wall' }
    ]
  },
  { 
    type: 'refrigerator', width: 70, depth: 70, height: 180, category: 'kitchen',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: 0, localY: -30, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' }
    ],
    electricalConnections: [
      { id: '', type: 'outlet', localX: 0, localY: -30, wattage: 200, targetPreference: 'wall' }
    ]
  },
  { 
    type: 'dishwasher', width: 60, depth: 60, height: 85, category: 'kitchen',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: 0, localY: -25, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'drainage', localX: 0, localY: -25, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' }
    ],
    electricalConnections: [
      { id: '', type: 'outlet', localX: 0, localY: -25, wattage: 1800, targetPreference: 'wall' }
    ]
  },
  { 
    type: 'kitchen-sink', width: 80, depth: 50, height: 85, category: 'kitchen',
    plumbingConnections: [
      { id: '', type: 'water-supply', localX: -15, localY: -20, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'water-supply', localX: 15, localY: -20, targetPreference: 'wall', allowedTargets: ['wall'], defaultSide: 'back' },
      { id: '', type: 'drainage', localX: 0, localY: -10, targetPreference: 'wall', allowedTargets: ['wall', 'floor'], defaultSide: 'back' }
    ],
    electricalConnections: []
  },
  { 
    type: 'island', width: 120, depth: 80, height: 90, category: 'kitchen',
    plumbingConnections: [],
    electricalConnections: [
      { id: '', type: 'outlet', localX: 0, localY: 0, wattage: 1500, targetPreference: 'floor' }
    ]
  },
  // General - no connections
  { 
    type: 'table', width: 120, depth: 80, height: 75, category: 'general',
    plumbingConnections: [],
    electricalConnections: []
  },
  { 
    type: 'chair', width: 45, depth: 45, height: 85, category: 'general',
    plumbingConnections: [],
    electricalConnections: []
  },
  { 
    type: 'sofa', width: 200, depth: 90, height: 85, category: 'general',
    plumbingConnections: [],
    electricalConnections: []
  },
  { 
    type: 'bed', width: 160, depth: 200, height: 50, category: 'general',
    plumbingConnections: [],
    electricalConnections: []
  },
  { 
    type: 'wardrobe', width: 120, depth: 60, height: 220, category: 'general',
    plumbingConnections: [],
    electricalConnections: []
  },
];

export const TILE_LIBRARY: Tile[] = [
  // Classic Ceramics
  { id: 'tile-1', name: 'White Ceramic', width: 30, height: 30, pricePerUnit: 2.5, material: 'ceramic', color: '#ffffff' },
  { id: 'tile-8', name: 'Ivory Ceramic', width: 30, height: 30, pricePerUnit: 2.8, material: 'ceramic', color: '#fffff0' },
  { id: 'tile-9', name: 'Cream Ceramic', width: 25, height: 25, pricePerUnit: 2.2, material: 'ceramic', color: '#fdf5e6' },
  
  // Subway Tiles
  { id: 'tile-10', name: 'White Subway', width: 30, height: 10, pricePerUnit: 1.8, material: 'ceramic', color: '#f8fafc' },
  { id: 'tile-11', name: 'Black Subway', width: 30, height: 10, pricePerUnit: 2.0, material: 'ceramic', color: '#1e293b' },
  { id: 'tile-12', name: 'Sage Subway', width: 30, height: 10, pricePerUnit: 2.2, material: 'ceramic', color: '#9caf88' },
  { id: 'tile-13', name: 'Blush Subway', width: 30, height: 10, pricePerUnit: 2.2, material: 'ceramic', color: '#e8c4c4' },
  
  // Large Format Porcelain
  { id: 'tile-3', name: 'Beige Porcelain', width: 45, height: 45, pricePerUnit: 5.0, material: 'porcelain', color: '#d4c4a8' },
  { id: 'tile-14', name: 'White Porcelain XL', width: 60, height: 60, pricePerUnit: 8.5, material: 'porcelain', color: '#fafafa' },
  { id: 'tile-15', name: 'Gray Porcelain XL', width: 60, height: 60, pricePerUnit: 8.5, material: 'porcelain', color: '#e5e7eb' },
  { id: 'tile-16', name: 'Charcoal Porcelain', width: 60, height: 30, pricePerUnit: 6.0, material: 'porcelain', color: '#374151' },
  
  // Marble & Natural Stone
  { id: 'tile-2', name: 'Gray Marble', width: 60, height: 30, pricePerUnit: 8.0, material: 'marble', color: '#9ca3af' },
  { id: 'tile-17', name: 'Carrara White', width: 30, height: 30, pricePerUnit: 12.0, material: 'marble', color: '#f1f5f9' },
  { id: 'tile-18', name: 'Calacatta Gold', width: 40, height: 40, pricePerUnit: 15.0, material: 'marble', color: '#fef9c3' },
  { id: 'tile-5', name: 'Black Slate', width: 30, height: 60, pricePerUnit: 6.0, material: 'slate', color: '#1f2937' },
  { id: 'tile-19', name: 'Travertine Beige', width: 40, height: 40, pricePerUnit: 9.0, material: 'marble', color: '#d6ccc2' },
  
  // Wood Look
  { id: 'tile-20', name: 'Oak Plank', width: 120, height: 20, pricePerUnit: 7.5, material: 'porcelain', color: '#a3866c' },
  { id: 'tile-21', name: 'Walnut Plank', width: 120, height: 20, pricePerUnit: 8.0, material: 'porcelain', color: '#5d4037' },
  { id: 'tile-22', name: 'Whitewash Wood', width: 100, height: 15, pricePerUnit: 6.5, material: 'porcelain', color: '#e8e4df' },
  
  // Terracotta & Rustic
  { id: 'tile-6', name: 'Terracotta', width: 20, height: 20, pricePerUnit: 3.0, material: 'terracotta', color: '#c2410c' },
  { id: 'tile-23', name: 'Tuscan Clay', width: 30, height: 30, pricePerUnit: 4.5, material: 'terracotta', color: '#b45309' },
  { id: 'tile-24', name: 'Rustic Brick', width: 25, height: 6, pricePerUnit: 2.0, material: 'terracotta', color: '#9a3412' },
  
  // Glass Mosaic (Flexible for curves)
  { id: 'tile-4', name: 'Blue Mosaic', width: 5, height: 5, pricePerUnit: 0.5, material: 'glass', color: '#3b82f6', isFlexible: true, minCurveRadius: 20 },
  { id: 'tile-7', name: 'Mini Mosaic', width: 2.5, height: 2.5, pricePerUnit: 0.3, material: 'glass', color: '#06b6d4', isFlexible: true, minCurveRadius: 10 },
  { id: 'tile-25', name: 'Emerald Mosaic', width: 5, height: 5, pricePerUnit: 0.6, material: 'glass', color: '#10b981', isFlexible: true, minCurveRadius: 20 },
  { id: 'tile-26', name: 'Gold Mosaic', width: 5, height: 5, pricePerUnit: 0.8, material: 'glass', color: '#f59e0b', isFlexible: true, minCurveRadius: 20 },
  { id: 'tile-27', name: 'Pearl Mosaic', width: 3, height: 3, pricePerUnit: 0.4, material: 'glass', color: '#fdf4ff', isFlexible: true, minCurveRadius: 15 },
  
  // Hexagonal
  { id: 'tile-28', name: 'White Hex', width: 15, height: 17, pricePerUnit: 3.5, material: 'ceramic', color: '#ffffff' },
  { id: 'tile-29', name: 'Black Hex', width: 15, height: 17, pricePerUnit: 3.5, material: 'ceramic', color: '#18181b' },
  { id: 'tile-30', name: 'Marble Hex', width: 10, height: 12, pricePerUnit: 5.0, material: 'marble', color: '#f1f5f9' },
  
  // Patterned & Decorative
  { id: 'tile-31', name: 'Navy Blue', width: 20, height: 20, pricePerUnit: 4.0, material: 'ceramic', color: '#1e3a5f' },
  { id: 'tile-32', name: 'Forest Green', width: 20, height: 20, pricePerUnit: 4.0, material: 'ceramic', color: '#166534' },
  { id: 'tile-33', name: 'Dusty Rose', width: 15, height: 15, pricePerUnit: 3.8, material: 'ceramic', color: '#e879a9' },
  { id: 'tile-34', name: 'Midnight Black', width: 30, height: 30, pricePerUnit: 4.5, material: 'porcelain', color: '#09090b' },
];

// Column library with common presets - Rectangle first as default
export const COLUMN_LIBRARY: Omit<Column, 'id' | 'x' | 'y'>[] = [
  { shape: 'rectangle', width: 30, depth: 30, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'rectangle', width: 40, depth: 20, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'square', width: 30, depth: 30, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'round', width: 30, depth: 30, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'round', width: 40, depth: 40, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'l-shaped', width: 40, depth: 40, height: 280, rotation: 0, isStructural: true, material: 'concrete', armWidth: 15, armLength: 25 },
  { shape: 't-shaped', width: 50, depth: 30, height: 280, rotation: 0, isStructural: true, material: 'concrete', armWidth: 15, armLength: 20 },
  { shape: 'hexagonal', width: 30, depth: 30, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'octagonal', width: 35, depth: 35, height: 280, rotation: 0, isStructural: true, material: 'concrete' },
  { shape: 'round', width: 20, depth: 20, height: 280, rotation: 0, isStructural: false, material: 'wood' },
];

// Helper function to check if a wall is curved
export function isWallCurved(wall: Wall): boolean {
  return Boolean(wall.isCurved && wall.bulge && Math.abs(wall.bulge) > 0.01);
}

// Helper function to check if a wall has sloped height
export function isWallSloped(wall: Wall): boolean {
  const startH = wall.startHeight ?? wall.height;
  const endH = wall.endHeight ?? wall.height;
  return Math.abs(startH - endH) > 1; // More than 1cm difference
}

// Helper to calculate slope angle in degrees
export function getWallSlopeAngle(wall: Wall, wallLength: number): number {
  const startH = wall.startHeight ?? wall.height;
  const endH = wall.endHeight ?? wall.height;
  if (wallLength === 0) return 0;
  return Math.atan2(Math.abs(endH - startH), wallLength) * (180 / Math.PI);
}

// Helper to get recommended tile size for curved walls
export function getRecommendedTileSize(curveRadius: number): { maxWidth: number; recommendation: string } {
  if (curveRadius < 50) {
    return { maxWidth: 5, recommendation: 'Use mosaic tiles (≤5cm) for very tight curves' };
  } else if (curveRadius < 100) {
    return { maxWidth: 10, recommendation: 'Use small tiles (≤10cm) for tight curves' };
  } else if (curveRadius < 200) {
    return { maxWidth: 20, recommendation: 'Use medium tiles (≤20cm) for moderate curves' };
  } else {
    return { maxWidth: 30, recommendation: 'Standard tiles work well for gentle curves' };
  }
}

// Check if a tile is suitable for a given curve radius
export function isTileSuitableForCurve(tile: Tile, curveRadius: number): boolean {
  if (tile.isFlexible) return true;
  if (tile.minCurveRadius !== undefined) {
    return curveRadius >= tile.minCurveRadius;
  }
  // For non-flexible tiles, use size-based rule
  const maxDimension = Math.max(tile.width, tile.height);
  const recommended = getRecommendedTileSize(curveRadius);
  return maxDimension <= recommended.maxWidth;
}
