import type { Wall, Point, FloorPlan } from '@/types/floorPlan';

// Slope angle presets for quick selection
export const SLOPE_PRESETS = [
  { label: 'Gentle', angle: 15, description: '15° - subtle slope' },
  { label: 'Moderate', angle: 30, description: '30° - noticeable slope' },
  { label: 'Standard', angle: 45, description: '45° - 1:1 ratio' },
  { label: 'Steep', angle: 60, description: '60° - dramatic slope' },
] as const;

// Information about height at a specific junction point
export interface JunctionHeightInfo {
  pointId: string;
  wallId: string;
  heightAtJunction: number;
  isStartPoint: boolean;
  wall: Wall;
}

// The actual shape of a wall's elevation considering connected walls
export interface WallElevationShape {
  wallId: string;
  wallLength: number;
  // Corner heights - can differ due to connected sloped walls
  topLeftHeight: number;      // Height at start point
  topRightHeight: number;     // Height at end point
  bottomLeftHeight: number;   // Always 0 (floor level)
  bottomRightHeight: number;  // Always 0 (floor level)
  // Shape classification
  isRectangular: boolean;     // true if topLeft === topRight
  isTrapezoidal: boolean;     // true if topLeft !== topRight
  // Slope info
  slopeAngle: number;         // Angle of slope in degrees (0 if rectangular)
  slopeDirection: 'ascending' | 'descending' | 'none';
}

// Height mismatch at a junction
export interface HeightMismatch {
  pointId: string;
  walls: { wallId: string; wallName: string; heightAtPoint: number }[];
  maxDifference: number;
  message: string;
}

/**
 * Get all walls connected to a specific point with their heights at that junction
 */
export function getJunctionHeights(
  pointId: string,
  walls: Wall[],
  points: Point[]
): JunctionHeightInfo[] {
  const connectedWalls = walls.filter(
    w => w.startPointId === pointId || w.endPointId === pointId
  );

  return connectedWalls.map(wall => {
    const isStartPoint = wall.startPointId === pointId;
    const heightAtJunction = isStartPoint
      ? (wall.startHeight ?? wall.height)
      : (wall.endHeight ?? wall.height);

    return {
      pointId,
      wallId: wall.id,
      heightAtJunction,
      isStartPoint,
      wall,
    };
  });
}

/**
 * Calculate the actual elevation shape of a wall considering its own heights
 * and optionally the heights of connected walls at junction points
 */
export function calculateWallElevationShape(
  wall: Wall,
  points: Point[],
  allWalls?: Wall[]
): WallElevationShape {
  const startPoint = points.find(p => p.id === wall.startPointId);
  const endPoint = points.find(p => p.id === wall.endPointId);
  
  if (!startPoint || !endPoint) {
    return {
      wallId: wall.id,
      wallLength: 0,
      topLeftHeight: wall.height,
      topRightHeight: wall.height,
      bottomLeftHeight: 0,
      bottomRightHeight: 0,
      isRectangular: true,
      isTrapezoidal: false,
      slopeAngle: 0,
      slopeDirection: 'none',
    };
  }

  const wallLength = Math.sqrt(
    (endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2
  );

  // Get this wall's own heights
  let topLeftHeight = wall.startHeight ?? wall.height;
  let topRightHeight = wall.endHeight ?? wall.height;

  // If allWalls is provided, check for connected wall influences
  if (allWalls) {
    // Check start point junction
    const startJunction = getJunctionHeights(wall.startPointId, allWalls, points);
    const otherWallsAtStart = startJunction.filter(j => j.wallId !== wall.id);
    
    // Check end point junction
    const endJunction = getJunctionHeights(wall.endPointId, allWalls, points);
    const otherWallsAtEnd = endJunction.filter(j => j.wallId !== wall.id);

    // If there are other walls at junctions with different heights,
    // the actual corner height might be influenced by them
    // For now, we use the wall's own defined heights
    // This could be extended to auto-sync heights in the future
  }

  const heightDiff = Math.abs(topLeftHeight - topRightHeight);
  const isRectangular = heightDiff < 1; // Less than 1cm difference
  const isTrapezoidal = !isRectangular;

  // Calculate slope angle
  let slopeAngle = 0;
  let slopeDirection: 'ascending' | 'descending' | 'none' = 'none';
  
  if (isTrapezoidal && wallLength > 0) {
    slopeAngle = Math.atan2(heightDiff, wallLength) * (180 / Math.PI);
    slopeDirection = topRightHeight > topLeftHeight ? 'ascending' : 'descending';
  }

  return {
    wallId: wall.id,
    wallLength,
    topLeftHeight,
    topRightHeight,
    bottomLeftHeight: 0,
    bottomRightHeight: 0,
    isRectangular,
    isTrapezoidal,
    slopeAngle,
    slopeDirection,
  };
}

/**
 * Detect height mismatches at junction points where walls meet
 */
export function detectHeightMismatches(
  walls: Wall[],
  points: Point[]
): HeightMismatch[] {
  const mismatches: HeightMismatch[] = [];
  const checkedPoints = new Set<string>();

  for (const wall of walls) {
    for (const pointId of [wall.startPointId, wall.endPointId]) {
      if (checkedPoints.has(pointId)) continue;
      checkedPoints.add(pointId);

      const junctions = getJunctionHeights(pointId, walls, points);
      if (junctions.length < 2) continue;

      const heights = junctions.map(j => j.heightAtJunction);
      const maxHeight = Math.max(...heights);
      const minHeight = Math.min(...heights);
      const maxDifference = maxHeight - minHeight;

      // Only flag if difference is significant (> 5cm)
      if (maxDifference > 5) {
        const wallDetails = junctions.map((j, idx) => ({
          wallId: j.wallId,
          wallName: `Wall ${walls.findIndex(w => w.id === j.wallId) + 1}`,
          heightAtPoint: j.heightAtJunction,
        }));

        const heightList = wallDetails
          .map(w => `${w.wallName}: ${w.heightAtPoint}cm`)
          .join(', ');

        mismatches.push({
          pointId,
          walls: wallDetails,
          maxDifference,
          message: `Height mismatch at junction: ${heightList}`,
        });
      }
    }
  }

  return mismatches;
}

/**
 * Calculate the end height based on a slope angle and wall length
 */
export function calculateHeightFromAngle(
  startHeight: number,
  wallLength: number,
  slopeAngle: number,
  direction: 'ascending' | 'descending'
): number {
  const heightChange = wallLength * Math.tan(slopeAngle * Math.PI / 180);
  return direction === 'ascending' 
    ? startHeight + heightChange 
    : startHeight - heightChange;
}

/**
 * Calculate slope angle from height difference
 */
export function calculateAngleFromHeights(
  startHeight: number,
  endHeight: number,
  wallLength: number
): number {
  if (wallLength === 0) return 0;
  const heightDiff = Math.abs(endHeight - startHeight);
  return Math.atan2(heightDiff, wallLength) * (180 / Math.PI);
}

/**
 * Get all walls connected to a specific wall (sharing a point)
 */
export function getConnectedWalls(
  wallId: string,
  walls: Wall[]
): Wall[] {
  const wall = walls.find(w => w.id === wallId);
  if (!wall) return [];

  return walls.filter(w => 
    w.id !== wallId && (
      w.startPointId === wall.startPointId ||
      w.endPointId === wall.startPointId ||
      w.startPointId === wall.endPointId ||
      w.endPointId === wall.endPointId
    )
  );
}

/**
 * Synchronize wall heights at a junction point
 * Returns updated walls with matching heights at the junction
 */
export function syncWallHeightsAtPoint(
  pointId: string,
  targetHeight: number,
  walls: Wall[]
): Partial<Wall>[] {
  const updates: Partial<Wall>[] = [];

  for (const wall of walls) {
    if (wall.startPointId === pointId) {
      updates.push({
        id: wall.id,
        startHeight: targetHeight,
      } as Partial<Wall> & { id: string });
    } else if (wall.endPointId === pointId) {
      updates.push({
        id: wall.id,
        endHeight: targetHeight,
      } as Partial<Wall> & { id: string });
    }
  }

  return updates;
}

/**
 * Format slope information for display
 */
export function formatSlopeInfo(shape: WallElevationShape): string {
  if (shape.isRectangular) {
    return `Uniform height: ${shape.topLeftHeight}cm`;
  }

  const minH = Math.min(shape.topLeftHeight, shape.topRightHeight);
  const maxH = Math.max(shape.topLeftHeight, shape.topRightHeight);
  const direction = shape.slopeDirection === 'ascending' ? '↗' : '↘';
  
  return `${direction} ${minH}cm → ${maxH}cm (${shape.slopeAngle.toFixed(1)}°)`;
}
