import * as THREE from 'three';

/**
 * Ultra-Simple Shadow Map
 * 
 * Fixed 30x30 world coverage centered at origin.
 * Single orthographic camera, simple depth comparison.
 * Based on clean architecture patterns from Brandon Jones's WebGPU renderer.
 */

export interface SimpleShadowConfig {
  mapSize: number;          // Shadow map resolution (default: 2048 for soft shadows)
  worldSize: number;        // World units covered (default: 30 = -15 to +15)
  near: number;             // Shadow camera near plane
  far: number;              // Shadow camera far plane
  bias: number;             // Depth comparison bias
  softness: number;         // Soft shadow blur radius (PCF samples)
}

const defaultConfig: SimpleShadowConfig = {
  mapSize: 2048,            // Higher resolution for soft shadow quality
  worldSize: 30,            // Covers -15 to +15 in X and Z
  near: 0.5,
  far: 100,
  bias: 0.003,              // Lower bias for soft shadows
  softness: 2.0,            // Default soft shadow radius
};

export class SimpleShadowMap {
  private config: SimpleShadowConfig;
  
  // Shadow camera (orthographic) - fixed bounds
  private shadowCamera: THREE.OrthographicCamera;
  
  // Render target with depth texture
  private shadowTarget: THREE.WebGLRenderTarget;
  
  // Depth material for rendering shadow map
  private depthMaterial: THREE.MeshDepthMaterial;
  
  // Shadow matrix: world -> shadow NDC (NOT including bias to [0,1])
  // The shader will do the NDC->UV conversion
  private shadowMatrix: THREE.Matrix4;
  
  constructor(config: Partial<SimpleShadowConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    // Create orthographic shadow camera with fixed bounds
    const halfSize = this.config.worldSize / 2;
    this.shadowCamera = new THREE.OrthographicCamera(
      -halfSize, halfSize,    // left, right
      halfSize, -halfSize,    // top, bottom
      this.config.near,
      this.config.far
    );
    
    // Create render target with LINEAR filtering for soft shadow PCF
    this.shadowTarget = new THREE.WebGLRenderTarget(
      this.config.mapSize,
      this.config.mapSize,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      }
    );
    
    // Attach depth texture - this is what we sample for shadows
    this.shadowTarget.depthTexture = new THREE.DepthTexture(
      this.config.mapSize,
      this.config.mapSize
    );
    this.shadowTarget.depthTexture.format = THREE.DepthFormat;
    this.shadowTarget.depthTexture.type = THREE.UnsignedIntType;
    
    // Simple depth material
    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
    });
    
    this.shadowMatrix = new THREE.Matrix4();
  }
  
  /**
   * Update shadow camera based on light direction.
   * Camera is positioned 50 units back along light direction, looking at origin.
   */
  update(_camera: THREE.PerspectiveCamera, lightDir?: THREE.Vector3): void {
    // Default light direction if none provided
    const dir = lightDir?.clone().normalize() ?? new THREE.Vector3(-0.5, -1, -0.3).normalize();
    
    // Position camera 50 units back along light direction (opposite of where light points)
    const cameraDistance = 50;
    this.shadowCamera.position.copy(dir).multiplyScalar(-cameraDistance);
    this.shadowCamera.lookAt(0, 0, 0);
    this.shadowCamera.updateMatrixWorld(true);
    
    // Compute shadow matrix: world -> shadow NDC
    // shadowMatrix = projectionMatrix * viewMatrix
    this.shadowMatrix.multiplyMatrices(
      this.shadowCamera.projectionMatrix,
      this.shadowCamera.matrixWorldInverse
    );
  }
  
  /**
   * Render the shadow map
   */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    // Store original state
    const originalRenderTarget = renderer.getRenderTarget();
    const originalOverrideMaterial = scene.overrideMaterial;
    const originalClearColor = renderer.getClearColor(new THREE.Color());
    const originalClearAlpha = renderer.getClearAlpha();
    
    // Set up for shadow rendering
    renderer.setRenderTarget(this.shadowTarget);
    renderer.setClearColor(0xffffff, 1);  // White = far (depth 1.0)
    renderer.clear(true, true, false);
    
    // Override all materials with depth material
    scene.overrideMaterial = this.depthMaterial;
    
    // Render scene from shadow camera
    renderer.render(scene, this.shadowCamera);
    
    // Restore state
    scene.overrideMaterial = originalOverrideMaterial;
    renderer.setRenderTarget(originalRenderTarget);
    renderer.setClearColor(originalClearColor, originalClearAlpha);
  }
  
  /**
   * Get depth texture for shadow sampling
   */
  getDepthTexture(): THREE.DepthTexture | null {
    return this.shadowTarget.depthTexture;
  }
  
  /**
   * Get shadow matrix (world -> shadow NDC)
   */
  getShadowMatrix(): THREE.Matrix4 {
    return this.shadowMatrix;
  }
  
  /**
   * Get uniforms for the deferred lighting shader
   */
  getShadowUniforms(): Record<string, { value: unknown }> {
    return {
      shadowDepthTexture: { value: this.shadowTarget.depthTexture },
      shadowMatrix: { value: this.shadowMatrix.clone() },
      shadowMapSize: { value: this.config.mapSize },
      shadowBias: { value: this.config.bias },
      shadowWorldSize: { value: this.config.worldSize },
      shadowSoftness: { value: this.config.softness },
      shadowsEnabled: { value: true },
    };
  }
  
  /**
   * Update shadow softness at runtime
   */
  setSoftness(softness: number): void {
    this.config.softness = softness;
  }
  
  /**
   * Dispose resources
   */
  dispose(): void {
    this.shadowTarget.dispose();
    this.depthMaterial.dispose();
    if (this.shadowTarget.depthTexture) {
      this.shadowTarget.depthTexture.dispose();
    }
  }
}
