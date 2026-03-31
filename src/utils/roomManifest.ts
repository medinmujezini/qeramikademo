/**
 * Room Manifest Generator
 * 
 * Creates a minimal room.json manifest alongside the GLB export.
 * Used by Unreal Engine to configure scene loading and player spawn.
 * 
 * Includes: spawn point, room dimensions, lights, materials metadata,
 * furniture metadata, and multi-floor building data for UE asset swapping.
 */

import type { FloorPlan, Point } from '@/types/floorPlan';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import type { Building } from '@/types/multiFloor';
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
  slot: string;
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

export interface ManifestFloor {
  level: number;
  name: string;
  floorToFloorHeight: number;
  yOffset: number;
  materials: ManifestMaterial[];
  furniture: ManifestFurniture[];
  lights: ManifestLight[];
}

export interface ManifestEmitter {
  position: { x: number; y: number; z: number };
  intensity: number;
  color: string;
  type: 'point';
  decay: number;
  distance: number;
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
  emissiveLights?: ManifestEmitter[];
  floors?: ManifestFloor[];
  staircases?: Array<{
    id: string;
    type: string;
    fromLevel: number;
    toLevel: number;
    position: { x: number; y: number };
    dimensions: { width: number; depth: number };
    treadMaterial: string;
    railing: string;
  }>;
  exportedAt: string;
}

function extractMaterials(floorPlan: FloorPlan): ManifestMaterial[] {
  const materials: ManifestMaterial[] = [];

  if (floorPlan.floorFinish) {
    const ff = floorPlan.floorFinish;
    const roughnessMap: Record<string, number> = { hardwood: 0.4, carpet: 0.95, tiles: 0.3, plain: 0.5 };
    materials.push({
      name: ff.surfaceType || 'floor',
      slot: 'floor',
      type: 'floor',
      color: ff.color || '#d4cdc5',
      roughness: roughnessMap[ff.surfaceType] ?? 0.5,
      metalness: 0,
      ...(ff.materialId ? { textureUrls: { albedo: ff.materialId } } : {}),
    });
  }

  (floorPlan.wallFinishes ?? []).forEach((wf) => {
    const roughnessMap: Record<string, number> = { paint: 0.7, wallpaper: 0.8, tiles: 0.3, plain: 0.9 };
    materials.push({
      name: wf.surfaceType || 'wall_paint',
      slot: `wall_${wf.wallId}`,
      type: 'wall',
      color: wf.color || '#eae6e1',
      roughness: roughnessMap[wf.surfaceType] ?? 0.7,
      metalness: 0,
    });
  });

  (floorPlan.doors ?? []).forEach((door) => {
    materials.push({ name: `door_${door.type}`, slot: `door_${door.id}`, type: 'door', color: '#7a5230', roughness: 0.45, metalness: 0 });
  });

  (floorPlan.windows ?? []).forEach((win) => {
    materials.push({ name: `window_${win.type}`, slot: `window_${win.id}`, type: 'window', color: '#e8f4f8', roughness: 0.05, metalness: 0 });
  });

  materials.push({ name: 'ceiling', slot: 'ceiling', type: 'ceiling', color: '#e8e8e8', roughness: 0.9, metalness: 0 });

  return materials;
}

function extractLights(floorPlan: FloorPlan): ManifestLight[] {
  const heightCm = floorPlan.walls[0]?.startHeight ?? 280;
  return (floorPlan.roomLights ?? []).filter(l => l.enabled).map(l => ({
    id: l.id,
    position: { x: l.cx * CM_TO_METERS, y: heightCm * CM_TO_METERS, z: l.cy * CM_TO_METERS },
    rotation: l.rotation,
    dimensions: { width: l.width * CM_TO_METERS, height: l.depth * CM_TO_METERS },
    intensity: l.intensity,
    color: l.color,
    type: 'rect' as const,
  }));
}

function extractFurniture(items: FurnitureItem[], heightCm: number): ManifestFurniture[] {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    type: item.type,
    position: {
      x: item.position.x * CM_TO_METERS,
      y: (item.category === 'lighting' ? (heightCm - item.dimensions.height) * CM_TO_METERS : item.dimensions.height / 2 * CM_TO_METERS),
      z: item.position.y * CM_TO_METERS,
    },
    rotation: item.rotation,
    dimensions: { width: item.dimensions.width, depth: item.dimensions.depth, height: item.dimensions.height },
    color: item.color,
    modelUrl: item.modelUrl,
  }));
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
  building?: Building,
): RoomManifest {
  const points = floorPlan.points;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  Object.values(points).forEach((p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  if (!isFinite(minX)) { minX = 0; maxX = 400; minY = 0; maxY = 300; }

  const widthCm = maxX - minX;
  const depthCm = maxY - minY;
  const heightCm = floorPlan.walls[0]?.startHeight ?? 280;

  const spawnX = spawnOverride ? spawnOverride.position.x : (minX + maxX) / 2;
  const spawnY = spawnOverride ? spawnOverride.position.y : (minY + maxY) / 2;
  const spawnRot = spawnOverride ? spawnOverride.rotation : 0;

  const manifest: RoomManifest = {
    projectId,
    revision,
    sceneScale: CM_TO_METERS,
    spawnPoint: { x: spawnX * CM_TO_METERS, y: 1.6, z: spawnY * CM_TO_METERS },
    spawnRotation: spawnRot,
    roomDimensions: { width: widthCm, depth: depthCm, height: heightCm },
    collisionMode: 'mesh',
    lights: extractLights(floorPlan),
    materials: extractMaterials(floorPlan),
    furniture: extractFurniture(furnitureItems ?? [], heightCm),
    exportedAt: new Date().toISOString(),
  };

  // Multi-floor data
  if (building && building.floors.length > 1) {
    manifest.floors = building.floors.map(floor => ({
      level: floor.level,
      name: floor.name,
      floorToFloorHeight: floor.floorToFloorHeight,
      yOffset: floor.level * floor.floorToFloorHeight * CM_TO_METERS,
      materials: extractMaterials(floor.floorPlan),
      furniture: [], // Per-floor furniture would need per-floor furniture context
      lights: extractLights(floor.floorPlan),
    }));

    manifest.staircases = building.staircases.map(s => ({
      id: s.id,
      type: s.type,
      fromLevel: s.fromLevel,
      toLevel: s.toLevel,
      position: { x: s.x, y: s.y },
      dimensions: { width: s.width, depth: s.depth },
      treadMaterial: s.treadMaterial,
      railing: s.railing,
    }));
  }

  return manifest;
}

/**
 * Serialize manifest to a downloadable JSON Blob.
 */
export function manifestToBlob(manifest: RoomManifest): Blob {
  const json = JSON.stringify(manifest, null, 2);
  return new Blob([json], { type: 'application/json' });
}
