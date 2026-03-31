/**
 * Wall Junction Geometry — Step 3
 * 
 * Detects wall junctions where endpoints are shared and computes
 * mitered corner extensions and T-junction trims.
 */

import type { Wall, Point } from '@/types/floorPlan';

export interface JunctionInfo {
  pointId: string;
  wallIds: string[];
  type: 'corner' | 't-junction' | 'end';
  /** Bisector angle in radians for mitered corners */
  bisectorAngle?: number;
  /** Extension distance per wall (cm) to meet at miter */
  extensions: Record<string, number>;
}

/**
 * Compute wall angle from a shared point outward
 */
function wallAngleFromPoint(wall: Wall, pointId: string, points: Point[]): number {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return 0;

  // Direction going AWAY from the junction point
  if (wall.startPointId === pointId) {
    return Math.atan2(end.y - start.y, end.x - start.x);
  } else {
    return Math.atan2(start.y - end.y, start.x - end.x);
  }
}

/**
 * Normalize angle to [0, 2π)
 */
function normalizeAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r;
}

/**
 * Analyze all wall junctions in the floor plan.
 * Returns junction info per shared point.
 */
export function analyzeWallJunctions(walls: Wall[], points: Point[]): JunctionInfo[] {
  // Group walls by shared points
  const pointWalls: Record<string, string[]> = {};
  for (const wall of walls) {
    if (!pointWalls[wall.startPointId]) pointWalls[wall.startPointId] = [];
    if (!pointWalls[wall.endPointId]) pointWalls[wall.endPointId] = [];
    pointWalls[wall.startPointId].push(wall.id);
    pointWalls[wall.endPointId].push(wall.id);
  }

  const junctions: JunctionInfo[] = [];

  for (const [pointId, wallIds] of Object.entries(pointWalls)) {
    if (wallIds.length < 2) {
      junctions.push({ pointId, wallIds, type: 'end', extensions: {} });
      continue;
    }

    const connectedWalls = wallIds.map(id => walls.find(w => w.id === id)!).filter(Boolean);
    
    if (connectedWalls.length === 2) {
      // Corner junction — compute miter
      const w1 = connectedWalls[0];
      const w2 = connectedWalls[1];
      const a1 = wallAngleFromPoint(w1, pointId, points);
      const a2 = wallAngleFromPoint(w2, pointId, points);

      const bisector = (a1 + a2) / 2;
      const halfAngle = Math.abs(normalizeAngle(a2 - a1)) / 2;
      const sinHalf = Math.sin(halfAngle);

      // Extension = thickness / (2 * sin(halfAngle)) — miter geometry
      const ext1 = sinHalf > 0.01 ? (w1.thickness / 2) / Math.tan(halfAngle) : 0;
      const ext2 = sinHalf > 0.01 ? (w2.thickness / 2) / Math.tan(halfAngle) : 0;

      junctions.push({
        pointId,
        wallIds,
        type: 'corner',
        bisectorAngle: bisector,
        extensions: {
          [w1.id]: Math.min(ext1, w1.thickness * 2), // cap to prevent extreme extensions
          [w2.id]: Math.min(ext2, w2.thickness * 2),
        },
      });
    } else {
      // T-junction or multi-way junction
      const extensions: Record<string, number> = {};
      for (const w of connectedWalls) {
        // For T-junctions, extend by half the thickest intersecting wall
        const maxThickness = Math.max(...connectedWalls.map(cw => cw.thickness));
        extensions[w.id] = maxThickness / 2;
      }

      junctions.push({
        pointId,
        wallIds,
        type: 't-junction',
        extensions,
      });
    }
  }

  return junctions;
}

/**
 * Get the miter extension for a specific wall at a specific endpoint.
 * Returns how many cm to extend the wall geometry at that end.
 */
export function getWallExtension(
  wallId: string,
  pointId: string,
  junctions: JunctionInfo[]
): number {
  const junction = junctions.find(j => j.pointId === pointId && j.wallIds.includes(wallId));
  if (!junction) return 0;
  return junction.extensions[wallId] || 0;
}
