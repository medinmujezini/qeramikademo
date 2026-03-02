// Hierarchical Z-Buffer Pyramid
// Used for GPU-driven occlusion culling - the biggest performance win for architecture scenes

import * as THREE from 'three';

const HiZDownsampleVertexShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Downsample shader using MAX filter (conservative depth)
const HiZDownsampleFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D previousLevel;
uniform vec2 previousLevelSize;

varying vec2 vUv;

void main() {
  vec2 texelSize = 1.0 / previousLevelSize;
  
  // Sample 4 texels from previous level
  float d0 = texture2D(previousLevel, vUv + vec2(-0.25, -0.25) * texelSize).r;
  float d1 = texture2D(previousLevel, vUv + vec2( 0.25, -0.25) * texelSize).r;
  float d2 = texture2D(previousLevel, vUv + vec2(-0.25,  0.25) * texelSize).r;
  float d3 = texture2D(previousLevel, vUv + vec2( 0.25,  0.25) * texelSize).r;
  
  // Use MAX for conservative occlusion (object is visible if any sample sees it)
  float maxDepth = max(max(d0, d1), max(d2, d3));
  
  gl_FragColor = vec4(maxDepth, maxDepth, maxDepth, 1.0);
}
`;

export interface HiZPyramidConfig {
  maxLevels?: number;  // Max mip levels (default: 8)
}

/**
 * HiZPyramid - Hierarchical Z-Buffer for occlusion culling
 * 
 * Usage:
 * 1. Call generatePyramid() after depth pass
 * 2. Use getMipLevel() to sample for occlusion tests
 */
export class HiZPyramid {
  private width: number;
  private height: number;
  private maxLevels: number;
  
  private mipTargets: THREE.WebGLRenderTarget[] = [];
  private downsampleMaterial: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  constructor(width: number, height: number, config: HiZPyramidConfig = {}) {
    this.width = width;
    this.height = height;
    this.maxLevels = config.maxLevels ?? 8;
    
    // Create downsample material
    this.downsampleMaterial = new THREE.ShaderMaterial({
      vertexShader: HiZDownsampleVertexShader,
      fragmentShader: HiZDownsampleFragmentShader,
      uniforms: {
        previousLevel: { value: null },
        previousLevelSize: { value: new THREE.Vector2() },
      },
      depthTest: false,
      depthWrite: false,
    });
    
    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.downsampleMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create mip chain
    this.createMipChain();
  }
  
  private createMipChain(): void {
    // Dispose existing targets
    this.mipTargets.forEach(t => t.dispose());
    this.mipTargets = [];
    
    let w = Math.floor(this.width / 2);
    let h = Math.floor(this.height / 2);
    
    for (let i = 0; i < this.maxLevels && w >= 1 && h >= 1; i++) {
      const target = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RedFormat,
        type: THREE.FloatType,
        depthBuffer: false,
      });
      
      this.mipTargets.push(target);
      
      w = Math.floor(w / 2);
      h = Math.floor(h / 2);
    }
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.createMipChain();
  }
  
  /**
   * Generate the Hi-Z pyramid from a depth texture
   * Call after your depth pass
   */
  generatePyramid(renderer: THREE.WebGLRenderer, depthTexture: THREE.Texture): void {
    if (this.mipTargets.length === 0) return;
    
    const oldTarget = renderer.getRenderTarget();
    let previousTexture: THREE.Texture = depthTexture;
    let previousWidth = this.width;
    let previousHeight = this.height;
    
    for (let i = 0; i < this.mipTargets.length; i++) {
      const target = this.mipTargets[i];
      
      this.downsampleMaterial.uniforms.previousLevel.value = previousTexture;
      this.downsampleMaterial.uniforms.previousLevelSize.value.set(previousWidth, previousHeight);
      
      renderer.setRenderTarget(target);
      renderer.render(this.scene, this.camera);
      
      previousTexture = target.texture;
      previousWidth = target.width;
      previousHeight = target.height;
    }
    
    renderer.setRenderTarget(oldTarget);
  }
  
  /**
   * Get a specific mip level texture
   */
  getMipLevel(level: number): THREE.Texture | null {
    if (level < 0 || level >= this.mipTargets.length) return null;
    return this.mipTargets[level].texture;
  }
  
  /**
   * Get the number of mip levels
   */
  getLevelCount(): number {
    return this.mipTargets.length;
  }
  
  /**
   * Get all mip textures as an array
   */
  getAllMipTextures(): THREE.Texture[] {
    return this.mipTargets.map(t => t.texture);
  }
  
  /**
   * Calculate appropriate mip level for a screen-space bounding box
   * @param screenBounds Screen-space bounds [minX, minY, maxX, maxY] in pixels
   */
  calculateMipLevel(screenBounds: THREE.Vector4): number {
    const boxWidth = screenBounds.z - screenBounds.x;
    const boxHeight = screenBounds.w - screenBounds.y;
    const maxDim = Math.max(boxWidth, boxHeight);
    
    // Choose mip level where texel roughly matches box size
    const mipLevel = Math.max(0, Math.floor(Math.log2(maxDim)));
    return Math.min(mipLevel, this.mipTargets.length - 1);
  }
  
  dispose(): void {
    this.mipTargets.forEach(t => t.dispose());
    this.mipTargets = [];
    this.downsampleMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
