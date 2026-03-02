import * as THREE from 'three';

/**
 * HDRP-style Render Graph System
 * 
 * Features:
 * - Declarative pass definitions with input/output dependencies
 * - Automatic topological sorting
 * - Transient texture aliasing to minimize VRAM
 * - Resource pooling and recycling
 */

export interface RenderContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  width: number;
  height: number;
  deltaTime: number;
  frameIndex: number;
  getTexture(name: string): THREE.Texture | null;
  getRenderTarget(name: string): THREE.WebGLRenderTarget | null;
}

export interface RenderPassConfig {
  name: string;
  inputs: string[];
  outputs: string[];
  execute: (context: RenderContext) => void;
  enabled?: boolean;
  // Resource hints for the graph
  persistent?: string[]; // Outputs that must persist across frames
}

interface TextureDescriptor {
  width: number;
  height: number;
  format: THREE.PixelFormat;
  type: THREE.TextureDataType;
  minFilter?: THREE.TextureFilter;
  magFilter?: THREE.TextureFilter;
  generateMipmaps?: boolean;
  depthBuffer?: boolean;
  stencilBuffer?: boolean;
  samples?: number;
  count?: number; // For MRT
}

interface PooledTexture {
  target: THREE.WebGLRenderTarget;
  descriptor: TextureDescriptor;
  lastUsedFrame: number;
  aliasedTo?: string;
}

export class RenderGraph {
  private passes: RenderPassConfig[] = [];
  private sortedPasses: RenderPassConfig[] = [];
  private texturePool: Map<string, PooledTexture> = new Map();
  private textureDescriptors: Map<string, TextureDescriptor> = new Map();
  private textureAliases: Map<string, string> = new Map();
  private persistentTextures: Set<string> = new Set();
  private frameIndex = 0;
  private width = 1;
  private height = 1;
  private isDirty = true;
  
  // Shared fullscreen rendering resources
  private fsQuadGeometry: THREE.PlaneGeometry;
  private fsCamera: THREE.OrthographicCamera;
  private fsScene: THREE.Scene;
  private fsQuad: THREE.Mesh;
  
  constructor() {
    // Create shared fullscreen quad resources
    this.fsQuadGeometry = new THREE.PlaneGeometry(2, 2);
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.fsQuad = new THREE.Mesh(this.fsQuadGeometry);
    this.fsScene.add(this.fsQuad);
  }
  
  /**
   * Register a texture descriptor for allocation
   */
  registerTexture(name: string, descriptor: Partial<TextureDescriptor>): void {
    const fullDescriptor: TextureDescriptor = {
      width: descriptor.width ?? this.width,
      height: descriptor.height ?? this.height,
      format: descriptor.format ?? THREE.RGBAFormat,
      type: descriptor.type ?? THREE.UnsignedByteType,
      minFilter: descriptor.minFilter ?? THREE.LinearFilter,
      magFilter: descriptor.magFilter ?? THREE.LinearFilter,
      generateMipmaps: descriptor.generateMipmaps ?? false,
      depthBuffer: descriptor.depthBuffer ?? false,
      stencilBuffer: descriptor.stencilBuffer ?? false,
      samples: descriptor.samples ?? 0,
      count: descriptor.count ?? 1,
    };
    this.textureDescriptors.set(name, fullDescriptor);
  }
  
  /**
   * Mark a texture as persistent (not aliased, kept across frames)
   */
  markPersistent(name: string): void {
    this.persistentTextures.add(name);
  }
  
  /**
   * Add a render pass to the graph
   */
  addPass(pass: RenderPassConfig): void {
    this.passes.push(pass);
    
    // Mark persistent outputs
    if (pass.persistent) {
      pass.persistent.forEach(name => this.persistentTextures.add(name));
    }
    
    this.isDirty = true;
  }
  
  /**
   * Remove a pass by name
   */
  removePass(name: string): void {
    this.passes = this.passes.filter(p => p.name !== name);
    this.isDirty = true;
  }
  
  /**
   * Get a pass by name
   */
  getPass(name: string): RenderPassConfig | undefined {
    return this.passes.find(p => p.name === name);
  }
  
  /**
   * Enable or disable a pass
   */
  setPassEnabled(name: string, enabled: boolean): void {
    const pass = this.passes.find(p => p.name === name);
    if (pass) {
      pass.enabled = enabled;
      this.isDirty = true;
    }
  }
  
  /**
   * Compile the graph: sort passes and compute texture aliases
   */
  compile(): void {
    if (!this.isDirty) return;
    
    const enabledPasses = this.passes.filter(p => p.enabled !== false);
    
    // Topological sort using Kahn's algorithm
    this.sortedPasses = this.topologicalSort(enabledPasses);
    
    // Compute texture lifetimes and aliases
    this.computeTextureAliases();
    
    this.isDirty = false;
  }
  
  private topologicalSort(passes: RenderPassConfig[]): RenderPassConfig[] {
    const sorted: RenderPassConfig[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    // Build dependency map: output -> pass that produces it
    const producers = new Map<string, string>();
    passes.forEach(pass => {
      pass.outputs.forEach(output => {
        producers.set(output, pass.name);
      });
    });
    
    const visit = (pass: RenderPassConfig): void => {
      if (visited.has(pass.name)) return;
      if (visiting.has(pass.name)) {
        console.warn(`RenderGraph: Circular dependency detected at pass "${pass.name}"`);
        return;
      }
      
      visiting.add(pass.name);
      
      // Visit dependencies first
      pass.inputs.forEach(input => {
        const producerName = producers.get(input);
        if (producerName) {
          const producerPass = passes.find(p => p.name === producerName);
          if (producerPass) {
            visit(producerPass);
          }
        }
      });
      
      visiting.delete(pass.name);
      visited.add(pass.name);
      sorted.push(pass);
    };
    
    passes.forEach(pass => visit(pass));
    
    return sorted;
  }
  
  private computeTextureAliases(): void {
    this.textureAliases.clear();
    
    // Compute lifetime of each texture (first use to last use)
    const lifetimes = new Map<string, { start: number; end: number }>();
    
    this.sortedPasses.forEach((pass, passIndex) => {
      // Inputs extend the end of lifetime
      pass.inputs.forEach(input => {
        const lifetime = lifetimes.get(input);
        if (lifetime) {
          lifetime.end = Math.max(lifetime.end, passIndex);
        }
      });
      
      // Outputs set the start of lifetime
      pass.outputs.forEach(output => {
        if (!lifetimes.has(output)) {
          lifetimes.set(output, { start: passIndex, end: passIndex });
        } else {
          lifetimes.get(output)!.start = Math.min(lifetimes.get(output)!.start, passIndex);
        }
      });
    });
    
    // For each transient texture, try to find an alias
    const activeTextures: { name: string; end: number; descriptor: TextureDescriptor }[] = [];
    
    lifetimes.forEach((lifetime, name) => {
      // Skip persistent textures
      if (this.persistentTextures.has(name)) return;
      
      const descriptor = this.textureDescriptors.get(name);
      if (!descriptor) return;
      
      // Find a compatible texture that's no longer in use
      const compatible = activeTextures.find(active => {
        if (active.end >= lifetime.start) return false; // Still in use
        return this.descriptorsCompatible(active.descriptor, descriptor);
      });
      
      if (compatible) {
        this.textureAliases.set(name, compatible.name);
        compatible.end = lifetime.end; // Extend lifetime of aliased texture
      } else {
        activeTextures.push({ name, end: lifetime.end, descriptor });
      }
    });
    
    if (this.textureAliases.size > 0) {
      console.log(`RenderGraph: Aliased ${this.textureAliases.size} transient textures`);
    }
  }
  
  private descriptorsCompatible(a: TextureDescriptor, b: TextureDescriptor): boolean {
    return (
      a.width === b.width &&
      a.height === b.height &&
      a.format === b.format &&
      a.type === b.type &&
      a.depthBuffer === b.depthBuffer &&
      a.count === b.count
    );
  }
  
  /**
   * Get or create a render target for a texture
   */
  private getOrCreateTarget(name: string): THREE.WebGLRenderTarget | null {
    // Check for alias
    const aliasName = this.textureAliases.get(name) ?? name;
    
    // Check pool
    let pooled = this.texturePool.get(aliasName);
    if (pooled) {
      pooled.lastUsedFrame = this.frameIndex;
      if (name !== aliasName) {
        pooled.aliasedTo = name;
      }
      return pooled.target;
    }
    
    // Create new target
    const descriptor = this.textureDescriptors.get(name);
    if (!descriptor) {
      console.warn(`RenderGraph: No descriptor for texture "${name}"`);
      return null;
    }
    
    let target: THREE.WebGLRenderTarget;
    
    if (descriptor.count && descriptor.count > 1) {
      // For MRT, we create multiple separate render targets
      // Three.js 0.160 uses a different MRT approach
      // We'll create single targets and manage MRT manually
      const targets: THREE.WebGLRenderTarget[] = [];
      for (let i = 0; i < descriptor.count; i++) {
        const rt = new THREE.WebGLRenderTarget(descriptor.width, descriptor.height, {
          format: descriptor.format,
          type: descriptor.type,
          minFilter: descriptor.minFilter,
          magFilter: descriptor.magFilter as THREE.MagnificationTextureFilter,
          generateMipmaps: descriptor.generateMipmaps,
          depthBuffer: i === 0 ? descriptor.depthBuffer : false,
          stencilBuffer: i === 0 ? descriptor.stencilBuffer : false,
        });
        targets.push(rt);
      }
      // Return the first target, store others with indexed names
      target = targets[0];
      for (let i = 1; i < targets.length; i++) {
        const indexedPooled: PooledTexture = {
          target: targets[i],
          descriptor,
          lastUsedFrame: this.frameIndex,
        };
        this.texturePool.set(`${aliasName}_${i}`, indexedPooled);
      }
    } else {
      // Single target
      target = new THREE.WebGLRenderTarget(descriptor.width, descriptor.height, {
        format: descriptor.format,
        type: descriptor.type,
        minFilter: descriptor.minFilter,
        magFilter: descriptor.magFilter as THREE.MagnificationTextureFilter,
        generateMipmaps: descriptor.generateMipmaps,
        depthBuffer: descriptor.depthBuffer,
        stencilBuffer: descriptor.stencilBuffer,
        samples: descriptor.samples,
      });
    }
    
    pooled = {
      target,
      descriptor,
      lastUsedFrame: this.frameIndex,
    };
    
    this.texturePool.set(aliasName, pooled);
    return target;
  }
  
  /**
   * Execute the render graph
   */
  execute(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    deltaTime: number
  ): void {
    this.compile();
    
    // Create render context
    const context: RenderContext = {
      renderer,
      scene,
      camera,
      width: this.width,
      height: this.height,
      deltaTime,
      frameIndex: this.frameIndex,
      getTexture: (name: string) => {
        const target = this.getOrCreateTarget(name);
        if (!target) return null;
        return target.texture;
      },
      getRenderTarget: (name: string) => this.getOrCreateTarget(name),
    };
    
    // Execute passes in order
    for (const pass of this.sortedPasses) {
      try {
        pass.execute(context);
      } catch (error) {
        console.error(`RenderGraph: Error in pass "${pass.name}":`, error);
      }
    }
    
    this.frameIndex++;
  }
  
  /**
   * Get fullscreen quad resources for shader passes
   */
  getFullscreenQuad(): { geometry: THREE.PlaneGeometry; camera: THREE.OrthographicCamera; scene: THREE.Scene; quad: THREE.Mesh } {
    return {
      geometry: this.fsQuadGeometry,
      camera: this.fsCamera,
      scene: this.fsScene,
      quad: this.fsQuad,
    };
  }
  
  /**
   * Resize all textures
   */
  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    
    this.width = width;
    this.height = height;
    
    // Update all texture descriptors
    this.textureDescriptors.forEach((desc, name) => {
      desc.width = width;
      desc.height = height;
    });
    
    // Dispose and recreate pooled textures
    this.texturePool.forEach(pooled => {
      pooled.target.dispose();
    });
    this.texturePool.clear();
  }
  
  /**
   * Clean up unused textures (call periodically)
   */
  cleanupUnused(maxAge: number = 60): void {
    const toRemove: string[] = [];
    
    this.texturePool.forEach((pooled, name) => {
      if (this.frameIndex - pooled.lastUsedFrame > maxAge) {
        if (!this.persistentTextures.has(name)) {
          pooled.target.dispose();
          toRemove.push(name);
        }
      }
    });
    
    toRemove.forEach(name => this.texturePool.delete(name));
  }
  
  /**
   * Get a texture directly from the pool
   */
  getTexture(name: string): THREE.Texture | null {
    const target = this.getOrCreateTarget(name);
    if (!target) return null;
    return target.texture;
  }
  
  /**
   * Get MRT textures (returns array of textures from indexed targets)
   */
  getMRTTextures(name: string, count: number): THREE.Texture[] | null {
    const textures: THREE.Texture[] = [];
    const firstTarget = this.getOrCreateTarget(name);
    if (!firstTarget) return null;
    textures.push(firstTarget.texture);
    
    for (let i = 1; i < count; i++) {
      const pooled = this.texturePool.get(`${name}_${i}`);
      if (pooled) {
        textures.push(pooled.target.texture);
      }
    }
    
    return textures;
  }
  
  /**
   * Dispose all resources
   */
  dispose(): void {
    this.texturePool.forEach(pooled => {
      pooled.target.dispose();
    });
    this.texturePool.clear();
    this.textureDescriptors.clear();
    this.textureAliases.clear();
    this.passes = [];
    this.sortedPasses = [];
    
    this.fsQuadGeometry.dispose();
  }
}

export default RenderGraph;
