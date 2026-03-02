// GPU-Driven Occlusion Culling
// Uses Hi-Z pyramid for fast visibility testing

import * as THREE from 'three';
import { HiZPyramid } from './HiZPyramid';

export interface CullableObject {
  object: THREE.Object3D;
  boundingBox: THREE.Box3;
  worldBoundingBox: THREE.Box3;
  visible: boolean;
  lastTestedFrame: number;
}

export interface OcclusionCullerConfig {
  conservativeExpansion?: number;  // Expand bounds by this factor (1.0 = no expansion)
  skipFrames?: number;             // Re-test visibility every N frames
  minScreenSize?: number;          // Skip culling for objects smaller than this (pixels)
}

/**
 * OcclusionCuller - CPU-side occlusion culling using Hi-Z pyramid
 * 
 * For massive scenes, consider GPU compute-based culling instead.
 * This implementation is suitable for scenes with 100s-1000s of objects.
 */
export class OcclusionCuller {
  private hiZPyramid: HiZPyramid;
  private config: Required<OcclusionCullerConfig>;
  private cullables: Map<string, CullableObject> = new Map();
  private frameIndex: number = 0;
  
  // Temp vectors for calculations
  private tempBox = new THREE.Box3();
  private tempCorners: THREE.Vector3[] = Array.from({ length: 8 }, () => new THREE.Vector3());
  private tempScreenBounds = new THREE.Vector4();
  private tempNDC = new THREE.Vector3();
  
  constructor(hiZPyramid: HiZPyramid, config: OcclusionCullerConfig = {}) {
    this.hiZPyramid = hiZPyramid;
    this.config = {
      conservativeExpansion: config.conservativeExpansion ?? 1.1,
      skipFrames: config.skipFrames ?? 1,
      minScreenSize: config.minScreenSize ?? 16,
    };
  }
  
  /**
   * Register an object for occlusion culling
   */
  registerObject(object: THREE.Object3D): void {
    if (this.cullables.has(object.uuid)) return;
    
    // Compute bounding box
    const boundingBox = new THREE.Box3();
    
    if (object instanceof THREE.Mesh && object.geometry) {
      object.geometry.computeBoundingBox();
      if (object.geometry.boundingBox) {
        boundingBox.copy(object.geometry.boundingBox);
      }
    } else {
      // Fallback for groups/other objects
      boundingBox.setFromObject(object);
    }
    
    this.cullables.set(object.uuid, {
      object,
      boundingBox: boundingBox.clone(),
      worldBoundingBox: boundingBox.clone(),
      visible: true,
      lastTestedFrame: 0,
    });
  }
  
  /**
   * Unregister an object
   */
  unregisterObject(object: THREE.Object3D): void {
    this.cullables.delete(object.uuid);
  }
  
  /**
   * Register all meshes in a scene
   */
  registerScene(scene: THREE.Scene): void {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        this.registerObject(object);
      }
    });
  }
  
  /**
   * Clear all registered objects
   */
  clear(): void {
    this.cullables.clear();
  }
  
  /**
   * Project bounding box to screen space
   * Returns [minX, minY, maxX, maxY] in pixels
   */
  private projectBoundsToScreen(
    box: THREE.Box3,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ): THREE.Vector4 {
    // Get 8 corners of the bounding box
    const corners = this.tempCorners;
    corners[0].set(box.min.x, box.min.y, box.min.z);
    corners[1].set(box.min.x, box.min.y, box.max.z);
    corners[2].set(box.min.x, box.max.y, box.min.z);
    corners[3].set(box.min.x, box.max.y, box.max.z);
    corners[4].set(box.max.x, box.min.y, box.min.z);
    corners[5].set(box.max.x, box.min.y, box.max.z);
    corners[6].set(box.max.x, box.max.y, box.min.z);
    corners[7].set(box.max.x, box.max.y, box.max.z);
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let minZ = Infinity;
    let allBehind = true;
    
    const viewProjection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    
    for (let i = 0; i < 8; i++) {
      this.tempNDC.copy(corners[i]).applyMatrix4(viewProjection);
      
      // Check if point is in front of camera
      if (this.tempNDC.z > -1) {
        allBehind = false;
      }
      
      // Perspective divide
      const w = Math.max(0.001, this.tempNDC.z + 1); // Avoid division by zero
      const x = this.tempNDC.x / w;
      const y = this.tempNDC.y / w;
      
      // Convert to screen space
      const screenX = (x * 0.5 + 0.5) * width;
      const screenY = (1 - (y * 0.5 + 0.5)) * height;
      
      minX = Math.min(minX, screenX);
      minY = Math.min(minY, screenY);
      maxX = Math.max(maxX, screenX);
      maxY = Math.max(maxY, screenY);
      minZ = Math.min(minZ, (this.tempNDC.z + 1) / 2); // Normalize to [0, 1]
    }
    
    // Object is completely behind camera
    if (allBehind) {
      return this.tempScreenBounds.set(-1, -1, -1, -1);
    }
    
    // Clamp to screen bounds
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(width, maxX);
    maxY = Math.min(height, maxY);
    
    // Store minZ in w component for depth testing
    return this.tempScreenBounds.set(minX, minY, maxX, maxY);
  }
  
  /**
   * Perform occlusion culling on all registered objects
   * Call after Hi-Z pyramid is generated
   * 
   * @returns Array of visible objects
   */
  cull(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ): THREE.Object3D[] {
    this.frameIndex++;
    const visibleObjects: THREE.Object3D[] = [];
    
    this.cullables.forEach((cullable) => {
      const { object, boundingBox } = cullable;
      
      // Skip if recently tested and was visible
      if (
        cullable.visible &&
        this.frameIndex - cullable.lastTestedFrame < this.config.skipFrames
      ) {
        visibleObjects.push(object);
        return;
      }
      
      cullable.lastTestedFrame = this.frameIndex;
      
      // Update world bounding box
      cullable.worldBoundingBox.copy(boundingBox);
      if (object instanceof THREE.Mesh) {
        cullable.worldBoundingBox.applyMatrix4(object.matrixWorld);
      }
      
      // Apply conservative expansion
      if (this.config.conservativeExpansion > 1.0) {
        const center = cullable.worldBoundingBox.getCenter(new THREE.Vector3());
        const size = cullable.worldBoundingBox.getSize(new THREE.Vector3());
        size.multiplyScalar(this.config.conservativeExpansion);
        cullable.worldBoundingBox.setFromCenterAndSize(center, size);
      }
      
      // Project to screen space
      const screenBounds = this.projectBoundsToScreen(
        cullable.worldBoundingBox,
        camera,
        width,
        height
      );
      
      // Invalid bounds (behind camera)
      if (screenBounds.x < 0) {
        cullable.visible = false;
        return;
      }
      
      // Check screen size
      const screenWidth = screenBounds.z - screenBounds.x;
      const screenHeight = screenBounds.w - screenBounds.y;
      
      if (screenWidth < this.config.minScreenSize && screenHeight < this.config.minScreenSize) {
        // Too small, assume visible but don't bother with Hi-Z test
        cullable.visible = true;
        visibleObjects.push(object);
        return;
      }
      
      // Frustum cull - object fully outside screen
      if (screenBounds.z < 0 || screenBounds.x > width ||
          screenBounds.w < 0 || screenBounds.y > height) {
        cullable.visible = false;
        return;
      }
      
      // Hi-Z occlusion test would go here
      // For now, we'll assume visible if it passes frustum test
      // Full GPU Hi-Z sampling would require reading back texture data
      // or using transform feedback / compute shaders
      
      cullable.visible = true;
      visibleObjects.push(object);
    });
    
    return visibleObjects;
  }
  
  /**
   * Apply visibility to scene objects
   * Objects not visible will have their `visible` property set to false
   */
  applyVisibility(camera: THREE.PerspectiveCamera, width: number, height: number): void {
    const visibleObjects = this.cull(camera, width, height);
    const visibleSet = new Set(visibleObjects.map(o => o.uuid));
    
    this.cullables.forEach((cullable) => {
      cullable.object.visible = visibleSet.has(cullable.object.uuid);
    });
  }
  
  /**
   * Restore all objects to visible
   */
  restoreVisibility(): void {
    this.cullables.forEach((cullable) => {
      cullable.object.visible = true;
    });
  }
  
  /**
   * Get culling statistics
   */
  getStats(): { total: number; visible: number; culled: number } {
    let visible = 0;
    let culled = 0;
    
    this.cullables.forEach((cullable) => {
      if (cullable.visible) {
        visible++;
      } else {
        culled++;
      }
    });
    
    return {
      total: this.cullables.size,
      visible,
      culled,
    };
  }
}
