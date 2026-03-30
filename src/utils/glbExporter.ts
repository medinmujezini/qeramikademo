/**
 * GLB Scene Exporter
 * 
 * Serializes the current Three.js scene (walls, floor, furniture, fixtures)
 * into a single .glb binary file with embedded PBR textures.
 * Used for Unreal Engine runtime import via glTFRuntime.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface GLBExportOptions {
  binary?: boolean;
  includeInvisible?: boolean;
  enhanceMaterials?: boolean;
}

/**
 * Enhance materials on the export scene clone so the GLB has better PBR defaults.
 * This does NOT mutate the live scene — only the clone.
 */
function enhanceExportMaterials(scene: THREE.Object3D): void {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    const mat = obj.material;
    if (!mat || Array.isArray(mat)) return; // skip multi-material
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    const name = (obj.name || '').toLowerCase();
    const colorHex = '#' + mat.color.getHexString();

    // Floor detection: mesh rotated -90° on X with large flat geometry, or named floor
    const isFloor = name.includes('floor') ||
      (obj.rotation.x < -1.5 && obj.rotation.x > -1.6 && obj.geometry instanceof THREE.PlaneGeometry);

    // Wall detection: extruded geometry or named wall
    const isWall = name.includes('wall') ||
      obj.geometry instanceof THREE.ExtrudeGeometry ||
      obj.geometry?.type === 'ExtrudeGeometry';

    // Door detection
    const isDoor = name.includes('door') || colorHex === '#8b5a2b';

    if (isFloor) {
      // Floor — very low roughness for shiny appearance in Unreal
      mat.roughness = 0.1;
      mat.metalness = 0.0;
    } else if (isWall) {
      // Walls — slight sheen, not fully matte
      if (mat.roughness > 0.85 && !mat.map) {
        mat.roughness = 0.7;
        mat.metalness = 0.0;
        // Slightly warm the default wall color
        if (colorHex === '#e5e7eb') {
          mat.color.set('#eae6e1');
        }
      }
    } else if (isDoor) {
      // Wood doors — warmer, slight sheen
      mat.roughness = 0.5;
      mat.metalness = 0.0;
    }
  });
}

/**
 * Export a Three.js scene (or specific object) to GLB binary.
 * Returns an ArrayBuffer of the .glb file.
 */
export async function exportSceneToGLB(
  scene: THREE.Object3D,
  options: GLBExportOptions = {}
): Promise<ArrayBuffer> {
  const { binary = true, enhanceMaterials = true } = options;

  // Clone the scene to avoid mutating the live scene
  const exportScene = scene.clone(true);

  // Clean up: remove helpers, controls, non-mesh objects that shouldn't export
  const toRemove: THREE.Object3D[] = [];
  exportScene.traverse((obj) => {
    if (
      obj instanceof THREE.GridHelper ||
      obj instanceof THREE.AxesHelper ||
      obj instanceof THREE.CameraHelper ||
      obj instanceof THREE.DirectionalLightHelper ||
      obj instanceof THREE.PointLightHelper ||
      obj instanceof THREE.SpotLightHelper ||
      obj.name.startsWith('__helper') ||
      obj.name.startsWith('__gizmo') ||
      obj.name === '__spawn_marker'
    ) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((obj) => obj.removeFromParent());

  // Enhance materials for better UE appearance
  if (enhanceMaterials) {
    enhanceExportMaterials(exportScene);
  }

  const exporter = new GLTFExporter();

  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      exportScene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // JSON result — shouldn't happen with binary:true but handle gracefully
          const json = JSON.stringify(result);
          const encoder = new TextEncoder();
          resolve(encoder.encode(json).buffer);
        }
      },
      (error) => {
        reject(error);
      },
      {
        binary,
        embedImages: true,
        forceIndices: true,
        truncateDrawRange: true,
      }
    );
  });
}

/**
 * Export scene to GLB and trigger a browser download.
 */
export async function downloadSceneAsGLB(
  scene: THREE.Object3D,
  filename: string = 'room.glb'
): Promise<void> {
  const buffer = await exportSceneToGLB(scene);
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Export scene to GLB and return as a Blob (for zipping with manifest).
 */
export async function exportSceneToGLBBlob(
  scene: THREE.Object3D
): Promise<Blob> {
  const buffer = await exportSceneToGLB(scene);
  return new Blob([buffer], { type: 'model/gltf-binary' });
}
