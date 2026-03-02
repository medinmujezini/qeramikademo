/**
 * Model Loader Utility
 * 
 * Centralized GLTF/GLB loader with Draco compression support,
 * caching, and preloading capabilities.
 */

import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CM_TO_METERS as UNITS_CM_TO_METERS } from '@/constants/units';
import { dimensionsCmToMeters, position2Dto3D as utilPosition2Dto3D } from '@/utils/dimensions';

// Model cache to avoid reloading
const modelCache = new Map<string, THREE.Group>();
const preloadQueue: string[] = [];
let isPreloading = false;

/**
 * Preload a list of models for instant placement
 */
export function preloadModels(urls: string[]): void {
  urls.forEach(url => {
    if (!preloadQueue.includes(url)) {
      preloadQueue.push(url);
    }
  });
  processPreloadQueue();
}

async function processPreloadQueue(): Promise<void> {
  if (isPreloading || preloadQueue.length === 0) return;
  
  isPreloading = true;
  
  while (preloadQueue.length > 0) {
    const url = preloadQueue.shift();
    if (url && !modelCache.has(url)) {
      try {
        // Use drei's preload
        useGLTF.preload(url);
      } catch (error) {
        console.warn(`[ModelLoader] Failed to preload: ${url}`, error);
      }
    }
  }
  
  isPreloading = false;
}

/**
 * Get cached model or return null
 */
export function getCachedModel(url: string): THREE.Group | null {
  return modelCache.get(url) || null;
}

/**
 * Clear model cache
 */
export function clearModelCache(): void {
  modelCache.forEach((model) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  });
  modelCache.clear();
}

/**
 * Model loading state
 */
export interface ModelLoadState {
  isLoaded: boolean;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Create a fallback box geometry for furniture without 3D models
 */
export function createFallbackGeometry(
  width: number,
  height: number,
  depth: number
): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, depth);
}

/**
 * Create a material from a hex color
 */
export function createFallbackMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.7,
    metalness: 0.1,
  });
}

/**
 * Scale factor for converting cm to meters (3D units)
 * @deprecated Use CM_TO_METERS from @/constants/units instead
 */
export const CM_TO_METERS = UNITS_CM_TO_METERS;

/**
 * Convert 2D position (cm) to 3D position (meters)
 * @deprecated Use position2Dto3D from @/utils/dimensions instead
 */
export function position2Dto3D(
  x: number,
  y: number,
  height: number = 0
): [number, number, number] {
  const result = utilPosition2Dto3D({ x, y }, height);
  return [result.x, result.y, result.z];
}

/**
 * Convert dimensions from cm to meters
 * @deprecated Use dimensionsCmToMeters from @/utils/dimensions instead
 */
export function dimensions2Dto3D(dimensions: {
  width: number;
  depth: number;
  height: number;
}): { width: number; depth: number; height: number } {
  return dimensionsCmToMeters(dimensions);
}

/**
 * Get bounding box for a model or geometry
 */
export function getBoundingBox(object: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(object);
  return box;
}

/**
 * Center a model at origin and return its original center
 */
export function centerModel(model: THREE.Object3D): THREE.Vector3 {
  const box = getBoundingBox(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  return center;
}
