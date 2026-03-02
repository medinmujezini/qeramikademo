/**
 * MEP Auto-Routing Engine
 * 
 * Intelligent routing with priority-based sequential routing and constraint-aware pathfinding.
 * Routes systems in order: Drainage > Vent > Hot Water > Cold Water > Electrical
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
  RoutingRequest,
  RoutingResult,
  FittingType,
} from '@/types/mep';
import { SYSTEM_PRIORITY, SYSTEM_COLORS, DEFAULT_PIPE_MATERIALS, MIN_CLEARANCES } from '@/types/mep';
import { getConnectionWorldPosition } from '@/data/fixtureLibrary';
import { getDrainPipeSize, getVentPipeSize, getWaterPipeSize, getMinSlope } from '@/data/plumbingCodes';

// =============================================================================
// TYPES
// =============================================================================

interface GridCell {
  x: number;
  y: number;
  walkable: boolean;
  occupiedBy: string[];  // Route IDs occupying this cell
  cost: number;          // Additional cost for routing through this cell
}

interface PathNode {
  x: number;
  y: number;
  z: number;
  g: number;  // Cost from start
  h: number;  // Heuristic to goal
  f: number;  // g + h
  parent: PathNode | null;
}

interface RoutingContext {
  existingRoutes: MEPRoute[];
  fixtures: MEPFixture[];
  nodes: MEPNode[];
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  gridSize: number;
  preferWallHugging: boolean;
  maxBends: number;
  ceilingHeight?: number;  // Room ceiling height for height calculations
}

// =============================================================================
// HEIGHT CALCULATION UTILITIES
// =============================================================================

/**
 * Calculate the proper connection height for a node based on its type and mounting
 */
export function getNodeConnectionHeight(
  node: MEPNode,
  connectionType: MEPSystemType,
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
      // Return height slightly below the heater body for proper downward routing
      if (connectionType === 'cold-water') {
        return heaterBottomZ - 15; // Cold inlet at bottom
      } else if (connectionType === 'hot-water') {
        return heaterBottomZ - 10; // Hot outlet slightly higher than inlet
      }
    }
    
    // Floor/wall mounted: use heights as-is (from floor)
    if (connectionType === 'cold-water') {
      return inletHeight;
    } else if (connectionType === 'hot-water') {
      return outletHeight;
    }
  }
  
  // Stacks: use mid-point of stack height range
  if (node.stackProperties) {
    // For drainage, connect lower on the stack
    if (connectionType === 'drainage') {
      return node.stackProperties.bottomElevation + 
        (node.stackProperties.topElevation - node.stackProperties.bottomElevation) * 0.3;
    }
    // For vent, connect higher on the stack
    if (connectionType === 'vent') {
      return node.stackProperties.bottomElevation + 
        (node.stackProperties.topElevation - node.stackProperties.bottomElevation) * 0.7;
    }
    // Default to middle
    return (node.stackProperties.bottomElevation + node.stackProperties.topElevation) / 2;
  }
  
  // Ceiling mounted (non-water-heater): connections from bottom
  if (node.mountingType === 'ceiling') {
    const nodeBottomZ = ceilingHeight - (node.heightFromCeiling ?? 0);
    return nodeBottomZ - 10; // Connect from bottom
  }
  
  // Underground: use negative or zero height
  if (node.mountingType === 'underground') {
    return node.heightFromFloor ?? -15;
  }
  
  // Wall/Floor mounted: use heightFromFloor or position.z
  return node.heightFromFloor ?? node.position.z;
}

/**
 * Calculate 3D Y position for node visualization based on mounting type
 */
export function getNode3DYPosition(
  node: MEPNode,
  scale: number,
  ceilingHeight: number = 280
): number {
  switch (node.mountingType) {
    case 'ceiling':
      return (ceilingHeight - (node.heightFromCeiling ?? 0)) * scale;
    case 'underground':
      return -0.1; // Below floor
    case 'wall':
      return (node.heightFromFloor ?? 150) * scale;
    case 'floor':
    default:
      // For stacks, use the mid-point
      if (node.stackProperties) {
        return ((node.stackProperties.bottomElevation + node.stackProperties.topElevation) / 2) * scale;
      }
      return (node.heightFromFloor ?? 0) * scale;
  }
}

// =============================================================================
// GRID GENERATION
// =============================================================================

function createRoutingGrid(
  width: number,
  height: number,
  cellSize: number,
  context: RoutingContext
): GridCell[][] {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  
  const grid: GridCell[][] = [];
  
  for (let y = 0; y < rows; y++) {
    grid[y] = [];
    for (let x = 0; x < cols; x++) {
      grid[y][x] = {
        x: x * cellSize + cellSize / 2,
        y: y * cellSize + cellSize / 2,
        walkable: true,
        occupiedBy: [],
        cost: 1,
      };
    }
  }
  
  // Mark cells occupied by fixtures
  for (const fixture of context.fixtures) {
    const fx = fixture.position.x;
    const fy = fixture.position.y;
    const hw = fixture.dimensions.width / 2;
    const hd = fixture.dimensions.depth / 2;
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = grid[y][x];
        if (cell.x >= fx - hw && cell.x <= fx + hw &&
            cell.y >= fy - hd && cell.y <= fy + hd) {
          cell.walkable = false;
        }
      }
    }
  }
  
  // Mark cells near walls with lower cost (prefer wall hugging)
  if (context.preferWallHugging) {
    for (const wall of context.walls) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = grid[y][x];
          const distToWall = pointToSegmentDistance(
            cell.x, cell.y,
            wall.x1, wall.y1, wall.x2, wall.y2
          );
          if (distToWall < 30) {
            cell.cost = 0.5;  // Prefer routing near walls
          }
        }
      }
    }
  }
  
  // Mark cells occupied by existing routes with higher cost
  for (const route of context.existingRoutes) {
    for (const segment of route.segments) {
      const minX = Math.min(segment.startPoint.x, segment.endPoint.x);
      const maxX = Math.max(segment.startPoint.x, segment.endPoint.x);
      const minY = Math.min(segment.startPoint.y, segment.endPoint.y);
      const maxY = Math.max(segment.startPoint.y, segment.endPoint.y);
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = grid[y][x];
          if (cell.x >= minX - 10 && cell.x <= maxX + 10 &&
              cell.y >= minY - 10 && cell.y <= maxY + 10) {
            cell.occupiedBy.push(route.id);
            cell.cost += 2;  // Higher cost to route near existing routes
          }
        }
      }
    }
  }
  
  return grid;
}

function pointToSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  
  if (len2 === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  
  return Math.hypot(px - projX, py - projY);
}

// =============================================================================
// A* PATHFINDING
// =============================================================================

function findPath(
  grid: GridCell[][],
  start: Point2D,
  end: Point2D,
  cellSize: number,
  systemType: MEPSystemType,
  context: RoutingContext
): Point2D[] | null {
  const cols = grid[0].length;
  const rows = grid.length;
  
  const startCol = Math.max(0, Math.min(cols - 1, Math.floor(start.x / cellSize)));
  const startRow = Math.max(0, Math.min(rows - 1, Math.floor(start.y / cellSize)));
  const endCol = Math.max(0, Math.min(cols - 1, Math.floor(end.x / cellSize)));
  const endRow = Math.max(0, Math.min(rows - 1, Math.floor(end.y / cellSize)));
  
  // Force start and end cells to be walkable (they may be inside fixtures/nodes)
  grid[startRow][startCol].walkable = true;
  grid[startRow][startCol].cost = 1;
  grid[endRow][endCol].walkable = true;
  grid[endRow][endCol].cost = 1;
  
  // Also make adjacent cells walkable to ensure path can start/end
  const adjacentOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of adjacentOffsets) {
    const adjStartCol = startCol + dx;
    const adjStartRow = startRow + dy;
    const adjEndCol = endCol + dx;
    const adjEndRow = endRow + dy;
    
    if (adjStartCol >= 0 && adjStartCol < cols && adjStartRow >= 0 && adjStartRow < rows) {
      grid[adjStartRow][adjStartCol].walkable = true;
    }
    if (adjEndCol >= 0 && adjEndCol < cols && adjEndRow >= 0 && adjEndRow < rows) {
      grid[adjEndRow][adjEndCol].walkable = true;
    }
  }
  
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  
  const startNode: PathNode = {
    x: startCol,
    y: startRow,
    z: 0,
    g: 0,
    h: heuristic(startCol, startRow, endCol, endRow),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  
  openSet.push(startNode);
  
  const directions = [
    { dx: 0, dy: -1 },  // Up
    { dx: 1, dy: 0 },   // Right
    { dx: 0, dy: 1 },   // Down
    { dx: -1, dy: 0 },  // Left
  ];
  
  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    
    if (current.x === endCol && current.y === endRow) {
      return reconstructPath(current, cellSize, grid);
    }
    
    closedSet.add(`${current.x},${current.y}`);
    
    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (closedSet.has(`${nx},${ny}`)) continue;
      
      const cell = grid[ny][nx];
      if (!cell.walkable) continue;
      
      // Calculate clearance penalty
      let clearancePenalty = 0;
      for (const routeId of cell.occupiedBy) {
        clearancePenalty += 5;
      }
      
      // Calculate bend penalty
      let bendPenalty = 0;
      if (current.parent) {
        const prevDir = {
          dx: current.x - current.parent.x,
          dy: current.y - current.parent.y,
        };
        if (prevDir.dx !== dir.dx || prevDir.dy !== dir.dy) {
          bendPenalty = 10;  // Penalize direction changes
        }
      }
      
      const g = current.g + cell.cost + clearancePenalty + bendPenalty;
      const h = heuristic(nx, ny, endCol, endRow);
      
      const existingIndex = openSet.findIndex(n => n.x === nx && n.y === ny);
      if (existingIndex !== -1) {
        if (g < openSet[existingIndex].g) {
          openSet[existingIndex].g = g;
          openSet[existingIndex].f = g + h;
          openSet[existingIndex].parent = current;
        }
      } else {
        openSet.push({
          x: nx,
          y: ny,
          z: 0,
          g,
          h,
          f: g + h,
          parent: current,
        });
      }
    }
  }
  
  return null;  // No path found
}

function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  // Manhattan distance
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

function reconstructPath(
  endNode: PathNode,
  cellSize: number,
  grid: GridCell[][]
): Point2D[] {
  const path: Point2D[] = [];
  let current: PathNode | null = endNode;
  
  while (current) {
    path.unshift({
      x: grid[current.y][current.x].x,
      y: grid[current.y][current.x].y,
    });
    current = current.parent;
  }
  
  return simplifyPath(path);
}

function simplifyPath(path: Point2D[]): Point2D[] {
  if (path.length <= 2) return path;
  
  const simplified: Point2D[] = [path[0]];
  let currentDir = { dx: 0, dy: 0 };
  
  for (let i = 1; i < path.length; i++) {
    const newDir = {
      dx: Math.sign(path[i].x - path[i - 1].x),
      dy: Math.sign(path[i].y - path[i - 1].y),
    };
    
    if (newDir.dx !== currentDir.dx || newDir.dy !== currentDir.dy) {
      if (i > 1) {
        simplified.push(path[i - 1]);
      }
      currentDir = newDir;
    }
  }
  
  simplified.push(path[path.length - 1]);
  return simplified;
}

// =============================================================================
// ROUTE GENERATION
// =============================================================================

/**
 * Convert 90° turns to double 45° for drainage systems
 * This is critical for proper drainage flow and code compliance
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
      
      // Calculate angle
      const dot = norm1.x * norm2.x + norm1.y * norm2.y;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      
      // If it's approximately a 90° turn, split into two 45° turns
      if (angle >= 80 && angle <= 100) {
        // Calculate the two intermediate points for double 45
        // First point: 1/3 of the way, offset 45° from incoming direction
        const offset = 15; // Small offset distance for the intermediate section
        
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
 * Detect fitting type based on angle change
 */
function detectFittingTypeForSegment(
  prevDir: { dx: number; dy: number },
  currDir: { dx: number; dy: number },
  systemType: MEPSystemType
): FittingType {
  // Check if there's a direction change
  if (prevDir.dx === currDir.dx && prevDir.dy === currDir.dy) {
    return 'coupling'; // Straight run, just a coupling
  }
  
  // Calculate angle
  const mag1 = Math.sqrt(prevDir.dx * prevDir.dx + prevDir.dy * prevDir.dy);
  const mag2 = Math.sqrt(currDir.dx * currDir.dx + currDir.dy * currDir.dy);
  
  if (mag1 === 0 || mag2 === 0) return 'coupling';
  
  const dot = (prevDir.dx * currDir.dx + prevDir.dy * currDir.dy) / (mag1 * mag2);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
  
  // For drainage systems, always use 45° fittings
  if (systemType === 'drainage' || systemType === 'vent') {
    if (angle >= 40 && angle <= 50) {
      return 'elbow-45';
    } else if (angle >= 80 && angle <= 100) {
      // Should already be converted to double 45, but fallback
      return 'elbow-45';
    }
    return 'wye'; // Use wye for branches
  }
  
  // For water and electrical
  if (angle >= 80 && angle <= 100) {
    return 'elbow-90';
  } else if (angle >= 40 && angle <= 50) {
    return 'elbow-45';
  }
  
  return 'coupling';
}

function createRouteFromPath(
  path: Point2D[],
  systemType: MEPSystemType,
  sourceNode: MEPNode,
  destinationFixture: MEPFixture,
  connectionZ: number,
  dfu: number,
  sourceZ?: number  // Optional: calculated source height based on mounting
): MEPRoute {
  const routeId = uuidv4();
  const segments: MEPSegment[] = [];
  
  // For drainage, convert 90° turns to double 45°
  const processedPath = (systemType === 'drainage' || systemType === 'vent')
    ? convertDrainageToDouble45(path)
    : path;
  
  // Calculate pipe size based on DFU
  let size: number;
  if (systemType === 'drainage') {
    size = getDrainPipeSize(dfu);
  } else if (systemType === 'vent') {
    size = getVentPipeSize(dfu);
  } else if (systemType === 'cold-water' || systemType === 'hot-water') {
    size = getWaterPipeSize(destinationFixture.gpm);
  } else {
    size = 12;  // Default wire gauge for electrical
  }
  
  const material = isPlumbingSystem(systemType) 
    ? DEFAULT_PIPE_MATERIALS[systemType as PlumbingSystemType]
    : 'THHN';
  
  // Use provided sourceZ or fall back to node position
  const actualSourceZ = sourceZ ?? sourceNode.position.z;
  
  // Determine the routing height (horizontal runs)
  // For most systems, route at fixture connection height
  // For ceiling-mounted sources, we need to drop down first
  const routingZ = connectionZ;
  
  // Check if we need a vertical drop/rise from source
  const heightDifference = Math.abs(actualSourceZ - routingZ);
  const needsVerticalConnection = heightDifference > 20; // More than 20cm difference
  
  let segmentIndex = 0;
  
  // If source is at different height than routing level, add vertical segment first
  if (needsVerticalConnection && processedPath.length > 0) {
    const verticalSegment: MEPSegment = {
      id: uuidv4(),
      routeId,
      segmentIndex: segmentIndex++,
      systemType,
      startPoint: { 
        x: processedPath[0].x, 
        y: processedPath[0].y, 
        z: actualSourceZ 
      },
      endPoint: { 
        x: processedPath[0].x, 
        y: processedPath[0].y, 
        z: routingZ 
      },
      size,
      material,
      color: SYSTEM_COLORS[systemType],
      fittingAtEnd: 'elbow-90', // Elbow to transition to horizontal
    };
    segments.push(verticalSegment);
  }
  
  // Create horizontal segments from processed path
  for (let i = 0; i < processedPath.length - 1; i++) {
    const segment: MEPSegment = {
      id: uuidv4(),
      routeId,
      segmentIndex: segmentIndex++,
      systemType,
      startPoint: { x: processedPath[i].x, y: processedPath[i].y, z: routingZ },
      endPoint: { x: processedPath[i + 1].x, y: processedPath[i + 1].y, z: routingZ },
      size,
      material,
      slope: systemType === 'drainage' ? getMinSlope(size) : undefined,
      color: SYSTEM_COLORS[systemType],
    };
    
    // Add fittings at bends
    if (i > 0) {
      const prevDir = {
        dx: processedPath[i].x - processedPath[i - 1].x,
        dy: processedPath[i].y - processedPath[i - 1].y,
      };
      const currDir = {
        dx: processedPath[i + 1].x - processedPath[i].x,
        dy: processedPath[i + 1].y - processedPath[i].y,
      };
      
      const fittingType = detectFittingTypeForSegment(prevDir, currDir, systemType);
      if (fittingType !== 'coupling') {
        segment.fittingAtStart = fittingType;
      }
    }
    
    segments.push(segment);
  }
  
  // If destination fixture is at different height than routing level, add final vertical segment
  const fixtureZ = connectionZ;
  const fixtureHeightDiff = Math.abs(routingZ - fixtureZ);
  if (fixtureHeightDiff > 10 && processedPath.length > 0) {
    const lastPoint = processedPath[processedPath.length - 1];
    const finalVerticalSegment: MEPSegment = {
      id: uuidv4(),
      routeId,
      segmentIndex: segmentIndex++,
      systemType,
      startPoint: { x: lastPoint.x, y: lastPoint.y, z: routingZ },
      endPoint: { x: lastPoint.x, y: lastPoint.y, z: fixtureZ },
      size,
      material,
      color: SYSTEM_COLORS[systemType],
      fittingAtStart: 'elbow-90',
    };
    segments.push(finalVerticalSegment);
  }
  
  // Calculate total length
  const totalLength = segments.reduce((sum, seg) => {
    const dx = seg.endPoint.x - seg.startPoint.x;
    const dy = seg.endPoint.y - seg.startPoint.y;
    const dz = seg.endPoint.z - seg.startPoint.z;
    return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, 0);
  
  return {
    id: routeId,
    systemType,
    segments,
    source: {
      type: 'node',
      nodeId: sourceNode.id,
    },
    destination: {
      type: 'fixture',
      id: destinationFixture.id,
    },
    totalLength,
    totalDFU: dfu,
    requiredSize: size,
    elevation: {
      start: actualSourceZ,
      end: connectionZ,
    },
    isValid: true,
    validationErrors: [],
  };
}

function isPlumbingSystem(type: MEPSystemType): type is PlumbingSystemType {
  return ['cold-water', 'hot-water', 'drainage', 'vent'].includes(type);
}

// =============================================================================
// AUTO-ROUTING ENGINE
// =============================================================================

export interface AutoRoutingConfig {
  gridSize?: number;
  canvasWidth: number;
  canvasHeight: number;
  ceilingHeight?: number;  // Room ceiling height for proper height calculations
  preferWallHugging?: boolean;
  maxBends?: number;
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

export interface AutoRoutingResult {
  routes: MEPRoute[];
  successCount: number;
  failureCount: number;
  messages: string[];
}

/**
 * Generate all routes for fixtures based on priority
 */
export function autoRouteAllFixtures(
  fixtures: MEPFixture[],
  nodes: MEPNode[],
  existingRoutes: MEPRoute[],
  config: AutoRoutingConfig
): AutoRoutingResult {
  const result: AutoRoutingResult = {
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
    connectionZ: number;
    targetNode: MEPNode;
  }> = [];
  
  for (const fixture of fixtures) {
    for (const connection of fixture.connections) {
      if (!connection.isRequired) continue;
      
      const targetNode = findTargetNode(connection.systemType, nodes);
      if (!targetNode) continue;
      
      requests.push({
        fixture,
        systemType: connection.systemType,
        connectionZ: connection.localPosition.z,
        targetNode,
      });
    }
  }
  
  // Sort by system priority (drainage first, then vent, then water, then electrical)
  requests.sort((a, b) => 
    SYSTEM_PRIORITY[a.systemType] - SYSTEM_PRIORITY[b.systemType]
  );
  
  const context: RoutingContext = {
    existingRoutes: [...existingRoutes],
    fixtures,
    nodes,
    walls: config.walls,
    gridSize: config.gridSize || 20,
    preferWallHugging: config.preferWallHugging ?? true,
    maxBends: config.maxBends || 4,
    ceilingHeight: config.ceilingHeight ?? 280,
  };
  
  // Route each request
  for (const request of requests) {
    const grid = createRoutingGrid(
      config.canvasWidth,
      config.canvasHeight,
      context.gridSize,
      context
    );
    
    const connectionPos = getConnectionWorldPosition(
      request.fixture,
      request.fixture.connections.find(c => c.systemType === request.systemType)!
    );
    
    const path = findPath(
      grid,
      { x: request.targetNode.position.x, y: request.targetNode.position.y },
      { x: connectionPos.x, y: connectionPos.y },
      context.gridSize,
      request.systemType,
      context
    );
    
    if (path && path.length >= 2) {
      // Use proper node height based on type and mounting
      const sourceZ = getNodeConnectionHeight(
        request.targetNode, 
        request.systemType, 
        context.ceilingHeight
      );
      
      const route = createRouteFromPath(
        path,
        request.systemType,
        request.targetNode,
        request.fixture,
        request.connectionZ,
        request.fixture.dfu,
        sourceZ  // Pass proper source height
      );
      
      result.routes.push(route);
      context.existingRoutes.push(route);  // Add to context for subsequent routing
      result.successCount++;
      result.messages.push(`✓ Routed ${request.systemType} to ${request.fixture.name}`);
    } else {
      result.failureCount++;
      result.messages.push(`✗ Failed to route ${request.systemType} to ${request.fixture.name}`);
    }
  }
  
  return result;
}

function findTargetNode(systemType: MEPSystemType, nodes: MEPNode[]): MEPNode | null {
  switch (systemType) {
    case 'cold-water':
      return nodes.find(n => n.type === 'water-main' || n.type === 'water-manifold') || null;
    case 'hot-water':
      return nodes.find(n => n.type === 'water-heater') || null;
    case 'drainage':
      return nodes.find(n => n.type === 'drain-stack') || null;
    case 'vent':
      return nodes.find(n => n.type === 'vent-stack' || n.type === 'drain-stack') || null;
    case 'power':
    case 'dedicated':
    case 'lighting':
      return nodes.find(n => n.type === 'electrical-panel' || n.type === 'sub-panel') || null;
    default:
      return null;
  }
}

/**
 * Route a single fixture connection
 */
export function routeSingleConnection(
  fixture: MEPFixture,
  systemType: MEPSystemType,
  nodes: MEPNode[],
  existingRoutes: MEPRoute[],
  fixtures: MEPFixture[],
  config: AutoRoutingConfig
): RoutingResult {
  const connection = fixture.connections.find(c => c.systemType === systemType);
  if (!connection) {
    return {
      route: null,
      success: false,
      message: `No ${systemType} connection found on fixture`,
      clashesAvoided: 0,
      fallbackUsed: false,
    };
  }
  
  const targetNode = findTargetNode(systemType, nodes);
  if (!targetNode) {
    return {
      route: null,
      success: false,
      message: `No suitable ${systemType} node found`,
      clashesAvoided: 0,
      fallbackUsed: false,
    };
  }
  
  const context: RoutingContext = {
    existingRoutes,
    fixtures,
    nodes,
    walls: config.walls,
    gridSize: config.gridSize || 20,
    preferWallHugging: config.preferWallHugging ?? true,
    maxBends: config.maxBends || 4,
  };
  
  const grid = createRoutingGrid(
    config.canvasWidth,
    config.canvasHeight,
    context.gridSize,
    context
  );
  
  const connectionPos = getConnectionWorldPosition(fixture, connection);
  
  const path = findPath(
    grid,
    { x: targetNode.position.x, y: targetNode.position.y },
    { x: connectionPos.x, y: connectionPos.y },
    context.gridSize,
    systemType,
    context
  );
  
  if (path && path.length >= 2) {
    const route = createRouteFromPath(
      path,
      systemType,
      targetNode,
      fixture,
      connection.localPosition.z,
      fixture.dfu
    );
    
    return {
      route,
      success: true,
      message: `Successfully routed ${systemType}`,
      clashesAvoided: 0,
      fallbackUsed: false,
    };
  }
  
  return {
    route: null,
    success: false,
    message: `Could not find valid path for ${systemType}`,
    clashesAvoided: 0,
    fallbackUsed: true,
  };
}

/**
 * Check if two routes clash
 */
export function checkRouteClash(
  route1: MEPRoute,
  route2: MEPRoute,
  minClearance: number = 10
): boolean {
  for (const seg1 of route1.segments) {
    for (const seg2 of route2.segments) {
      // Simple bounding box intersection check
      const minX1 = Math.min(seg1.startPoint.x, seg1.endPoint.x) - minClearance;
      const maxX1 = Math.max(seg1.startPoint.x, seg1.endPoint.x) + minClearance;
      const minY1 = Math.min(seg1.startPoint.y, seg1.endPoint.y) - minClearance;
      const maxY1 = Math.max(seg1.startPoint.y, seg1.endPoint.y) + minClearance;
      
      const minX2 = Math.min(seg2.startPoint.x, seg2.endPoint.x);
      const maxX2 = Math.max(seg2.startPoint.x, seg2.endPoint.x);
      const minY2 = Math.min(seg2.startPoint.y, seg2.endPoint.y);
      const maxY2 = Math.max(seg2.startPoint.y, seg2.endPoint.y);
      
      if (maxX1 >= minX2 && minX1 <= maxX2 && maxY1 >= minY2 && minY1 <= maxY2) {
        return true;
      }
    }
  }
  
  return false;
}
