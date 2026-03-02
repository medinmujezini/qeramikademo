// Halton sequence jitter for Temporal Anti-Aliasing
// Provides sub-pixel camera jitter for temporal supersampling

import * as THREE from 'three';

/**
 * Generate a value in the Halton sequence
 * Used for quasi-random but well-distributed jitter patterns
 */
export function halton(index: number, base: number): number {
  let result = 0;
  let f = 1 / base;
  let i = index;
  
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  
  return result;
}

/**
 * Get jitter offset for a given frame index
 * Uses Halton(2,3) sequence for optimal distribution
 * Returns values in [-0.5, 0.5] range
 */
export function getJitterOffset(frameIndex: number): THREE.Vector2 {
  // Use 8-frame pattern (common for TAA)
  const index = (frameIndex % 8) + 1;
  
  return new THREE.Vector2(
    halton(index, 2) - 0.5,
    halton(index, 3) - 0.5
  );
}

/**
 * Pre-computed Halton(2,3) sequence for 16 samples
 * Slightly better distribution than 8 samples
 */
export const HALTON_SEQUENCE_16: THREE.Vector2[] = Array.from({ length: 16 }, (_, i) => 
  new THREE.Vector2(
    halton(i + 1, 2) - 0.5,
    halton(i + 1, 3) - 0.5
  )
);

/**
 * Apply jitter to a perspective camera's projection matrix
 * Modifies the projection matrix in-place
 */
export function applyJitter(
  camera: THREE.PerspectiveCamera,
  jitter: THREE.Vector2,
  resolution: THREE.Vector2,
  jitterScale: number = 1.0
): void {
  // Convert jitter from pixel space to NDC
  const jitterX = (jitter.x * jitterScale * 2) / resolution.x;
  const jitterY = (jitter.y * jitterScale * 2) / resolution.y;
  
  // Update projection matrix with jitter offset
  camera.projectionMatrix.elements[8] += jitterX;
  camera.projectionMatrix.elements[9] += jitterY;
  
  // Update inverse projection matrix
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

/**
 * Remove jitter from camera (restore original projection)
 */
export function removeJitter(camera: THREE.PerspectiveCamera): void {
  camera.updateProjectionMatrix();
}

/**
 * Jitter manager class for easier integration
 */
export class JitterManager {
  private frameIndex: number = 0;
  private currentJitter: THREE.Vector2 = new THREE.Vector2();
  private resolution: THREE.Vector2 = new THREE.Vector2(1920, 1080);
  private jitterScale: number = 1.0;
  private enabled: boolean = true;
  
  constructor(resolution?: THREE.Vector2, jitterScale: number = 1.0) {
    if (resolution) {
      this.resolution.copy(resolution);
    }
    this.jitterScale = jitterScale;
  }
  
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  setResolution(width: number, height: number): void {
    this.resolution.set(width, height);
  }
  
  setJitterScale(scale: number): void {
    this.jitterScale = scale;
  }
  
  /**
   * Get current jitter offset (in pixels)
   */
  getCurrentJitter(): THREE.Vector2 {
    return this.currentJitter.clone();
  }
  
  /**
   * Get current jitter in NDC space
   */
  getCurrentJitterNDC(): THREE.Vector2 {
    return new THREE.Vector2(
      (this.currentJitter.x * this.jitterScale * 2) / this.resolution.x,
      (this.currentJitter.y * this.jitterScale * 2) / this.resolution.y
    );
  }
  
  /**
   * Advance to next frame and apply jitter to camera
   */
  nextFrame(camera: THREE.PerspectiveCamera): void {
    this.frameIndex++;
    
    if (!this.enabled) {
      this.currentJitter.set(0, 0);
      return;
    }
    
    // Get next jitter offset from Halton sequence
    this.currentJitter = getJitterOffset(this.frameIndex);
    
    // Apply to camera
    applyJitter(camera, this.currentJitter, this.resolution, this.jitterScale);
  }
  
  /**
   * Reset jitter (call after rendering to restore camera)
   */
  reset(camera: THREE.PerspectiveCamera): void {
    removeJitter(camera);
  }
  
  getFrameIndex(): number {
    return this.frameIndex;
  }
}
