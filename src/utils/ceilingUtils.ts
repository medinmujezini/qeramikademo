import type { Point, Wall, CeilingPlane, WallSlopeRelation, FloorPlan } from '@/types/floorPlan';
import { DEFAULT_CEILING_PLANE } from '@/types/floorPlan';

/**
 * Calculate height at any point based on ceiling plane
 */
export function calculateHeightAtPoint(
  point: Point,
  ceilingPlane: CeilingPlane
): number {
  if (!ceilingPlane.enabled || ceilingPlane.pitch === 0) {
    return ceilingPlane.baseHeight;
  }
  
  // Calculate distance along slope direction from reference point
  const dx = point.x - ceilingPlane.referencePoint.x;
  const dy = point.y - ceilingPlane.referencePoint.y;
  
  // Normalize direction vector
  const dirLength = Math.sqrt(ceilingPlane.direction.x ** 2 + ceilingPlane.direction.y ** 2);
  const normDirX = dirLength > 0 ? ceilingPlane.direction.x / dirLength : 1;
  const normDirY = dirLength > 0 ? ceilingPlane.direction.y / dirLength : 0;
  
  // Project onto slope direction vector (positive = down the slope)
  const distance = dx * normDirX + dy * normDirY;
  
  // Calculate height change based on pitch (positive distance = descending)
  const heightChange = distance * Math.tan(ceilingPlane.pitch * Math.PI / 180);
  
  return ceilingPlane.baseHeight - heightChange;
}

/**
 * Compute wall heights from ceiling plane intersection
 */
export function computeWallHeightsFromCeiling(
  wall: Wall,
  points: Point[],
  ceilingPlane: CeilingPlane
): { startHeight: number; endHeight: number } {
  const startPoint = points.find(p => p.id === wall.startPointId);
  const endPoint = points.find(p => p.id === wall.endPointId);
  
  if (!startPoint || !endPoint) {
    return { startHeight: wall.height, endHeight: wall.height };
  }
  
  return {
    startHeight: calculateHeightAtPoint(startPoint, ceilingPlane),
    endHeight: calculateHeightAtPoint(endPoint, ceilingPlane),
  };
}

/**
 * Get effective wall heights (considers override mode)
 * This is the primary function to use when getting wall heights
 */
export function getEffectiveWallHeights(
  wall: Wall,
  points: Point[],
  ceilingPlane?: CeilingPlane
): { startHeight: number; endHeight: number } {
  // If wall is in override mode, use override values
  if (wall.heightMode === 'override') {
    return {
      startHeight: wall.overrideStartHeight ?? wall.startHeight ?? wall.height,
      endHeight: wall.overrideEndHeight ?? wall.endHeight ?? wall.height,
    };
  }
  
  // If ceiling plane is enabled, compute from ceiling
  const plane = ceilingPlane ?? DEFAULT_CEILING_PLANE;
  if (plane.enabled) {
    const computed = computeWallHeightsFromCeiling(wall, points, plane);
    
    // Respect endpoint locks
    return {
      startHeight: wall.lockStartHeight 
        ? (wall.overrideStartHeight ?? wall.startHeight ?? wall.height)
        : computed.startHeight,
      endHeight: wall.lockEndHeight
        ? (wall.overrideEndHeight ?? wall.endHeight ?? wall.height)
        : computed.endHeight,
    };
  }
  
  // Fallback to wall's own values
  return {
    startHeight: wall.startHeight ?? wall.height,
    endHeight: wall.endHeight ?? wall.height,
  };
}

/**
 * Adjust ceiling plane to match a desired height at a specific point
 * Returns a new ceiling plane with adjusted baseHeight
 */
export function adjustCeilingPlaneForHeight(
  targetPoint: Point,
  targetHeight: number,
  currentPlane: CeilingPlane
): CeilingPlane {
  if (!currentPlane.enabled || currentPlane.pitch === 0) {
    // If no slope, just update base height
    return {
      ...currentPlane,
      baseHeight: targetHeight,
      referencePoint: { x: targetPoint.x, y: targetPoint.y }
    };
  }
  
  // Calculate what baseHeight would give us targetHeight at targetPoint
  // height = baseHeight - distance * tan(pitch)
  // baseHeight = height + distance * tan(pitch)
  
  const dx = targetPoint.x - currentPlane.referencePoint.x;
  const dy = targetPoint.y - currentPlane.referencePoint.y;
  
  const dirLength = Math.sqrt(currentPlane.direction.x ** 2 + currentPlane.direction.y ** 2);
  const normDirX = dirLength > 0 ? currentPlane.direction.x / dirLength : 1;
  const normDirY = dirLength > 0 ? currentPlane.direction.y / dirLength : 0;
  
  const distance = dx * normDirX + dy * normDirY;
  const heightChange = distance * Math.tan(currentPlane.pitch * Math.PI / 180);
  
  return {
    ...currentPlane,
    baseHeight: targetHeight + heightChange
  };
}

/**
 * Determine wall orientation relative to ceiling slope
 * Returns classification for rendering mode decision
 */
export function getWallSlopeRelation(
  wall: Wall,
  points: Point[],
  ceilingPlane?: CeilingPlane
): WallSlopeRelation {
  if (!ceilingPlane?.enabled || ceilingPlane.pitch === 0) {
    return 'none';
  }
  
  const startPoint = points.find(p => p.id === wall.startPointId);
  const endPoint = points.find(p => p.id === wall.endPointId);
  
  if (!startPoint || !endPoint) {
    return 'none';
  }
  
  // Calculate wall direction vector
  const wallDx = endPoint.x - startPoint.x;
  const wallDy = endPoint.y - startPoint.y;
  const wallLength = Math.sqrt(wallDx ** 2 + wallDy ** 2);
  
  if (wallLength < 1) return 'none';
  
  const wallDirX = wallDx / wallLength;
  const wallDirY = wallDy / wallLength;
  
  // Normalize ceiling slope direction
  const slopeDirLength = Math.sqrt(ceilingPlane.direction.x ** 2 + ceilingPlane.direction.y ** 2);
  const slopeDirX = slopeDirLength > 0 ? ceilingPlane.direction.x / slopeDirLength : 1;
  const slopeDirY = slopeDirLength > 0 ? ceilingPlane.direction.y / slopeDirLength : 0;
  
  // Calculate dot product (cosine of angle between vectors)
  const dotProduct = Math.abs(wallDirX * slopeDirX + wallDirY * slopeDirY);
  
  // Tolerance for classification (allows ±15° from exact alignment)
  const parallelThreshold = Math.cos(15 * Math.PI / 180); // ~0.966
  const perpendicularThreshold = Math.sin(15 * Math.PI / 180); // ~0.259
  
  if (dotProduct >= parallelThreshold) {
    return 'parallel'; // Wall runs along slope direction
  } else if (dotProduct <= perpendicularThreshold) {
    return 'perpendicular'; // Wall runs across slope direction
  } else {
    return 'oblique'; // Wall at angle to slope
  }
}

/**
 * Get compass direction label for a direction vector
 */
export function getDirectionLabel(direction: { x: number; y: number }): string {
  const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
  
  // Normalize to 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;
  
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'East';
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'Southeast';
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'South';
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'Southwest';
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'West';
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'Northwest';
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'North';
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'Northeast';
  
  return 'East';
}

/**
 * Get direction vector from compass direction
 */
export function getDirectionFromCompass(compass: string): { x: number; y: number } {
  const directions: Record<string, { x: number; y: number }> = {
    'East': { x: 1, y: 0 },
    'Southeast': { x: 0.707, y: 0.707 },
    'South': { x: 0, y: 1 },
    'Southwest': { x: -0.707, y: 0.707 },
    'West': { x: -1, y: 0 },
    'Northwest': { x: -0.707, y: -0.707 },
    'North': { x: 0, y: -1 },
    'Northeast': { x: 0.707, y: -0.707 },
  };
  
  return directions[compass] ?? { x: 1, y: 0 };
}

/**
 * Recompute all wall heights from ceiling plane
 * Returns updated walls array
 */
export function recomputeAllWallHeights(
  walls: Wall[],
  points: Point[],
  ceilingPlane: CeilingPlane
): Wall[] {
  if (!ceilingPlane.enabled) {
    return walls;
  }
  
  return walls.map(wall => {
    // Skip override mode walls
    if (wall.heightMode === 'override') {
      return wall;
    }
    
    const { startHeight, endHeight } = getEffectiveWallHeights(wall, points, ceilingPlane);
    
    return {
      ...wall,
      startHeight: Math.round(startHeight),
      endHeight: Math.round(endHeight),
    };
  });
}

/**
 * Check if a wall has effective height difference (is sloped)
 */
export function isWallEffectivelySloped(
  wall: Wall,
  points: Point[],
  ceilingPlane?: CeilingPlane
): boolean {
  const { startHeight, endHeight } = getEffectiveWallHeights(wall, points, ceilingPlane);
  return Math.abs(startHeight - endHeight) > 1; // More than 1cm difference
}

/**
 * Format ceiling plane info for display
 */
export function formatCeilingPlaneInfo(ceilingPlane: CeilingPlane): string {
  if (!ceilingPlane.enabled) {
    return 'Flat ceiling (no slope)';
  }
  
  const direction = getDirectionLabel(ceilingPlane.direction);
  return `${ceilingPlane.pitch}° slope towards ${direction}, base height ${ceilingPlane.baseHeight}cm`;
}
