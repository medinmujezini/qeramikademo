/**
 * Room Manifest Generator
 * 
 * Creates a minimal room.json manifest alongside the GLB export.
 * Used by Unreal Engine to configure scene loading and player spawn.
 * 
 * Includes: spawn point, room dimensions, lights, materials metadata,
 * and furniture metadata for UE asset swapping.
 */

import type { FloorPlan, Point } from '@/types/floorPlan';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import { CM_TO_METERS } from '@/constants/units';

export interface ManifestLight {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  dimensions: { width: number; height: number };
  intensity: number;
  color: string;
  type: 'rect';
}

export interface ManifestMaterial {
  name: string;
  slot: string; // e.g. 'wall_north', 'floor', 'door_1'
  type: 'wall' | 'floor' | 'door' | 'window' | 'ceiling' | 'furniture';
  color: string;
  roughness: number;
  metalness: number;
  textureUrls?: {
    albedo?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    ao?: string;
    height?: string;
  };
}

export interface ManifestFurniture {
  id: string;
  name: string;
  category: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  dimensions: { width: number; depth: number; height: number };
  color: string;
  modelUrl?: string;
}

export interface RoomManifest {
  projectId: string;
  revision: number;
  sceneScale: number;
  spawnPoint: { x: number; y: number; z: number };
  spawnRotation: number;
  roomDimensions: { width: number; depth: number; height: number };
  collisionMode: 'mesh' | 'box';
  lights: ManifestLight[];
  materials: ManifestMaterial[];
  furniture: ManifestFurniture[];
  exportedAt: string;
}

/**
 * Generate a room manifest from the current floor plan state.
 */
export function generateRoomManifest(
  floorPlan: FloorPlan,
  projectId: string = 'local',
  revision: number = 1,
  spawnOverride?: { position: { x: number; y: number }; rotation: number },
  furnitureItems?: FurnitureItem[],
): RoomManifest {
  const unitScale = CM_TO_METERS;

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

  if (!isFinite(minX)) {
    minX = 0; maxX = 400;
    minY = 0; maxY = 300;
  }

  const widthCm = maxX - minX;
  const depthCm = maxY - minY;
  const firstWall = floorPlan.walls[0];
  const heightCm = firstWall?.startHeight ?? 280;

  const spawnX = spawnOverride ? spawnOverride.position.x : (minX + maxX) / 2;
  const spawnY = spawnOverride ? spawnOverride.position.y : (minY + maxY) / 2;
  const spawnRot = spawnOverride ? spawnOverride.rotation : 0;

  // Build lights array
  const lights: ManifestLight[] = (floorPlan.roomLights ?? [])
    .filter(l => l.enabled)
    .map(l => ({
      id: l.id,
      position: {
        x: l.cx * unitScale,
        y: heightCm * unitScale,
        z: l.cy * unitScale,
      },
      rotation: l.rotation,
      dimensions: {
        width: l.width * unitScale,
        height: l.depth * unitScale,
      },
      intensity: l.intensity,
      color: l.color,
      type: 'rect' as const,
    }));

  // Build materials array from wall finishes, floor finish
  const materials: ManifestMaterial[] = [];

  // Floor material
  if (floorPlan.floorFinish) {
    materials.push({
      name: floorPlan.floorFinish.surfaceType || 'floor',
      slot: 'floor',
      type: 'floor',
      color: floorPlan.floorFinish.color || '#d4cdc5',
      roughness: 0.5,
      metalness: 0,
    });
  }

  // Wall materials from wallFinishes
  (floorPlan.wallFinishes ?? []).forEach((wf, i) => {
    materials.push({
      name: wf.surfaceType || 'wall_paint',
      slot: `wall_${wf.wallId}`,
      type: 'wall',
      color: wf.color || '#eae6e1',
      roughness: wf.surfaceType === 'tiles' ? 0.3 : 0.7,
      metalness: 0,
    });
  });

  // Ceiling material
  materials.push({
    name: 'ceiling',
    slot: 'ceiling',
    type: 'ceiling',
    color: '#e8e8e8',
    roughness: 0.9,
    metalness: 0,
  });

  // Build furniture metadata
  const furniture: ManifestFurniture[] = (furnitureItems ?? []).map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    type: item.type,
    position: {
      x: item.position.x * unitScale,
      y: (item.category === 'lighting'
        ? (heightCm - item.dimensions.height) * unitScale
        : item.dimensions.height / 2 * unitScale),
      z: item.position.y * unitScale,
    },
    rotation: item.rotation,
    dimensions: {
      width: item.dimensions.width,
      depth: item.dimensions.depth,
      height: item.dimensions.height,
    },
    color: item.color,
    modelUrl: item.modelUrl,
  }));

  return {
    projectId,
    revision,
    sceneScale: unitScale,
    spawnPoint: {
      x: spawnX * unitScale,
      y: 1.6,
      z: spawnY * unitScale,
    },
    spawnRotation: spawnRot,
    roomDimensions: {
      width: widthCm,
      depth: depthCm,
      height: heightCm,
    },
    collisionMode: 'mesh',
    lights,
    materials,
    furniture,
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
