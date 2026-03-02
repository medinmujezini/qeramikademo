/**
 * GLB Model Loader for WebGPU Raytracer
 * 
 * Loads GLB/GLTF models and extracts triangle mesh data for raytracing.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface Triangle {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
  color: [number, number, number];
}

/**
 * Convert hex color string to RGB array
 */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

/**
 * Transform a vertex position by matrix, center, and scale
 */
function transformVertex(
  positions: ArrayLike<number>,
  index: number,
  matrix: THREE.Matrix4,
  center: THREE.Vector3,
  scale: number,
  yOffset: number
): [number, number, number] {
  const pos = new THREE.Vector3(
    positions[index * 3],
    positions[index * 3 + 1],
    positions[index * 3 + 2]
  );
  
  // Apply mesh's world transform
  pos.applyMatrix4(matrix);
  
  // Center and scale
  pos.sub(center);
  pos.multiplyScalar(scale);
  
  // Offset Y so model sits on floor
  pos.y += yOffset;
  
  return [pos.x, pos.y, pos.z];
}

/**
 * Load a GLB/GLTF model and extract triangle data for raytracing
 */
export async function loadGLBTriangles(
  url: string,
  color: string,
  targetSize: { width: number; depth: number; height: number }
): Promise<Triangle[]> {
  const loader = new GLTFLoader();
  
  // Set up Draco decoder for compressed models
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(dracoLoader);
  
  try {
    const gltf = await loader.loadAsync(url);
    const triangles: Triangle[] = [];
    const colorVec = hexToRgb(color);
    
    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Scale factor: convert model to target size (cm to scene units ~10cm = 1 unit)
    const sceneScale = 0.1;
    const targetW = targetSize.width * sceneScale;
    const targetD = targetSize.depth * sceneScale;
    const targetH = targetSize.height * sceneScale;
    
    // Find uniform scale to fit model in target dimensions
    const scale = Math.min(
      targetW / size.x,
      targetH / size.y,
      targetD / size.z
    ) * 0.9; // Slightly smaller to ensure it fits
    
    // Calculate Y offset so bottom of model sits at floor
    const scaledMinY = (box.min.y - center.y) * scale;
    const yOffset = -scaledMinY;
    
    // Traverse all meshes and extract triangles
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry;
        
        // Ensure geometry has position attribute
        if (!geometry.attributes.position) return;
        
        const positions = geometry.attributes.position.array;
        const indices = geometry.index?.array;
        
        // Apply world matrix to get global positions
        child.updateMatrixWorld();
        const matrix = child.matrixWorld;
        
        // Get material color if available
        let meshColor = colorVec;
        if (child.material instanceof THREE.MeshStandardMaterial && child.material.color) {
          meshColor = [child.material.color.r, child.material.color.g, child.material.color.b];
        }
        
        if (indices) {
          // Indexed geometry
          for (let i = 0; i < indices.length; i += 3) {
            const v0 = transformVertex(positions, indices[i], matrix, center, scale, yOffset);
            const v1 = transformVertex(positions, indices[i + 1], matrix, center, scale, yOffset);
            const v2 = transformVertex(positions, indices[i + 2], matrix, center, scale, yOffset);
            triangles.push({ v0, v1, v2, color: meshColor });
          }
        } else {
          // Non-indexed geometry
          const vertexCount = positions.length / 3;
          for (let i = 0; i < vertexCount; i += 3) {
            const v0 = transformVertex(positions, i, matrix, center, scale, yOffset);
            const v1 = transformVertex(positions, i + 1, matrix, center, scale, yOffset);
            const v2 = transformVertex(positions, i + 2, matrix, center, scale, yOffset);
            triangles.push({ v0, v1, v2, color: meshColor });
          }
        }
      }
    });
    
    console.log(`[GLB Loader] Loaded ${triangles.length} triangles from ${url}`);
    return triangles;
    
  } catch (error) {
    console.error('[GLB Loader] Failed to load model:', error);
    return [];
  }
}

/**
 * Create GPU buffer from triangle data
 */
export function createTriangleBuffer(
  device: GPUDevice,
  triangles: Triangle[]
): GPUBuffer {
  // Triangle struct in WGSL: 4 x vec4f = 64 bytes per triangle
  // v0 (vec3f + pad), v1 (vec3f + pad), v2 (vec3f + pad), color (vec3f + pad)
  const stride = 16 * 4; // 64 bytes
  const buffer = device.createBuffer({
    label: 'Triangle Buffer',
    size: Math.max(stride * triangles.length, stride), // At least one triangle
    usage: GPUBufferUsage.STORAGE,
    mappedAtCreation: true,
  });
  
  const data = new Float32Array(buffer.getMappedRange());
  let offset = 0;
  
  for (const tri of triangles) {
    // v0
    data[offset++] = tri.v0[0];
    data[offset++] = tri.v0[1];
    data[offset++] = tri.v0[2];
    data[offset++] = 0; // padding
    
    // v1
    data[offset++] = tri.v1[0];
    data[offset++] = tri.v1[1];
    data[offset++] = tri.v1[2];
    data[offset++] = 0; // padding
    
    // v2
    data[offset++] = tri.v2[0];
    data[offset++] = tri.v2[1];
    data[offset++] = tri.v2[2];
    data[offset++] = 0; // padding
    
    // color
    data[offset++] = tri.color[0];
    data[offset++] = tri.color[1];
    data[offset++] = tri.color[2];
    data[offset++] = 0; // padding
  }
  
  buffer.unmap();
  return buffer;
}
