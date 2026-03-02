import * as THREE from 'three';
import { GIConfig } from './GIConfig';

// L1 Spherical Harmonics: 4 coefficients per RGB channel = 12 floats
// L2 Spherical Harmonics: 9 coefficients per RGB channel = 27 floats
const SH_L1_SIZE = 12;
const SH_L2_SIZE = 27;

export interface IrradianceProbe {
  id: string;
  position: THREE.Vector3;
  
  // Spherical Harmonics coefficients for irradiance
  // L1: [R0,R1,R2,R3, G0,G1,G2,G3, B0,B1,B2,B3]
  // L2: [R0-R8, G0-G8, B0-B8]
  shCoefficients: Float32Array;
  
  // Visibility data: depth moments for shadow/leak prevention
  // [mean, variance] per 6 cube directions = 12 floats
  depthMoments: Float32Array;
  
  // Update state
  isDirty: boolean;
  lastUpdateFrame: number;
  blendProgress: number;  // 0-1 for smooth transitions
  
  // Previous coefficients for blending
  prevSHCoefficients: Float32Array | null;
}

export interface ProbeVolume {
  bounds: THREE.Box3;
  spacing: number;
  resolution: THREE.Vector3;  // Grid dimensions
  probes: IrradianceProbe[];
  
  // 3D grid for fast lookup
  grid: Map<string, IrradianceProbe>;
  
  // GPU texture representation (3D texture of SH coefficients)
  shTexture: THREE.Data3DTexture | null;
  needsTextureUpdate: boolean;
}

// Create a grid key from position
function getGridKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

// Create a new probe with initialized data
export function createProbe(
  id: string,
  position: THREE.Vector3,
  shOrder: number = 1
): IrradianceProbe {
  const shSize = shOrder === 1 ? SH_L1_SIZE : SH_L2_SIZE;
  
  return {
    id,
    position: position.clone(),
    shCoefficients: new Float32Array(shSize),
    depthMoments: new Float32Array(12),  // 6 directions × 2 moments
    isDirty: true,
    lastUpdateFrame: -1,
    blendProgress: 0,
    prevSHCoefficients: null,
  };
}

// Initialize SH coefficients with ambient approximation
export function initializeProbeWithAmbient(
  probe: IrradianceProbe,
  ambientColor: THREE.Color,
  skyColor: THREE.Color,
  groundColor: THREE.Color
): void {
  const sh = probe.shCoefficients;
  
  // L0 (DC term) - average ambient
  const avgR = (ambientColor.r + skyColor.r * 0.5 + groundColor.r * 0.5) / 2;
  const avgG = (ambientColor.g + skyColor.g * 0.5 + groundColor.g * 0.5) / 2;
  const avgB = (ambientColor.b + skyColor.b * 0.5 + groundColor.b * 0.5) / 2;
  
  sh[0] = avgR * 0.886227;  // Y00 coefficient
  sh[4] = avgG * 0.886227;
  sh[8] = avgB * 0.886227;
  
  // L1 terms for sky/ground gradient
  const gradientR = (skyColor.r - groundColor.r) * 0.5;
  const gradientG = (skyColor.g - groundColor.g) * 0.5;
  const gradientB = (skyColor.b - groundColor.b) * 0.5;
  
  sh[2] = gradientR * 1.023326;  // Y10 (up direction)
  sh[6] = gradientG * 1.023326;
  sh[10] = gradientB * 1.023326;
}

// Check if a point is inside the room (not inside walls)
export function isInsideRoom(
  point: THREE.Vector3,
  walls: Array<{ startX: number; startY: number; endX: number; endY: number; thickness: number }>,
  margin: number = 0.1
): boolean {
  // Simple check: point should not be too close to any wall segment
  for (const wall of walls) {
    const wallVec = new THREE.Vector2(wall.endX - wall.startX, wall.endY - wall.startY);
    const pointVec = new THREE.Vector2(point.x - wall.startX, point.z - wall.startY);
    
    const wallLen = wallVec.length();
    if (wallLen < 0.001) continue;
    
    const t = Math.max(0, Math.min(1, pointVec.dot(wallVec) / (wallLen * wallLen)));
    const closestX = wall.startX + t * wallVec.x;
    const closestY = wall.startY + t * wallVec.y;
    
    const dist = Math.sqrt((point.x - closestX) ** 2 + (point.z - closestY) ** 2);
    
    if (dist < wall.thickness / 2 + margin) {
      return false;  // Too close to wall
    }
  }
  
  return true;
}

// Generate probe volume from room geometry
export function generateProbeVolume(
  roomBounds: THREE.Box3,
  walls: Array<{ startX: number; startY: number; endX: number; endY: number; thickness: number }>,
  config: GIConfig
): ProbeVolume {
  const spacing = config.probes.spacing;
  const shOrder = config.probes.shOrder;
  
  // Expand bounds slightly for margin
  const bounds = roomBounds.clone();
  bounds.expandByScalar(spacing * 0.5);
  
  // Calculate grid dimensions
  const size = new THREE.Vector3();
  bounds.getSize(size);
  
  const resolution = new THREE.Vector3(
    Math.max(1, Math.ceil(size.x / spacing)),
    Math.max(1, Math.ceil(size.y / spacing)),
    Math.max(1, Math.ceil(size.z / spacing))
  );
  
  const probes: IrradianceProbe[] = [];
  const grid = new Map<string, IrradianceProbe>();
  
  let probeIndex = 0;
  
  for (let ix = 0; ix < resolution.x; ix++) {
    for (let iy = 0; iy < resolution.y; iy++) {
      for (let iz = 0; iz < resolution.z; iz++) {
        const position = new THREE.Vector3(
          bounds.min.x + (ix + 0.5) * spacing,
          bounds.min.y + (iy + 0.5) * spacing,
          bounds.min.z + (iz + 0.5) * spacing
        );
        
        // Only place probes inside room (not inside walls)
        if (isInsideRoom(position, walls)) {
          const id = `probe_${probeIndex++}`;
          const probe = createProbe(id, position, shOrder);
          
          // Initialize with default ambient
          initializeProbeWithAmbient(
            probe,
            new THREE.Color(0.3, 0.3, 0.3),
            new THREE.Color(0.6, 0.7, 0.9),
            new THREE.Color(0.2, 0.2, 0.1)
          );
          
          probes.push(probe);
          grid.set(getGridKey(ix, iy, iz), probe);
        }
      }
    }
  }
  
  return {
    bounds,
    spacing,
    resolution,
    probes,
    grid,
    shTexture: null,
    needsTextureUpdate: true,
  };
}

// Get nearby probes for a world position
export function getNearbyProbes(
  volume: ProbeVolume,
  worldPos: THREE.Vector3,
  count: number = 8
): IrradianceProbe[] {
  // Sort probes by distance and return closest ones
  const sorted = [...volume.probes].sort((a, b) => {
    const distA = a.position.distanceToSquared(worldPos);
    const distB = b.position.distanceToSquared(worldPos);
    return distA - distB;
  });
  
  return sorted.slice(0, count);
}

// Sample irradiance at a position using trilinear interpolation
export function sampleIrradiance(
  volume: ProbeVolume,
  worldPos: THREE.Vector3,
  normal: THREE.Vector3
): THREE.Color {
  const nearbyProbes = getNearbyProbes(volume, worldPos, 8);
  
  if (nearbyProbes.length === 0) {
    return new THREE.Color(0.1, 0.1, 0.1);  // Fallback ambient
  }
  
  // Weighted average based on distance
  let totalWeight = 0;
  const irradiance = new THREE.Color(0, 0, 0);
  
  for (const probe of nearbyProbes) {
    const dist = probe.position.distanceTo(worldPos);
    const weight = 1 / (1 + dist * dist);
    
    // Evaluate SH for this direction
    const probeIrr = evaluateSH(probe.shCoefficients, normal);
    
    irradiance.r += probeIrr.r * weight;
    irradiance.g += probeIrr.g * weight;
    irradiance.b += probeIrr.b * weight;
    
    totalWeight += weight;
  }
  
  if (totalWeight > 0) {
    irradiance.r /= totalWeight;
    irradiance.g /= totalWeight;
    irradiance.b /= totalWeight;
  }
  
  return irradiance;
}

// Evaluate L1 Spherical Harmonics in a given direction
export function evaluateSH(
  sh: Float32Array,
  direction: THREE.Vector3
): THREE.Color {
  const dir = direction.clone().normalize();
  
  // SH basis functions for L1
  const y0 = 0.282095;                    // Y_0^0
  const y1 = 0.488603 * dir.y;            // Y_1^-1
  const y2 = 0.488603 * dir.z;            // Y_1^0
  const y3 = 0.488603 * dir.x;            // Y_1^1
  
  const r = sh[0] * y0 + sh[1] * y1 + sh[2] * y2 + sh[3] * y3;
  const g = sh[4] * y0 + sh[5] * y1 + sh[6] * y2 + sh[7] * y3;
  const b = sh[8] * y0 + sh[9] * y1 + sh[10] * y2 + sh[11] * y3;
  
  return new THREE.Color(
    Math.max(0, r),
    Math.max(0, g),
    Math.max(0, b)
  );
}

// Create 3D texture from probe volume for GPU sampling
export function createProbeTexture(volume: ProbeVolume): THREE.Data3DTexture {
  const { resolution, probes, spacing, bounds } = volume;
  
  // 4 floats per SH coefficient set (RGBA), 4 texels per probe for L1
  const width = Math.ceil(resolution.x) * 4;  // 4 texels per probe
  const height = Math.ceil(resolution.y);
  const depth = Math.ceil(resolution.z);
  
  const data = new Float32Array(width * height * depth * 4);
  
  // Fill with probe data
  for (const probe of probes) {
    // Convert world position to grid position
    const gridX = Math.floor((probe.position.x - bounds.min.x) / spacing);
    const gridY = Math.floor((probe.position.y - bounds.min.y) / spacing);
    const gridZ = Math.floor((probe.position.z - bounds.min.z) / spacing);
    
    // Write 4 texels for L1 SH (RGBA each)
    for (let i = 0; i < 4; i++) {
      const texX = gridX * 4 + i;
      const idx = ((gridZ * height + gridY) * width + texX) * 4;
      
      // Pack 3 SH coefficients into RGB, alpha unused
      data[idx + 0] = probe.shCoefficients[i];       // R channel
      data[idx + 1] = probe.shCoefficients[i + 4];   // G channel (offset by 4)
      data[idx + 2] = probe.shCoefficients[i + 8];   // B channel (offset by 8)
      data[idx + 3] = 1.0;
    }
  }
  
  const texture = new THREE.Data3DTexture(data, width, height, depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.FloatType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  
  return texture;
}

// Mark probes dirty within bounds
export function markProbesDirty(volume: ProbeVolume, bounds: THREE.Box3): number {
  let count = 0;
  
  for (const probe of volume.probes) {
    if (bounds.containsPoint(probe.position)) {
      probe.isDirty = true;
      probe.prevSHCoefficients = probe.shCoefficients.slice();
      count++;
    }
  }
  
  volume.needsTextureUpdate = true;
  return count;
}
