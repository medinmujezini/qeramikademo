/**
 * Bridge: traced polygons (in image-pixel space) → app-format walls.
 *
 * The rest of the app stores coordinates in centimeters and uses
 * `Point` + `Wall` references. We turn each polygon edge into a wall
 * with shared points between adjacent edges.
 */
import { v4 as uuidv4 } from 'uuid';
import type { FloorPlan, Point, Wall } from '@/types/floorPlan';
import { DEFAULT_WALL_THICKNESS, DEFAULT_WALL_HEIGHT } from '@/constants/units';
import type { TracedPath } from './types';

interface BuildOptions {
  pixelsPerMeter: number;
  wallHeightMeters: number;
  wallThicknessCm?: number;
  /** Snap tolerance for merging coincident corners, in cm */
  snapCm?: number;
}

/**
 * Convert pixel coordinate → centimeters in the app's coordinate space.
 * The app uses image-Y-down for floor-plan canvas, same as input.
 */
function pxToCm(px: number, pixelsPerMeter: number): number {
  return (px / pixelsPerMeter) * 100;
}

export function buildFloorPlanFromPaths(
  paths: TracedPath[],
  opts: BuildOptions,
): { points: Point[]; walls: Wall[] } {
  const snap = opts.snapCm ?? 2; // cm — corners within this distance share a point
  const thickness = opts.wallThicknessCm ?? DEFAULT_WALL_THICKNESS;
  const height = opts.wallHeightMeters * 100; // cm

  const points: Point[] = [];
  const walls: Wall[] = [];

  const findOrCreatePoint = (xCm: number, yCm: number): string => {
    for (const p of points) {
      if (Math.abs(p.x - xCm) <= snap && Math.abs(p.y - yCm) <= snap) {
        return p.id;
      }
    }
    const id = uuidv4();
    points.push({ id, x: xCm, y: yCm });
    return id;
  };

  for (const path of paths) {
    if (!path.enabled || path.points.length < 2) continue;
    const cmPoints = path.points.map((p) => ({
      x: pxToCm(p.x, opts.pixelsPerMeter),
      y: pxToCm(p.y, opts.pixelsPerMeter),
    }));

    // Close the loop
    const ids = cmPoints.map((p) => findOrCreatePoint(p.x, p.y));
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      if (a === b) continue;
      walls.push({
        id: uuidv4(),
        startPointId: a,
        endPointId: b,
        thickness,
        material: 'drywall',
        height,
        heightMode: 'room',
      });
    }
  }

  return { points, walls };
}
