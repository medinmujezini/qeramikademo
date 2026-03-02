// Cascaded Shadow Maps with Texel-Grid Stabilization
// Provides UE-quality directional light shadows

import * as THREE from 'three';

export interface CSMConfig {
  cascadeCount: number;           // 2-4 cascades
  shadowMapSize: number;          // Per-cascade resolution (512-2048)
  maxDistance: number;            // Maximum shadow distance
  splitLambda: number;            // 0.5-0.9 (blend between log and uniform splits)
  stabilizeCascades: boolean;     // Snap to texel grid to prevent shimmering
  filterRadius: number;           // PCF filter radius
  bias: number;                   // Depth bias
  normalBias: number;             // Normal-based bias
}

interface CascadeData {
  camera: THREE.OrthographicCamera;
  renderTarget: THREE.WebGLRenderTarget;
  frustumCorners: THREE.Vector3[];
  matrix: THREE.Matrix4;
  near: number;
  far: number;
}

/**
 * CascadedShadowMap - Multi-cascade directional shadows
 * 
 * Features:
 * - Practical split scheme (logarithmic + uniform blend)
 * - Texel-grid stabilization to prevent shimmering
 * - Per-cascade light matrices
 */
export class CascadedShadowMap {
  private config: CSMConfig;
  private cascades: CascadeData[] = [];
  private lightDirection: THREE.Vector3 = new THREE.Vector3(-1, -1, -1).normalize();
  
  // Shadow atlas containing all cascades
  private shadowAtlas: THREE.WebGLRenderTarget;
  
  // Depth material for shadow rendering - critical for populating depth buffer
  private depthMaterial: THREE.MeshDepthMaterial;
  
  // Temp vectors
  private tempVec = new THREE.Vector3();
  private tempBox = new THREE.Box3();
  private frustumCorners: THREE.Vector3[] = Array.from({ length: 8 }, () => new THREE.Vector3());
  
  constructor(config: Partial<CSMConfig> = {}) {
    this.config = {
      cascadeCount: config.cascadeCount ?? 3,
      shadowMapSize: config.shadowMapSize ?? 2048, // Higher resolution for soft shadows
      maxDistance: config.maxDistance ?? 50,
      splitLambda: config.splitLambda ?? 0.75,
      stabilizeCascades: config.stabilizeCascades ?? true,
      filterRadius: config.filterRadius ?? 1.5,
      bias: config.bias ?? 0.0003, // Lower bias for less acne
      normalBias: config.normalBias ?? 0.015,
    };
    
    // Create depth material for shadow rendering
    // This is critical - without it, the G-Buffer materials won't write to the depth buffer properly
    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
      side: THREE.DoubleSide, // Capture shadows from back faces too
    });
    
    // Create shadow atlas (all cascades in one texture)
    const atlasSize = this.config.shadowMapSize * 2; // 2x2 grid for up to 4 cascades
    
    // Create depth texture with proper format for shadow sampling
    // Use UnsignedIntType for better GPU compatibility (FloatType can fail on some drivers)
    const depthTexture = new THREE.DepthTexture(atlasSize, atlasSize);
    depthTexture.format = THREE.DepthFormat;
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;
    
    this.shadowAtlas = new THREE.WebGLRenderTarget(atlasSize, atlasSize, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: true,
      depthTexture: depthTexture,
    });
    
    // Initialize cascades
    this.initializeCascades();
  }
  
  private initializeCascades(): void {
    this.cascades = [];
    
    for (let i = 0; i < this.config.cascadeCount; i++) {
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      
      const cascade: CascadeData = {
        camera,
        renderTarget: this.shadowAtlas, // All cascades share the atlas
        frustumCorners: Array.from({ length: 8 }, () => new THREE.Vector3()),
        matrix: new THREE.Matrix4(),
        near: 0,
        far: 0,
      };
      
      this.cascades.push(cascade);
    }
  }
  
  /**
   * Calculate cascade split distances using practical split scheme
   */
  private calculateSplitDistances(near: number, far: number): number[] {
    const splits: number[] = [near];
    const lambda = this.config.splitLambda;
    const range = Math.min(far, this.config.maxDistance);
    
    for (let i = 1; i <= this.config.cascadeCount; i++) {
      const p = i / this.config.cascadeCount;
      
      // Logarithmic split
      const log = near * Math.pow(range / near, p);
      
      // Uniform split
      const uniform = near + (range - near) * p;
      
      // Blend between log and uniform
      const split = lambda * log + (1 - lambda) * uniform;
      splits.push(split);
    }
    
    return splits;
  }
  
  /**
   * Get frustum corners for a depth range
   */
  private getFrustumCorners(
    camera: THREE.PerspectiveCamera,
    near: number,
    far: number,
    corners: THREE.Vector3[]
  ): void {
    const fovRad = (camera.fov * Math.PI) / 180;
    const aspect = camera.aspect;
    
    const nearHeight = 2 * Math.tan(fovRad / 2) * near;
    const nearWidth = nearHeight * aspect;
    const farHeight = 2 * Math.tan(fovRad / 2) * far;
    const farWidth = farHeight * aspect;
    
    // Near plane corners (in view space)
    corners[0].set(-nearWidth / 2, -nearHeight / 2, -near);
    corners[1].set(nearWidth / 2, -nearHeight / 2, -near);
    corners[2].set(nearWidth / 2, nearHeight / 2, -near);
    corners[3].set(-nearWidth / 2, nearHeight / 2, -near);
    
    // Far plane corners
    corners[4].set(-farWidth / 2, -farHeight / 2, -far);
    corners[5].set(farWidth / 2, -farHeight / 2, -far);
    corners[6].set(farWidth / 2, farHeight / 2, -far);
    corners[7].set(-farWidth / 2, farHeight / 2, -far);
    
    // Transform to world space
    const cameraMatrix = camera.matrixWorld;
    for (let i = 0; i < 8; i++) {
      corners[i].applyMatrix4(cameraMatrix);
    }
  }
  
  /**
   * Update cascade matrices based on camera and light direction
   */
  update(camera: THREE.PerspectiveCamera, lightDir?: THREE.Vector3): void {
    if (lightDir) {
      this.lightDirection.copy(lightDir).normalize();
    }
    
    const splits = this.calculateSplitDistances(camera.near, camera.far);
    
    for (let i = 0; i < this.config.cascadeCount; i++) {
      const cascade = this.cascades[i];
      cascade.near = splits[i];
      cascade.far = splits[i + 1];
      
      // Get frustum corners for this cascade
      this.getFrustumCorners(camera, cascade.near, cascade.far, cascade.frustumCorners);
      
      // Calculate bounding box of frustum corners
      this.tempBox.makeEmpty();
      for (const corner of cascade.frustumCorners) {
        this.tempBox.expandByPoint(corner);
      }
      
      // Get frustum center
      const center = this.tempBox.getCenter(this.tempVec);
      
      // Create light view matrix
      const lightUp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(this.lightDirection.dot(lightUp)) > 0.99) {
        lightUp.set(0, 0, 1);
      }
      
      // FIXED: Dynamically compute shadow camera distance based on frustum corners
      // This ensures all corners are in front of the shadow camera
      let maxProjDist = 0;
      for (const corner of cascade.frustumCorners) {
        // Project corner onto light direction (relative to center)
        const toCorner = corner.clone().sub(center);
        const projDist = toCorner.dot(this.lightDirection);
        // We need the max positive projection (most "behind" the center in light space)
        maxProjDist = Math.max(maxProjDist, projDist);
      }
      
      // Position camera far enough back: max extent + margin
      const cameraDistance = maxProjDist + 50; // 50 unit margin for shadow casters behind view
      const lightPosition = center.clone().sub(
        this.lightDirection.clone().multiplyScalar(cameraDistance)
      );
      
      cascade.camera.position.copy(lightPosition);
      cascade.camera.lookAt(center);
      cascade.camera.updateMatrixWorld();
      
      // Transform frustum corners to light space
      const lightViewMatrix = cascade.camera.matrixWorldInverse;
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      
      for (const corner of cascade.frustumCorners) {
        const lightSpaceCorner = corner.clone().applyMatrix4(lightViewMatrix);
        minX = Math.min(minX, lightSpaceCorner.x);
        maxX = Math.max(maxX, lightSpaceCorner.x);
        minY = Math.min(minY, lightSpaceCorner.y);
        maxY = Math.max(maxY, lightSpaceCorner.y);
        minZ = Math.min(minZ, lightSpaceCorner.z);
        maxZ = Math.max(maxZ, lightSpaceCorner.z);
      }
      
      // Texel-grid stabilization
      if (this.config.stabilizeCascades) {
        const worldUnitsPerTexel = (maxX - minX) / this.config.shadowMapSize;
        
        minX = Math.floor(minX / worldUnitsPerTexel) * worldUnitsPerTexel;
        maxX = Math.floor(maxX / worldUnitsPerTexel) * worldUnitsPerTexel;
        minY = Math.floor(minY / worldUnitsPerTexel) * worldUnitsPerTexel;
        maxY = Math.floor(maxY / worldUnitsPerTexel) * worldUnitsPerTexel;
      }
      
      // Update orthographic camera bounds
      cascade.camera.left = minX;
      cascade.camera.right = maxX;
      cascade.camera.top = maxY;
      cascade.camera.bottom = minY;
      
      // FIX: Ensure near/far are always valid positive values
      // In light space (looking down -Z), objects in front have negative Z
      // So -maxZ gives us the nearest objects, -minZ gives us the farthest
      const depthNear = -maxZ;
      const depthFar = -minZ;
      
      // Add padding to capture shadow casters behind the camera's view
      // Use tighter bounds for better depth precision (near=1.0, far=0.0 in BasicDepthPacking)
      const depthRange = depthFar - depthNear;
      const backPadding = Math.min(20, depthRange * 0.2); // Smaller back padding for precision
      const frontPadding = 5; // Small front padding
      cascade.camera.near = Math.max(0.1, depthNear - backPadding);
      cascade.camera.far = depthFar + frontPadding;
      cascade.camera.updateProjectionMatrix();
      
      // Store light-space matrix
      cascade.matrix.multiplyMatrices(
        cascade.camera.projectionMatrix,
        cascade.camera.matrixWorldInverse
      );
    }
  }
  
  /**
   * Render shadow maps for all cascades
   * Always uses depth material to ensure proper depth buffer population
   */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene
  ): void {
    const oldTarget = renderer.getRenderTarget();
    const oldClearColor = renderer.getClearColor(new THREE.Color());
    const oldClearAlpha = renderer.getClearAlpha();
    
    // Save the current viewport to restore after shadow rendering
    const oldViewport = new THREE.Vector4();
    renderer.getViewport(oldViewport);
    
    renderer.setRenderTarget(this.shadowAtlas);
    renderer.setClearColor(0x000000, 1);  // Black = far/empty in BasicDepthPacking (near=1.0, far=0.0)
    
    // FIXED: Deterministic atlas clearing - ensure full atlas is cleared before per-cascade renders
    const atlasSize = this.config.shadowMapSize * 2;
    renderer.setViewport(0, 0, atlasSize, atlasSize);
    renderer.setScissorTest(false);
    renderer.clear(true, true, false); // Clear color and depth for entire atlas
    
    const size = this.config.shadowMapSize;
    
    // CRITICAL: Override all mesh materials with depth material
    // Include ALL visible meshes by default (Three.js castShadow defaults to false)
    // Use userData.noShadowCaster to explicitly opt out
    const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.visible) {
        // Skip if explicitly disabled via userData
        if (object.userData?.noShadowCaster === true) return;
        
        originalMaterials.set(object.uuid, object.material);
        object.material = this.depthMaterial;
      }
    });
    
    for (let i = 0; i < this.config.cascadeCount; i++) {
      const cascade = this.cascades[i];
      
      // Set viewport for this cascade in the atlas
      const x = (i % 2) * size;
      const y = Math.floor(i / 2) * size;
      renderer.setViewport(x, y, size, size);
      renderer.setScissor(x, y, size, size);
      renderer.setScissorTest(true);
      renderer.clear(true, true, false); // Clear color and depth for this cascade region
      
      renderer.render(scene, cascade.camera);
    }
    
    renderer.setScissorTest(false);
    
    // Restore original materials
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const original = originalMaterials.get(object.uuid);
        if (original) {
          object.material = original;
        }
      }
    });
    
    renderer.setRenderTarget(oldTarget);
    renderer.setClearColor(oldClearColor, oldClearAlpha);
    
    // Restore the viewport to full canvas size
    renderer.setViewport(oldViewport);
  }
  
  /**
   * Get shadow map texture
   */
  getShadowTexture(): THREE.Texture {
    return this.shadowAtlas.texture; // Color buffer where MeshDepthMaterial writes depth to .r channel
  }
  
  /**
   * Get cascade matrices for shader (always returns 4 matrices)
   */
  getCascadeMatrices(): THREE.Matrix4[] {
    const matrices = this.cascades.map(c => c.matrix);
    // Pad to 4 matrices (shader expects mat4[4])
    while (matrices.length < 4) {
      matrices.push(new THREE.Matrix4()); // Identity matrix
    }
    return matrices;
  }
  
  /**
   * Get cascade split distances for shader (always returns 4 values)
   */
  getCascadeSplits(): number[] {
    const splits = this.cascades.map(c => c.far);
    // Pad to 4 splits (shader expects float[4])
    while (splits.length < 4) {
      splits.push(splits[splits.length - 1] || 100);
    }
    return splits;
  }
  
  /**
   * Get shadow uniforms for shaders
   */
  getShadowUniforms(): Record<string, { value: unknown }> {
    return {
      shadowMap: { value: this.getShadowTexture() },
      shadowMatrices: { value: this.getCascadeMatrices() },
      cascadeSplits: { value: this.getCascadeSplits() },
      cascadeCount: { value: this.config.cascadeCount },
      shadowMapSize: { value: this.config.shadowMapSize },
      shadowBias: { value: this.config.bias },
      shadowNormalBias: { value: this.config.normalBias },
      filterRadius: { value: this.config.filterRadius },
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<CSMConfig>): void {
    const needsRebuild = 
      config.cascadeCount !== undefined && config.cascadeCount !== this.config.cascadeCount ||
      config.shadowMapSize !== undefined && config.shadowMapSize !== this.config.shadowMapSize;
    
    Object.assign(this.config, config);
    
    if (needsRebuild) {
      this.dispose();
      const atlasSize = this.config.shadowMapSize * 2;
      
      // Create depth texture with proper format for shadow sampling
      // Use UnsignedIntType for better GPU compatibility
      const depthTexture = new THREE.DepthTexture(atlasSize, atlasSize);
      depthTexture.format = THREE.DepthFormat;
      depthTexture.type = THREE.UnsignedIntType;
      depthTexture.minFilter = THREE.NearestFilter;
      depthTexture.magFilter = THREE.NearestFilter;
      
      this.shadowAtlas = new THREE.WebGLRenderTarget(atlasSize, atlasSize, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: true,
        depthTexture: depthTexture,
      });
      this.initializeCascades();
    }
  }
  
  getConfig(): CSMConfig {
    return { ...this.config };
  }
  
  dispose(): void {
    this.shadowAtlas.dispose();
    this.depthMaterial.dispose();
    this.cascades = [];
  }
}
