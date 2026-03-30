/**
 * Room Manifest Generator
 * 
 * Creates a minimal room.json manifest alongside the GLB export.
 * Used by Unreal Engine to configure scene loading and player spawn.
 */

import type { FloorPlan, Point } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';

export interface RoomManifest {
  projectId: string;
  revision: number;
  sceneScale: number;
  spawnPoint: { x: number; y: number; z: number };
  spawnRotation: number;
  roomDimensions: { width: number; depth: number; height: number };
  collisionMode: 'mesh' | 'box';
  exportedAt: string;
}

/**
 * Generate a room manifest from the current floor plan state.
 * 
 * @param floorPlan - Current floor plan data
 * @param projectId - Project identifier
 * @param revision - Export revision number (increment on re-export)
 */
export function generateRoomManifest(
  floorPlan: FloorPlan,
  projectId: string = 'local',
  revision: number = 1
): RoomManifest {
  const unitScale = UNIT_SCALE[floorPlan.unit] ?? 0.01;

  // Compute room bounding box from wall points
  const points = floorPlan.points;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  Object.values(points).forEach((p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  // Fallback if no points
  if (!isFinite(minX)) {
    minX = 0; maxX = 400;
    minY = 0; maxY = 300;
  }

  const widthCm = maxX - minX;
  const depthCm = maxY - minY;

  // Wall height — use the first wall's start height or default
  const firstWall = floorPlan.walls[0];
  const heightCm = firstWall?.startHeight ?? 280;

  // Spawn at room center, eye height (160cm)
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    projectId,
    revision,
    sceneScale: unitScale,
    spawnPoint: {
      x: centerX * unitScale,
      y: 1.6, // eye height in meters
      z: centerY * unitScale,
    },
    spawnRotation: 0,
    roomDimensions: {
      width: widthCm,
      depth: depthCm,
      height: heightCm,
    },
    collisionMode: 'mesh',
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Serialize manifest to a downloadable JSON Blob.
 */
export function manifestToBlob(manifest: RoomManifest): Blob {
  const json = JSON.stringify(manifest, null, 2);
  return new Blob([json], { type: 'application/json' });
}
