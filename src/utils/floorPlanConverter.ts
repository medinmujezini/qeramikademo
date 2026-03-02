// Convert AI-detected floor plan elements to the application's FloorPlan format

import { v4 as uuidv4 } from 'uuid';
import type { 
  AIFloorPlanAnalysis, 
  AIDetectedWall, 
  AIDetectedDoor, 
  AIDetectedWindow,
  ScaleCalibration 
} from '@/types/floorPlanDigitizer';
import type { 
  FloorPlan, 
  Point, 
  Wall, 
  Door, 
  Window,
  DoorType,
  WindowType 
} from '@/types/floorPlan';
import { pixelsToCm } from './scaleCalibration';

const SNAP_THRESHOLD = 5; // cm - points within this distance will be merged
const MIN_WALL_LENGTH = 10; // cm - walls shorter than this will be filtered

interface PointMap {
  [key: string]: Point;
}

/**
 * Generate a key for a point based on snapped coordinates
 */
function getPointKey(x: number, y: number, snapThreshold: number): string {
  const snappedX = Math.round(x / snapThreshold) * snapThreshold;
  const snappedY = Math.round(y / snapThreshold) * snapThreshold;
  return `${snappedX},${snappedY}`;
}

/**
 * Find or create a point in the points map
 */
function findOrCreatePoint(
  points: PointMap,
  x: number,
  y: number,
  snapThreshold: number = SNAP_THRESHOLD
): Point {
  const key = getPointKey(x, y, snapThreshold);
  
  if (points[key]) {
    return points[key];
  }
  
  const newPoint: Point = {
    id: uuidv4(),
    x: Math.round(x / snapThreshold) * snapThreshold,
    y: Math.round(y / snapThreshold) * snapThreshold,
  };
  
  points[key] = newPoint;
  return newPoint;
}

/**
 * Calculate wall length from two points
 */
function calculateWallLength(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Map AI door type to application door type
 */
function mapDoorType(aiType: AIDetectedDoor['type']): DoorType {
  switch (aiType) {
    case 'hinged-left':
      return 'hinged-left';
    case 'hinged-right':
      return 'hinged-right';
    case 'sliding':
      return 'sliding';
    case 'double':
      return 'double';
    case 'pocket':
      return 'pocket';
    default:
      return 'hinged-left';
  }
}

/**
 * Find the closest wall to a door or window position
 */
function findClosestWall(
  x: number,
  y: number,
  walls: Wall[],
  points: Point[]
): { wall: Wall; position: number } | null {
  let closestWall: Wall | null = null;
  let closestDistance = Infinity;
  let closestPosition = 0.5;
  
  for (const wall of walls) {
    const startPoint = points.find(p => p.id === wall.startPointId);
    const endPoint = points.find(p => p.id === wall.endPointId);
    
    if (!startPoint || !endPoint) continue;
    
    // Calculate distance from point to wall line segment
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const wallLength = Math.sqrt(dx * dx + dy * dy);
    
    if (wallLength === 0) continue;
    
    // Calculate projection of point onto wall line
    const t = Math.max(0, Math.min(1, 
      ((x - startPoint.x) * dx + (y - startPoint.y) * dy) / (wallLength * wallLength)
    ));
    
    const projX = startPoint.x + t * dx;
    const projY = startPoint.y + t * dy;
    
    const distance = Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestWall = wall;
      closestPosition = t;
    }
  }
  
  // Only return if the door/window is reasonably close to a wall
  if (closestWall && closestDistance < 50) { // 50cm threshold
    return { wall: closestWall, position: closestPosition };
  }
  
  return null;
}

/**
 * Convert AI analysis result to FloorPlan format
 */
export function convertAIAnalysisToFloorPlan(
  analysis: AIFloorPlanAnalysis,
  scale: ScaleCalibration,
  defaultWallHeight: number = 280 // cm
): FloorPlan {
  const pointsMap: PointMap = {};
  const walls: Wall[] = [];
  const doors: Door[] = [];
  const windows: Window[] = [];
  
  // Convert walls
  for (const aiWall of analysis.walls) {
    // Skip low-confidence walls
    if (aiWall.confidence < 0.3) continue;
    
    // Convert from pixels to cm
    const startX = pixelsToCm(aiWall.startX, scale.pixelsPerCm);
    const startY = pixelsToCm(aiWall.startY, scale.pixelsPerCm);
    const endX = pixelsToCm(aiWall.endX, scale.pixelsPerCm);
    const endY = pixelsToCm(aiWall.endY, scale.pixelsPerCm);
    const thickness = Math.max(10, pixelsToCm(aiWall.thickness, scale.pixelsPerCm));
    
    // Find or create points
    const startPoint = findOrCreatePoint(pointsMap, startX, startY);
    const endPoint = findOrCreatePoint(pointsMap, endX, endY);
    
    // Skip walls that are too short
    const wallLength = calculateWallLength(startPoint, endPoint);
    if (wallLength < MIN_WALL_LENGTH) continue;
    
    // Skip if start and end are the same point
    if (startPoint.id === endPoint.id) continue;
    
    walls.push({
      id: uuidv4(),
      startPointId: startPoint.id,
      endPointId: endPoint.id,
      thickness,
      material: aiWall.isExterior ? 'concrete' : 'drywall',
      height: defaultWallHeight,
      heightMode: 'room',
    });
  }
  
  const points = Object.values(pointsMap);
  
  // Convert doors
  for (const aiDoor of analysis.doors) {
    if (aiDoor.confidence < 0.3) continue;
    
    const doorX = pixelsToCm(aiDoor.x, scale.pixelsPerCm);
    const doorY = pixelsToCm(aiDoor.y, scale.pixelsPerCm);
    const doorWidth = Math.max(70, pixelsToCm(aiDoor.width, scale.pixelsPerCm));
    
    const wallMatch = findClosestWall(doorX, doorY, walls, points);
    
    if (wallMatch) {
      doors.push({
        id: uuidv4(),
        wallId: wallMatch.wall.id,
        position: wallMatch.position,
        width: Math.min(doorWidth, 120), // Cap at 120cm
        height: 210,
        type: mapDoorType(aiDoor.type),
      });
    }
  }
  
  // Convert windows
  for (const aiWindow of analysis.windows) {
    if (aiWindow.confidence < 0.3) continue;
    
    const windowX = pixelsToCm(aiWindow.x, scale.pixelsPerCm);
    const windowY = pixelsToCm(aiWindow.y, scale.pixelsPerCm);
    const windowWidth = Math.max(60, pixelsToCm(aiWindow.width, scale.pixelsPerCm));
    const windowHeight = Math.max(60, pixelsToCm(aiWindow.height, scale.pixelsPerCm));
    
    const wallMatch = findClosestWall(windowX, windowY, walls, points);
    
    if (wallMatch) {
      windows.push({
        id: uuidv4(),
        wallId: wallMatch.wall.id,
        position: wallMatch.position,
        width: Math.min(windowWidth, 200),
        height: Math.min(windowHeight, 150),
        sillHeight: 90,
        type: 'fixed',
      });
    }
  }
  
  return {
    id: uuidv4(),
    name: 'Imported Floor Plan',
    points,
    walls,
    doors,
    windows,
    fixtures: [],
    columns: [],
    plumbingRoutes: [],
    electricalRoutes: [],
    tileSections: [],
    mainConnections: {
      waterSupply: { x: 0, y: 100 },
      drainage: { x: 0, y: 150 },
      electrical: { x: 0, y: 50 },
    },
    infrastructureNodes: [],
    roomWidth: 500,
    roomHeight: 400,
    wallHeight: defaultWallHeight,
  };
}

/**
 * Merge two collinear walls if they share an endpoint
 */
export function simplifyWalls(floorPlan: FloorPlan): FloorPlan {
  // This is a placeholder for more advanced wall simplification
  // For now, we just return the floor plan as-is
  // TODO: Implement wall merging for collinear walls
  return floorPlan;
}

/**
 * Close gaps in the floor plan where walls nearly connect
 */
export function closeWallGaps(floorPlan: FloorPlan, gapThreshold: number = 10): FloorPlan {
  const { points, walls, ...rest } = floorPlan;
  const newPoints = [...points];
  
  // Find wall endpoints that are close to other wall endpoints
  const endpointPairs: Map<string, string> = new Map();
  
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wall1Endpoints = [walls[i].startPointId, walls[i].endPointId];
      const wall2Endpoints = [walls[j].startPointId, walls[j].endPointId];
      
      for (const ep1 of wall1Endpoints) {
        for (const ep2 of wall2Endpoints) {
          if (ep1 === ep2) continue;
          
          const p1 = newPoints.find(p => p.id === ep1);
          const p2 = newPoints.find(p => p.id === ep2);
          
          if (!p1 || !p2) continue;
          
          const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          
          if (distance < gapThreshold && distance > 0) {
            // Mark these points for merging
            endpointPairs.set(ep2, ep1);
          }
        }
      }
    }
  }
  
  // Replace point references in walls
  const newWalls = walls.map(wall => {
    let startPointId = wall.startPointId;
    let endPointId = wall.endPointId;
    
    if (endpointPairs.has(startPointId)) {
      startPointId = endpointPairs.get(startPointId)!;
    }
    if (endpointPairs.has(endPointId)) {
      endPointId = endpointPairs.get(endPointId)!;
    }
    
    return { ...wall, startPointId, endPointId };
  });
  
  // Remove orphaned points
  const usedPointIds = new Set<string>();
  for (const wall of newWalls) {
    usedPointIds.add(wall.startPointId);
    usedPointIds.add(wall.endPointId);
  }
  
  const filteredPoints = newPoints.filter(p => usedPointIds.has(p.id));
  
  return {
    ...rest,
    points: filteredPoints,
    walls: newWalls,
  };
}

/**
 * Validate the converted floor plan
 */
export function validateConvertedFloorPlan(floorPlan: FloorPlan): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if we have any walls
  if (floorPlan.walls.length === 0) {
    errors.push('No walls were detected in the floor plan');
  }
  
  // Check if all wall points exist
  for (const wall of floorPlan.walls) {
    const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
    const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
    
    if (!startPoint) {
      errors.push(`Wall ${wall.id} references missing start point ${wall.startPointId}`);
    }
    if (!endPoint) {
      errors.push(`Wall ${wall.id} references missing end point ${wall.endPointId}`);
    }
  }
  
  // Check for doors on invalid walls
  for (const door of floorPlan.doors) {
    const wall = floorPlan.walls.find(w => w.id === door.wallId);
    if (!wall) {
      warnings.push(`Door ${door.id} references non-existent wall`);
    }
  }
  
  // Check for windows on invalid walls
  for (const window of floorPlan.windows) {
    const wall = floorPlan.walls.find(w => w.id === window.wallId);
    if (!wall) {
      warnings.push(`Window ${window.id} references non-existent wall`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
