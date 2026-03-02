import * as THREE from 'three';

/**
 * Texture Pool for transient render targets
 * 
 * Manages a pool of reusable render targets to minimize VRAM allocations.
 * Textures are keyed by their descriptor and recycled when no longer needed.
 */

export interface TexturePoolDescriptor {
  width: number;
  height: number;
  format?: THREE.PixelFormat;
  type?: THREE.TextureDataType;
  minFilter?: THREE.TextureFilter;
  magFilter?: THREE.MagnificationTextureFilter;
  depthBuffer?: boolean;
  stencilBuffer?: boolean;
  samples?: number;
  colorSpace?: THREE.ColorSpace;
}

interface PooledTarget {
  target: THREE.WebGLRenderTarget;
  key: string;
  inUse: boolean;
  lastFrame: number;
}

export class TexturePool {
  private pool: Map<string, PooledTarget[]> = new Map();
  private activeTargets: Map<THREE.WebGLRenderTarget, PooledTarget> = new Map();
  private frameIndex = 0;
  private maxPoolSize = 32;
  
  /**
   * Generate a key from descriptor for pooling
   */
  private getKey(desc: TexturePoolDescriptor): string {
    return `${desc.width}x${desc.height}_${desc.format ?? THREE.RGBAFormat}_${desc.type ?? THREE.UnsignedByteType}_${desc.depthBuffer ? 'D' : ''}${desc.stencilBuffer ? 'S' : ''}_${desc.samples ?? 0}`;
  }
  
  /**
   * Acquire a render target from the pool
   */
  acquire(descriptor: TexturePoolDescriptor): THREE.WebGLRenderTarget {
    const key = this.getKey(descriptor);
    
    // Look for an available target in the pool
    const bucket = this.pool.get(key);
    if (bucket) {
      const available = bucket.find(p => !p.inUse);
      if (available) {
        available.inUse = true;
        available.lastFrame = this.frameIndex;
        this.activeTargets.set(available.target, available);
        return available.target;
      }
    }
    
    // Create new target
    const target = new THREE.WebGLRenderTarget(descriptor.width, descriptor.height, {
      format: descriptor.format ?? THREE.RGBAFormat,
      type: descriptor.type ?? THREE.UnsignedByteType,
      minFilter: descriptor.minFilter ?? THREE.LinearFilter,
      magFilter: descriptor.magFilter ?? THREE.LinearFilter,
      depthBuffer: descriptor.depthBuffer ?? false,
      stencilBuffer: descriptor.stencilBuffer ?? false,
      samples: descriptor.samples ?? 0,
    });
    
    if (descriptor.colorSpace) {
      target.texture.colorSpace = descriptor.colorSpace;
    }
    
    const pooled: PooledTarget = {
      target,
      key,
      inUse: true,
      lastFrame: this.frameIndex,
    };
    
    // Add to pool
    if (!this.pool.has(key)) {
      this.pool.set(key, []);
    }
    this.pool.get(key)!.push(pooled);
    this.activeTargets.set(target, pooled);
    
    return target;
  }
  
  /**
   * Release a render target back to the pool
   */
  release(target: THREE.WebGLRenderTarget): void {
    const pooled = this.activeTargets.get(target);
    if (pooled) {
      pooled.inUse = false;
      this.activeTargets.delete(target);
    }
  }
  
  /**
   * Begin a new frame - automatically releases all targets
   */
  beginFrame(): void {
    this.frameIndex++;
    
    // Release all active targets
    this.activeTargets.forEach(pooled => {
      pooled.inUse = false;
    });
    this.activeTargets.clear();
  }
  
  /**
   * Clean up targets unused for many frames
   */
  cleanup(maxAge: number = 120): void {
    this.pool.forEach((bucket, key) => {
      const toKeep: PooledTarget[] = [];
      
      bucket.forEach(pooled => {
        if (pooled.inUse || this.frameIndex - pooled.lastFrame < maxAge) {
          toKeep.push(pooled);
        } else {
          pooled.target.dispose();
        }
      });
      
      if (toKeep.length > 0) {
        this.pool.set(key, toKeep);
      } else {
        this.pool.delete(key);
      }
    });
    
    // Trim pool if too large
    let totalCount = 0;
    this.pool.forEach(bucket => {
      totalCount += bucket.length;
    });
    
    if (totalCount > this.maxPoolSize) {
      // Remove oldest unused targets
      const allPooled: PooledTarget[] = [];
      this.pool.forEach(bucket => {
        bucket.forEach(p => {
          if (!p.inUse) allPooled.push(p);
        });
      });
      
      allPooled.sort((a, b) => a.lastFrame - b.lastFrame);
      
      const toRemove = allPooled.slice(0, totalCount - this.maxPoolSize);
      toRemove.forEach(pooled => {
        pooled.target.dispose();
        const bucket = this.pool.get(pooled.key);
        if (bucket) {
          const idx = bucket.indexOf(pooled);
          if (idx >= 0) bucket.splice(idx, 1);
        }
      });
    }
  }
  
  /**
   * Resize all pooled targets (disposes and clears pool)
   */
  resize(): void {
    this.dispose();
  }
  
  /**
   * Get statistics about pool usage
   */
  getStats(): { total: number; inUse: number; byFormat: Record<string, number> } {
    let total = 0;
    let inUse = 0;
    const byFormat: Record<string, number> = {};
    
    this.pool.forEach((bucket, key) => {
      total += bucket.length;
      byFormat[key] = bucket.length;
      bucket.forEach(p => {
        if (p.inUse) inUse++;
      });
    });
    
    return { total, inUse, byFormat };
  }
  
  /**
   * Dispose all pooled targets
   */
  dispose(): void {
    this.pool.forEach(bucket => {
      bucket.forEach(pooled => {
        pooled.target.dispose();
      });
    });
    this.pool.clear();
    this.activeTargets.clear();
  }
}

export default TexturePool;
