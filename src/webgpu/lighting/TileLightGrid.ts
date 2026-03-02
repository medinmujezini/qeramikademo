import * as THREE from 'three';

/**
 * Tile Light Grid for Forward+ Rendering
 * 
 * Divides the screen into tiles and assigns lights to each tile.
 * This enables efficient many-light rendering without compute shaders.
 */

export interface LightData {
  type: 'point' | 'spot' | 'directional';
  position: THREE.Vector3;
  direction?: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  range: number;
  spotAngle?: number;
  spotPenumbra?: number;
}

export interface TileLightGridConfig {
  tileSize: number;
  maxLightsPerTile: number;
  maxTotalLights: number;
}

const defaultConfig: TileLightGridConfig = {
  tileSize: 16,
  maxLightsPerTile: 32,
  maxTotalLights: 256,
};

export class TileLightGrid {
  private config: TileLightGridConfig;
  private width: number;
  private height: number;
  private tilesX: number;
  private tilesY: number;
  
  // Light data buffers
  private lightPositions: Float32Array;
  private lightColors: Float32Array;
  private lightParams: Float32Array; // range, type, spotAngle, spotPenumbra
  private lightDirections: Float32Array;
  
  // Tile data (which lights affect each tile)
  private tileLightCounts: Uint32Array;
  private tileLightIndices: Uint32Array;
  
  // Textures for GPU access
  private lightDataTexture: THREE.DataTexture;
  private tileDataTexture: THREE.DataTexture;
  
  private lightCount = 0;
  
  constructor(width: number, height: number, config?: Partial<TileLightGridConfig>) {
    this.config = { ...defaultConfig, ...config };
    this.width = width;
    this.height = height;
    
    this.tilesX = Math.ceil(width / this.config.tileSize);
    this.tilesY = Math.ceil(height / this.config.tileSize);
    
    const maxLights = this.config.maxTotalLights;
    const totalTiles = this.tilesX * this.tilesY;
    
    // Allocate buffers
    this.lightPositions = new Float32Array(maxLights * 4); // xyz + padding
    this.lightColors = new Float32Array(maxLights * 4); // rgb + intensity
    this.lightParams = new Float32Array(maxLights * 4); // range, type, spotAngle, spotPenumbra
    this.lightDirections = new Float32Array(maxLights * 4); // xyz + padding
    
    this.tileLightCounts = new Uint32Array(totalTiles);
    this.tileLightIndices = new Uint32Array(totalTiles * this.config.maxLightsPerTile);
    
    // Create light data texture (stores all light properties)
    // Each light needs 4 texels: position, color, params, direction
    const lightTexWidth = 4;
    const lightTexHeight = maxLights;
    const lightData = new Float32Array(lightTexWidth * lightTexHeight * 4);
    
    this.lightDataTexture = new THREE.DataTexture(
      lightData,
      lightTexWidth,
      lightTexHeight,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.lightDataTexture.needsUpdate = true;
    
    // Create tile data texture
    // Each tile stores light count + light indices
    const tileTexWidth = this.config.maxLightsPerTile + 1; // +1 for count
    const tileTexHeight = totalTiles;
    const tileData = new Uint16Array(tileTexWidth * tileTexHeight * 4);
    
    this.tileDataTexture = new THREE.DataTexture(
      tileData,
      tileTexWidth,
      tileTexHeight,
      THREE.RGBAIntegerFormat,
      THREE.UnsignedShortType
    );
    (this.tileDataTexture as any).internalFormat = 'RGBA16UI';
    this.tileDataTexture.needsUpdate = true;
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.tilesX = Math.ceil(width / this.config.tileSize);
    this.tilesY = Math.ceil(height / this.config.tileSize);
    
    const totalTiles = this.tilesX * this.tilesY;
    
    // Reallocate tile buffers
    this.tileLightCounts = new Uint32Array(totalTiles);
    this.tileLightIndices = new Uint32Array(totalTiles * this.config.maxLightsPerTile);
    
    // Recreate tile texture
    const tileTexWidth = this.config.maxLightsPerTile + 1;
    const tileTexHeight = totalTiles;
    const tileData = new Uint16Array(tileTexWidth * tileTexHeight * 4);
    
    this.tileDataTexture.dispose();
    this.tileDataTexture = new THREE.DataTexture(
      tileData,
      tileTexWidth,
      tileTexHeight,
      THREE.RGBAIntegerFormat,
      THREE.UnsignedShortType
    );
    (this.tileDataTexture as any).internalFormat = 'RGBA16UI';
    this.tileDataTexture.needsUpdate = true;
  }
  
  /**
   * Update light grid from scene lights
   */
  updateFromScene(scene: THREE.Scene, camera: THREE.Camera): void {
    const lights: LightData[] = [];
    
    // Extract lights from scene
    scene.traverse(obj => {
      if (obj instanceof THREE.PointLight) {
        lights.push({
          type: 'point',
          position: obj.getWorldPosition(new THREE.Vector3()),
          color: obj.color.clone(),
          intensity: obj.intensity,
          range: obj.distance > 0 ? obj.distance : 50,
        });
      } else if (obj instanceof THREE.SpotLight) {
        lights.push({
          type: 'spot',
          position: obj.getWorldPosition(new THREE.Vector3()),
          direction: obj.getWorldDirection(new THREE.Vector3()),
          color: obj.color.clone(),
          intensity: obj.intensity,
          range: obj.distance > 0 ? obj.distance : 50,
          spotAngle: obj.angle,
          spotPenumbra: obj.penumbra,
        });
      } else if (obj instanceof THREE.DirectionalLight) {
        lights.push({
          type: 'directional',
          position: obj.getWorldPosition(new THREE.Vector3()),
          direction: obj.getWorldDirection(new THREE.Vector3()),
          color: obj.color.clone(),
          intensity: obj.intensity,
          range: Infinity,
        });
      }
    });
    
    this.updateLights(lights, camera);
  }
  
  /**
   * Update lights and rebuild tile grid
   */
  updateLights(lights: LightData[], camera: THREE.Camera): void {
    this.lightCount = Math.min(lights.length, this.config.maxTotalLights);
    
    // Update light data arrays
    for (let i = 0; i < this.lightCount; i++) {
      const light = lights[i];
      const offset = i * 4;
      
      // Position
      this.lightPositions[offset] = light.position.x;
      this.lightPositions[offset + 1] = light.position.y;
      this.lightPositions[offset + 2] = light.position.z;
      this.lightPositions[offset + 3] = 1.0;
      
      // Color + intensity
      this.lightColors[offset] = light.color.r;
      this.lightColors[offset + 1] = light.color.g;
      this.lightColors[offset + 2] = light.color.b;
      this.lightColors[offset + 3] = light.intensity;
      
      // Params
      const typeCode = light.type === 'point' ? 0 : light.type === 'spot' ? 1 : 2;
      this.lightParams[offset] = light.range;
      this.lightParams[offset + 1] = typeCode;
      this.lightParams[offset + 2] = light.spotAngle ?? 0;
      this.lightParams[offset + 3] = light.spotPenumbra ?? 0;
      
      // Direction
      if (light.direction) {
        this.lightDirections[offset] = light.direction.x;
        this.lightDirections[offset + 1] = light.direction.y;
        this.lightDirections[offset + 2] = light.direction.z;
      }
    }
    
    // Update light data texture
    const lightData = this.lightDataTexture.image.data as Float32Array;
    for (let i = 0; i < this.lightCount; i++) {
      const srcOffset = i * 4;
      const dstOffset = i * 4 * 4; // 4 texels per light, 4 components per texel
      
      // Texel 0: position
      lightData[dstOffset] = this.lightPositions[srcOffset];
      lightData[dstOffset + 1] = this.lightPositions[srcOffset + 1];
      lightData[dstOffset + 2] = this.lightPositions[srcOffset + 2];
      lightData[dstOffset + 3] = this.lightPositions[srcOffset + 3];
      
      // Texel 1: color + intensity
      lightData[dstOffset + 4] = this.lightColors[srcOffset];
      lightData[dstOffset + 5] = this.lightColors[srcOffset + 1];
      lightData[dstOffset + 6] = this.lightColors[srcOffset + 2];
      lightData[dstOffset + 7] = this.lightColors[srcOffset + 3];
      
      // Texel 2: params
      lightData[dstOffset + 8] = this.lightParams[srcOffset];
      lightData[dstOffset + 9] = this.lightParams[srcOffset + 1];
      lightData[dstOffset + 10] = this.lightParams[srcOffset + 2];
      lightData[dstOffset + 11] = this.lightParams[srcOffset + 3];
      
      // Texel 3: direction
      lightData[dstOffset + 12] = this.lightDirections[srcOffset];
      lightData[dstOffset + 13] = this.lightDirections[srcOffset + 1];
      lightData[dstOffset + 14] = this.lightDirections[srcOffset + 2];
      lightData[dstOffset + 15] = 0;
    }
    this.lightDataTexture.needsUpdate = true;
    
    // Build tile grid (CPU culling - simple approach)
    this.buildTileGrid(lights, camera);
  }
  
  /**
   * Simple CPU-based tile light culling
   * For a proper Forward+ implementation, this would be done in compute shaders
   */
  private buildTileGrid(lights: LightData[], camera: THREE.Camera): void {
    // Reset counts
    this.tileLightCounts.fill(0);
    this.tileLightIndices.fill(0);
    
    const viewMatrix = camera.matrixWorldInverse;
    const projMatrix = (camera as THREE.PerspectiveCamera).projectionMatrix;
    const viewProjMatrix = new THREE.Matrix4().multiplyMatrices(projMatrix, viewMatrix);
    
    // For each light, determine which tiles it affects
    for (let lightIdx = 0; lightIdx < this.lightCount; lightIdx++) {
      const light = lights[lightIdx];
      
      if (light.type === 'directional') {
        // Directional lights affect all tiles
        for (let tileIdx = 0; tileIdx < this.tilesX * this.tilesY; tileIdx++) {
          this.addLightToTile(tileIdx, lightIdx);
        }
        continue;
      }
      
      // Project light position to screen
      const pos4 = new THREE.Vector4(light.position.x, light.position.y, light.position.z, 1.0);
      pos4.applyMatrix4(viewProjMatrix);
      
      // Check if behind camera
      if (pos4.w <= 0) continue;
      
      pos4.divideScalar(pos4.w);
      
      // Convert to screen coordinates
      const screenX = (pos4.x * 0.5 + 0.5) * this.width;
      const screenY = (1.0 - (pos4.y * 0.5 + 0.5)) * this.height;
      
      // Approximate screen-space radius of light
      // This is a rough approximation
      const screenRadius = (light.range / pos4.w) * this.width * 0.5;
      
      // Find affected tiles
      const minTileX = Math.max(0, Math.floor((screenX - screenRadius) / this.config.tileSize));
      const maxTileX = Math.min(this.tilesX - 1, Math.floor((screenX + screenRadius) / this.config.tileSize));
      const minTileY = Math.max(0, Math.floor((screenY - screenRadius) / this.config.tileSize));
      const maxTileY = Math.min(this.tilesY - 1, Math.floor((screenY + screenRadius) / this.config.tileSize));
      
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        for (let tx = minTileX; tx <= maxTileX; tx++) {
          const tileIdx = ty * this.tilesX + tx;
          this.addLightToTile(tileIdx, lightIdx);
        }
      }
    }
    
    // Update tile data texture
    // Note: This is a simplified version - a real implementation would use a more efficient format
    this.tileDataTexture.needsUpdate = true;
  }
  
  private addLightToTile(tileIdx: number, lightIdx: number): void {
    const count = this.tileLightCounts[tileIdx];
    if (count >= this.config.maxLightsPerTile) return;
    
    const offset = tileIdx * this.config.maxLightsPerTile + count;
    this.tileLightIndices[offset] = lightIdx;
    this.tileLightCounts[tileIdx]++;
  }
  
  // Getters for shader uniforms
  getLightDataTexture(): THREE.DataTexture {
    return this.lightDataTexture;
  }
  
  getTileDataTexture(): THREE.DataTexture {
    return this.tileDataTexture;
  }
  
  getLightCount(): number {
    return this.lightCount;
  }
  
  getTileSize(): number {
    return this.config.tileSize;
  }
  
  getTileGridSize(): { x: number; y: number } {
    return { x: this.tilesX, y: this.tilesY };
  }
  
  // Get light arrays for simple uniform-based approach (for smaller light counts)
  getLightPositions(): Float32Array {
    return this.lightPositions.slice(0, this.lightCount * 4);
  }
  
  getLightColors(): Float32Array {
    return this.lightColors.slice(0, this.lightCount * 4);
  }
  
  getLightParams(): Float32Array {
    return this.lightParams.slice(0, this.lightCount * 4);
  }
  
  getLightDirections(): Float32Array {
    return this.lightDirections.slice(0, this.lightCount * 4);
  }
  
  dispose(): void {
    this.lightDataTexture.dispose();
    this.tileDataTexture.dispose();
  }
}

export default TileLightGrid;
