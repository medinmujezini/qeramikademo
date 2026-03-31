/**
 * GLB Scene Exporter
 * 
 * Serializes the current Three.js scene (walls, floor, furniture, fixtures)
 * into a single .glb binary file with embedded PBR textures.
 * Used for Unreal Engine runtime import via glTFRuntime.
 * 
 * Strips all editor-only artifacts: grids, gizmos, selection highlights,
 * spawn markers, drag planes, collision indicators, debug spheres.
 * 
 * Exports point/spot/directional lights via KHR_lights_punctual extension.
 * RectAreaLights are converted to point light proxies (glTF has no rect light).
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface GLBExportOptions {
  binary?: boolean;
  includeInvisible?: boolean;
  enhanceMaterials?: boolean;
  includeLights?: boolean;
}

/**
 * Names and prefixes that mark editor-only objects to strip on export.
 */
const EDITOR_OBJECT_PATTERNS = [
  '__helper', '__gizmo', '__spawn_marker', '__drag_plane',
  '__selection_', '__grid', '__collision_indicator',
  '__debug', '__light_marker',
];

const EDITOR_EXACT_NAMES = new Set([
  'spawn_marker', 'dragPlane', 'grid', 'axes',
]);

function isEditorObject(obj: THREE.Object3D): boolean {
  const name = (obj.name || '').toLowerCase();
  
  // Check userData flag
  if (obj.userData?.editorOnly) return true;
  
  // Check exact names
  if (EDITOR_EXACT_NAMES.has(name)) return true;
  
  // Check prefixes
  for (const pattern of EDITOR_OBJECT_PATTERNS) {
    if (name.startsWith(pattern.toLowerCase()) || obj.name.startsWith(pattern)) return true;
  }
  
  // Strip invisible meshes (drag planes, etc.) — but NOT lights
  if (obj instanceof THREE.Mesh && !obj.visible) return true;
  
  return false;
}

/**
 * Convert RectAreaLights to PointLight proxies for glTF export.
 * glTF KHR_lights_punctual only supports point, spot, and directional lights.
 */
function convertRectAreaLightsToProxies(scene: THREE.Object3D): void {
  const rectLights: { light: THREE.RectAreaLight; parent: THREE.Object3D }[] = [];
  
  scene.traverse((obj) => {
    if (obj instanceof THREE.RectAreaLight) {
      rectLights.push({ light: obj, parent: obj.parent! });
    }
  });

  for (const { light, parent } of rectLights) {
    // Approximate rect area light as a point light
    // Scale intensity: rect area lights are in nits (cd/m²), point lights in candela
    const area = light.width * light.height;
    const pointIntensity = light.intensity * area * 0.5;
    
    const proxy = new THREE.PointLight(
      light.color,
      pointIntensity,
      light.distance || 10,
      light.decay ?? 2
    );
    proxy.name = light.name || 'rectarea_proxy';
    proxy.position.copy(light.position);
    proxy.userData = { ...light.userData, originalType: 'RectAreaLight' };
    
    parent.add(proxy);
    light.removeFromParent();
  }
}

/**
 * Enhance materials on the export scene clone so the GLB has better PBR defaults.
 * Also resets all emissive overrides (selection glow artifacts).
 */
function enhanceExportMaterials(scene: THREE.Object3D): void {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    const mat = obj.material;
    if (!mat || Array.isArray(mat)) return;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    const name = (obj.name || '').toLowerCase();
    const colorHex = '#' + mat.color.getHexString();

    // Reset any selection-glow emissive to black (clean export)
    if (mat.emissive && mat.emissiveIntensity > 0) {
      const isIntentionalEmissive = name.includes('light') || name.includes('emissive') || 
        name.includes('window') || name.includes('daylight');
      if (!isIntentionalEmissive) {
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
      }
    }

    // Floor detection
    const isFloor = name.includes('floor') ||
      (obj.rotation.x < -1.5 && obj.rotation.x > -1.6 && obj.geometry instanceof THREE.PlaneGeometry);

    // Wall detection
    const isWall = name.includes('wall') ||
      obj.geometry instanceof THREE.ExtrudeGeometry ||
      obj.geometry?.type === 'ExtrudeGeometry';

    // Door detection
    const isDoor = name.includes('door') || colorHex === '#8b5a2b' || colorHex === '#7a5230';

    if (isFloor) {
      mat.roughness = 0.1;
      mat.metalness = 0.0;
    } else if (isWall) {
      if (mat.roughness > 0.85 && !mat.map) {
        mat.roughness = 0.7;
        mat.metalness = 0.0;
        if (colorHex === '#e5e7eb') {
          mat.color.set('#eae6e1');
        }
      }
    } else if (isDoor) {
      mat.roughness = 0.5;
      mat.metalness = 0.0;
    }
  });
}

/**
 * Export a Three.js scene (or specific object) to GLB binary.
 * Returns an ArrayBuffer of the .glb file.
 * Includes KHR_lights_punctual for point/spot/directional lights.
 */
export async function exportSceneToGLB(
  scene: THREE.Object3D,
  options: GLBExportOptions = {}
): Promise<ArrayBuffer> {
  const { binary = true, enhanceMaterials: doEnhance = true, includeLights = true } = options;

  // Clone the scene to avoid mutating the live scene
  const exportScene = scene.clone(true);

  // Remove editor-only objects (comprehensive sweep)
  const toRemove: THREE.Object3D[] = [];
  exportScene.traverse((obj) => {
    if (
      obj instanceof THREE.GridHelper ||
      obj instanceof THREE.AxesHelper ||
      obj instanceof THREE.CameraHelper ||
      obj instanceof THREE.DirectionalLightHelper ||
      obj instanceof THREE.PointLightHelper ||
      obj instanceof THREE.SpotLightHelper ||
      isEditorObject(obj)
    ) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((obj) => obj.removeFromParent());

  // Convert RectAreaLights to point light proxies (glTF doesn't support rect lights)
  if (includeLights) {
    convertRectAreaLightsToProxies(exportScene);
  }

  // Enhance materials for better UE appearance
  if (doEnhance) {
    enhanceExportMaterials(exportScene);
  }

  // Propagate userData to glTF extras so UE can identify objects
  exportScene.traverse((obj) => {
    if (obj.userData && Object.keys(obj.userData).length > 0) {
      // Strip editor-only flags from extras
      const { editorOnly, ...extras } = obj.userData;
      if (Object.keys(extras).length > 0) {
        obj.userData = extras;
      }
    }
  });

  const exporter = new GLTFExporter();

  return new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      exportScene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
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
        includeCustomExtensions: true,
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
