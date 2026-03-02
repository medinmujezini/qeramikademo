// Probe Volume Manager with Phase 4 Improvements
// - Probe relocation away from walls
// - Visibility-weighted blending
// - Emissive injection support

import * as THREE from 'three';
import { GIConfig } from '@/gi/GIConfig';

export interface ProbeData {
  position: THREE.Vector3;
  originalPosition: THREE.Vector3; // Original grid position before relocation
  shCoefficients: Float32Array; // 4 coefficients for L1 SH (stored as RGBA)
  isDirty: boolean;
  lastUpdateFrame: number;
  visibility: number; // Visibility weight for blending
  isRelocated: boolean; // Whether probe was moved from original position
}

export interface ProbeVolumeData {
  bounds: THREE.Box3;
  resolution: THREE.Vector3;
  spacing: number;
  probes: ProbeData[];
  texture: THREE.Data3DTexture | null;
}

// Wall representation for relocation
interface WallSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  normal: THREE.Vector3;
  thickness: number;
}

export class ProbeVolumeManager {
  private volume: ProbeVolumeData | null = null;
  private frameCount: number = 0;
  private updateQueue: number[] = [];
  private config: GIConfig;
  private walls: WallSegment[] = [];
  
  // Relocation parameters
  private readonly MIN_WALL_DISTANCE = 0.3; // Minimum distance from walls (meters)
  private readonly MAX_RELOCATION_DISTANCE = 0.5; // Max distance probe can move

  constructor(config: GIConfig) {
    this.config = config;
  }

  // Set wall geometry for probe relocation
  setWalls(walls: WallSegment[]): void {
    this.walls = walls;
    // Re-relocate all probes if volume exists
    if (this.volume) {
      this.relocateAllProbes();
    }
  }

  // Initialize probe volume from room bounds
  initialize(roomBounds: THREE.Box3): ProbeVolumeData {
    const spacing = this.config.probes.spacing;
    
    // Expand bounds slightly
    const min = roomBounds.min.clone().subScalar(spacing * 0.5);
    const max = roomBounds.max.clone().addScalar(spacing * 0.5);
    
    // Calculate resolution
    const size = new THREE.Vector3().subVectors(max, min);
    const resolution = new THREE.Vector3(
      Math.max(2, Math.ceil(size.x / spacing)),
      Math.max(2, Math.ceil(size.y / spacing)),
      Math.max(2, Math.ceil(size.z / spacing))
    );

    // Create probes
    const probes: ProbeData[] = [];

    for (let z = 0; z < resolution.z; z++) {
      for (let y = 0; y < resolution.y; y++) {
        for (let x = 0; x < resolution.x; x++) {
          const position = new THREE.Vector3(
            min.x + (x + 0.5) * spacing,
            min.y + (y + 0.5) * spacing,
            min.z + (z + 0.5) * spacing
          );

          // Initialize with ambient light approximation
          const shCoefficients = new Float32Array(4);
          this.initializeProbeWithAmbient(shCoefficients, position);

          probes.push({
            position: position.clone(),
            originalPosition: position.clone(),
            shCoefficients,
            isDirty: true,
            lastUpdateFrame: 0,
            visibility: 1.0,
            isRelocated: false,
          });
        }
      }
    }

    // Create 3D texture
    const texture = this.createProbeTexture(probes, resolution);

    this.volume = {
      bounds: new THREE.Box3(min, max),
      resolution,
      spacing,
      probes,
      texture,
    };

    // Initialize update queue with all probes
    this.updateQueue = probes.map((_, i) => i);
    
    // Relocate probes away from walls
    this.relocateAllProbes();

    return this.volume;
  }

  // Relocate all probes away from walls
  private relocateAllProbes(): void {
    if (!this.volume) return;
    
    for (const probe of this.volume.probes) {
      const relocated = this.relocateProbeAwayFromWalls(probe);
      if (relocated) {
        probe.isDirty = true;
      }
    }
    
    this.updateTexture();
  }

  // Relocate a single probe away from walls
  private relocateProbeAwayFromWalls(probe: ProbeData): boolean {
    if (this.walls.length === 0) return false;
    
    const rayDirs = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];
    
    let totalOffset = new THREE.Vector3();
    let needsRelocation = false;
    
    // Check distance to walls in each direction
    for (const dir of rayDirs) {
      const dist = this.raycastToWall(probe.originalPosition, dir);
      
      if (dist < this.MIN_WALL_DISTANCE) {
        // Too close to wall - push away
        const pushAmount = this.MIN_WALL_DISTANCE - dist;
        totalOffset.addScaledVector(dir, -pushAmount);
        needsRelocation = true;
      }
    }
    
    if (needsRelocation) {
      // Clamp relocation distance
      if (totalOffset.length() > this.MAX_RELOCATION_DISTANCE) {
        totalOffset.normalize().multiplyScalar(this.MAX_RELOCATION_DISTANCE);
      }
      
      probe.position.copy(probe.originalPosition).add(totalOffset);
      probe.isRelocated = true;
      
      // Calculate visibility based on relocation distance
      probe.visibility = 1.0 - (totalOffset.length() / this.MAX_RELOCATION_DISTANCE) * 0.3;
      
      return true;
    }
    
    return false;
  }

  // Simple raycast to find distance to nearest wall
  private raycastToWall(origin: THREE.Vector3, direction: THREE.Vector3): number {
    let minDist = Infinity;
    
    for (const wall of this.walls) {
      // Simple wall intersection test
      const wallCenter = new THREE.Vector3().lerpVectors(wall.start, wall.end, 0.5);
      const toWall = new THREE.Vector3().subVectors(wallCenter, origin);
      
      // Check if ray is heading towards wall
      const dotDir = toWall.dot(direction);
      if (dotDir > 0) {
        // Check if we're close enough to care
        const dist = this.pointToWallDistance(origin, wall);
        minDist = Math.min(minDist, dist);
      }
    }
    
    return minDist;
  }

  // Calculate distance from point to wall segment
  private pointToWallDistance(point: THREE.Vector3, wall: WallSegment): number {
    const wallVec = new THREE.Vector3().subVectors(wall.end, wall.start);
    const pointVec = new THREE.Vector3().subVectors(point, wall.start);
    
    const wallLength = wallVec.length();
    wallVec.normalize();
    
    const projection = pointVec.dot(wallVec);
    const clampedProjection = Math.max(0, Math.min(wallLength, projection));
    
    const closestPoint = wall.start.clone().addScaledVector(wallVec, clampedProjection);
    
    return point.distanceTo(closestPoint) - wall.thickness * 0.5;
  }

  // Initialize probe with basic ambient approximation
  private initializeProbeWithAmbient(sh: Float32Array, position: THREE.Vector3) {
    // Sky color contribution (blue-ish)
    const skyColor = new THREE.Color(0.5, 0.6, 0.8);
    // Ground color contribution (brown-ish)
    const groundColor = new THREE.Color(0.3, 0.25, 0.2);
    
    // Height-based blend (0 = ground, 1 = sky)
    const heightFactor = Math.min(1, Math.max(0, position.y / 3.0));
    
    // Average ambient
    const ambient = skyColor.clone().lerp(groundColor, 1 - heightFactor);
    
    // L0 band (DC component) - average irradiance
    sh[0] = (ambient.r + ambient.g + ambient.b) / 3.0 * 0.5;
    
    // L1 band - directional components
    sh[1] = heightFactor * 0.2; // Y component (up = brighter)
    sh[2] = 0.0; // Z component
    sh[3] = 0.0; // X component
  }

  // Create 3D texture from probes
  private createProbeTexture(probes: ProbeData[], resolution: THREE.Vector3): THREE.Data3DTexture {
    const width = resolution.x;
    const height = resolution.y;
    const depth = resolution.z;
    
    // RGBA for 4 SH coefficients
    const data = new Float32Array(width * height * depth * 4);
    
    for (let i = 0; i < probes.length; i++) {
      const probe = probes[i];
      const offset = i * 4;
      
      // Apply visibility weight to SH coefficients
      const visWeight = probe.visibility;
      data[offset + 0] = probe.shCoefficients[0] * visWeight;
      data[offset + 1] = probe.shCoefficients[1] * visWeight;
      data[offset + 2] = probe.shCoefficients[2] * visWeight;
      data[offset + 3] = probe.shCoefficients[3] * visWeight;
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

  // Update probes based on scene changes
  update(scene: THREE.Scene, camera: THREE.Camera): number {
    if (!this.volume) return 0;

    this.frameCount++;
    const budget = this.config.probes.updateBudget;
    let updatedCount = 0;

    // Process dirty probes up to budget
    while (updatedCount < budget && this.updateQueue.length > 0) {
      const probeIndex = this.updateQueue.shift()!;
      const probe = this.volume.probes[probeIndex];

      if (probe.isDirty) {
        this.updateProbe(probe, scene);
        probe.isDirty = false;
        probe.lastUpdateFrame = this.frameCount;
        updatedCount++;
      }
    }

    // Update texture if any probes were updated
    if (updatedCount > 0) {
      this.updateTexture();
    }

    return updatedCount;
  }

  // Update probe with visibility-weighted sampling and emissive injection
  private updateProbe(probe: ProbeData, scene: THREE.Scene) {
    const raycaster = new THREE.Raycaster();
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    let totalColor = new THREE.Color(0, 0, 0);
    let totalEmissive = new THREE.Color(0, 0, 0);
    let totalWeight = 0;

    for (const dir of directions) {
      raycaster.set(probe.position, dir);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0 && intersects[0].distance < 5.0) {
        const mesh = intersects[0].object as THREE.Mesh;
        const distance = intersects[0].distance;
        
        // Visibility-weighted contribution
        const weight = 1.0 / (1.0 + distance * 0.5);
        
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          // Diffuse color contribution
          totalColor.add(mesh.material.color.clone().multiplyScalar(weight));
          
          // Emissive injection
          if (mesh.material.emissive) {
            const emissiveIntensity = mesh.material.emissiveIntensity || 1.0;
            totalEmissive.add(
              mesh.material.emissive.clone().multiplyScalar(weight * emissiveIntensity)
            );
          }
          
          totalWeight += weight;
        }
      } else {
        // Sky contribution for unoccluded directions
        const skyWeight = 0.3;
        const upDot = Math.max(0, dir.y);
        const skyColor = new THREE.Color(0.5, 0.6, 0.8).multiplyScalar(upDot * skyWeight);
        totalColor.add(skyColor);
        totalWeight += skyWeight;
      }
    }

    if (totalWeight > 0) {
      totalColor.multiplyScalar(1 / totalWeight);
      totalEmissive.multiplyScalar(1 / totalWeight);
      
      // Combine diffuse and emissive
      const combined = totalColor.add(totalEmissive);
      
      // Update SH coefficients
      const intensity = (combined.r + combined.g + combined.b) / 3.0;
      probe.shCoefficients[0] = intensity * 0.3; // Reduced intensity for indirect
    }
  }

  // Update 3D texture with current probe data
  private updateTexture() {
    if (!this.volume?.texture) return;

    const { probes } = this.volume;
    const data = this.volume.texture.image.data as Float32Array;

    for (let i = 0; i < probes.length; i++) {
      const probe = probes[i];
      const offset = i * 4;
      
      // Apply visibility weight
      const visWeight = probe.visibility;
      data[offset + 0] = probe.shCoefficients[0] * visWeight;
      data[offset + 1] = probe.shCoefficients[1] * visWeight;
      data[offset + 2] = probe.shCoefficients[2] * visWeight;
      data[offset + 3] = probe.shCoefficients[3] * visWeight;
    }

    this.volume.texture.needsUpdate = true;
  }

  // Mark probes in a region as dirty
  markRegionDirty(bounds: THREE.Box3): number {
    if (!this.volume) return 0;

    let markedCount = 0;
    
    for (let i = 0; i < this.volume.probes.length; i++) {
      const probe = this.volume.probes[i];
      
      if (bounds.containsPoint(probe.position)) {
        if (!probe.isDirty) {
          probe.isDirty = true;
          this.updateQueue.push(i);
          markedCount++;
        }
      }
    }

    return markedCount;
  }

  // Get the probe texture for rendering
  getTexture(): THREE.Data3DTexture | null {
    return this.volume?.texture ?? null;
  }

  // Get volume bounds
  getBounds(): THREE.Box3 | null {
    return this.volume?.bounds ?? null;
  }

  // Get volume resolution
  getResolution(): THREE.Vector3 | null {
    return this.volume?.resolution ?? null;
  }

  // Get probe at specific index
  getProbe(index: number): ProbeData | null {
    return this.volume?.probes[index] ?? null;
  }

  // Get total probe count
  getProbeCount(): number {
    return this.volume?.probes.length ?? 0;
  }

  // Update config
  updateConfig(config: GIConfig) {
    this.config = config;
  }

  // Dispose resources
  dispose() {
    this.volume?.texture?.dispose();
    this.volume = null;
    this.updateQueue = [];
    this.walls = [];
  }
}
