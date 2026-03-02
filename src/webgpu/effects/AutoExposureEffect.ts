// Auto Exposure (Eye Adaptation) Effect
// Histogram-based exposure calculation similar to UE4/UE5

import * as THREE from 'three';

const LuminanceVertexShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Calculate average luminance from input image
const LuminanceFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;
uniform vec2 resolution;

varying vec2 vUv;

float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  // Sample multiple points and average
  float totalLuminance = 0.0;
  float sampleCount = 0.0;
  
  // 4x4 grid sampling
  for (float x = 0.0; x < 4.0; x++) {
    for (float y = 0.0; y < 4.0; y++) {
      vec2 offset = (vec2(x, y) + 0.5) / 4.0;
      vec2 sampleUV = mix(vec2(0.0), vec2(1.0), offset);
      vec3 color = texture2D(inputTexture, sampleUV).rgb;
      
      float luminance = getLuminance(color);
      // Use log luminance for better averaging (prevents bright spots from dominating)
      totalLuminance += log(max(luminance, 0.001));
      sampleCount += 1.0;
    }
  }
  
  float avgLogLuminance = totalLuminance / sampleCount;
  float avgLuminance = exp(avgLogLuminance);
  
  gl_FragColor = vec4(avgLuminance, avgLuminance, avgLuminance, 1.0);
}
`;

// Temporal smoothing of exposure
const AdaptationFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D currentLuminance;
uniform sampler2D previousExposure;
uniform float adaptationSpeed;
uniform float deltaTime;
uniform float minExposure;
uniform float maxExposure;
uniform float exposureCompensation;
uniform float targetMiddleGrey;

varying vec2 vUv;

void main() {
  float currentLum = texture2D(currentLuminance, vec2(0.5)).r;
  float previousExp = texture2D(previousExposure, vec2(0.5)).r;
  
  // Calculate target exposure
  // exposure = middleGrey / luminance
  float targetExposure = targetMiddleGrey / max(currentLum, 0.001);
  targetExposure *= exposureCompensation;
  targetExposure = clamp(targetExposure, minExposure, maxExposure);
  
  // Smooth adaptation
  float adaptedExposure = previousExp + (targetExposure - previousExp) * (1.0 - exp(-deltaTime * adaptationSpeed));
  
  // Clamp final exposure
  adaptedExposure = clamp(adaptedExposure, minExposure, maxExposure);
  
  gl_FragColor = vec4(adaptedExposure, adaptedExposure, adaptedExposure, 1.0);
}
`;

export interface AutoExposureParams {
  enabled?: boolean;
  minExposure?: number;          // Minimum exposure multiplier
  maxExposure?: number;          // Maximum exposure multiplier
  adaptationSpeed?: number;      // How fast exposure adapts (higher = faster)
  exposureCompensation?: number; // Manual exposure adjustment
  targetMiddleGrey?: number;     // Target middle grey value (0.18 standard)
}

/**
 * AutoExposureEffect - Automatic eye adaptation
 * 
 * Simulates how human eyes adapt to different light levels.
 * Essential for HDR scenes with high dynamic range.
 */
export class AutoExposureEffect {
  private enabled: boolean;
  private minExposure: number;
  private maxExposure: number;
  private adaptationSpeed: number;
  private exposureCompensation: number;
  private targetMiddleGrey: number;
  
  private luminanceTarget: THREE.WebGLRenderTarget;
  private exposureTargets: THREE.WebGLRenderTarget[] = [];
  private currentExposureIndex: number = 0;
  
  private luminanceMaterial: THREE.ShaderMaterial;
  private adaptationMaterial: THREE.ShaderMaterial;
  
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private lastTime: number = 0;
  private currentExposure: number = 1.0;
  
  constructor(params: AutoExposureParams = {}) {
    this.enabled = params.enabled ?? true;
    this.minExposure = params.minExposure ?? 0.1;
    this.maxExposure = params.maxExposure ?? 10.0;
    this.adaptationSpeed = params.adaptationSpeed ?? 2.0;
    this.exposureCompensation = params.exposureCompensation ?? 1.0;
    this.targetMiddleGrey = params.targetMiddleGrey ?? 0.18;
    
    // Small render targets for luminance (we just need average)
    this.luminanceTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
    });
    
    // Double-buffered exposure targets for temporal smoothing
    for (let i = 0; i < 2; i++) {
      this.exposureTargets.push(new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        depthBuffer: false,
      }));
    }
    
    // Materials
    this.luminanceMaterial = new THREE.ShaderMaterial({
      vertexShader: LuminanceVertexShader,
      fragmentShader: LuminanceFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
    });
    
    this.adaptationMaterial = new THREE.ShaderMaterial({
      vertexShader: LuminanceVertexShader,
      fragmentShader: AdaptationFragmentShader,
      uniforms: {
        currentLuminance: { value: this.luminanceTarget.texture },
        previousExposure: { value: this.exposureTargets[0].texture },
        adaptationSpeed: { value: this.adaptationSpeed },
        deltaTime: { value: 0.016 },
        minExposure: { value: this.minExposure },
        maxExposure: { value: this.maxExposure },
        exposureCompensation: { value: this.exposureCompensation },
        targetMiddleGrey: { value: this.targetMiddleGrey },
      },
    });
    
    // Setup rendering
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.luminanceMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.lastTime = performance.now();
  }
  
  updateParams(params: AutoExposureParams): void {
    if (params.enabled !== undefined) this.enabled = params.enabled;
    if (params.minExposure !== undefined) {
      this.minExposure = params.minExposure;
      this.adaptationMaterial.uniforms.minExposure.value = params.minExposure;
    }
    if (params.maxExposure !== undefined) {
      this.maxExposure = params.maxExposure;
      this.adaptationMaterial.uniforms.maxExposure.value = params.maxExposure;
    }
    if (params.adaptationSpeed !== undefined) {
      this.adaptationSpeed = params.adaptationSpeed;
      this.adaptationMaterial.uniforms.adaptationSpeed.value = params.adaptationSpeed;
    }
    if (params.exposureCompensation !== undefined) {
      this.exposureCompensation = params.exposureCompensation;
      this.adaptationMaterial.uniforms.exposureCompensation.value = params.exposureCompensation;
    }
    if (params.targetMiddleGrey !== undefined) {
      this.targetMiddleGrey = params.targetMiddleGrey;
      this.adaptationMaterial.uniforms.targetMiddleGrey.value = params.targetMiddleGrey;
    }
  }
  
  /**
   * Calculate exposure from input texture
   * Returns the current exposure value
   */
  calculate(renderer: THREE.WebGLRenderer, inputTexture: THREE.Texture): number {
    if (!this.enabled) {
      return this.exposureCompensation;
    }
    
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;
    
    const oldTarget = renderer.getRenderTarget();
    
    // Step 1: Calculate luminance
    this.quad.material = this.luminanceMaterial;
    this.luminanceMaterial.uniforms.inputTexture.value = inputTexture;
    
    renderer.setRenderTarget(this.luminanceTarget);
    renderer.render(this.scene, this.camera);
    
    // Step 2: Adapt exposure over time
    const prevIndex = this.currentExposureIndex;
    const nextIndex = 1 - this.currentExposureIndex;
    
    this.quad.material = this.adaptationMaterial;
    this.adaptationMaterial.uniforms.currentLuminance.value = this.luminanceTarget.texture;
    this.adaptationMaterial.uniforms.previousExposure.value = this.exposureTargets[prevIndex].texture;
    this.adaptationMaterial.uniforms.deltaTime.value = deltaTime;
    
    renderer.setRenderTarget(this.exposureTargets[nextIndex]);
    renderer.render(this.scene, this.camera);
    
    this.currentExposureIndex = nextIndex;
    
    renderer.setRenderTarget(oldTarget);
    
    // Read back exposure (for use in composition shader)
    // In production, you'd use a compute shader or pass the texture directly
    this.currentExposure = this.readExposure(renderer);
    
    return this.currentExposure;
  }
  
  private readExposure(renderer: THREE.WebGLRenderer): number {
    // For WebGL, we need to read pixels - this is slow but works
    // In WebGPU, we could use storage textures
    const pixels = new Float32Array(4);
    renderer.readRenderTargetPixels(
      this.exposureTargets[this.currentExposureIndex],
      0, 0, 1, 1,
      pixels
    );
    return pixels[0] || 1.0;
  }
  
  /**
   * Get current exposure texture (for use in shaders)
   */
  getExposureTexture(): THREE.Texture {
    return this.exposureTargets[this.currentExposureIndex].texture;
  }
  
  /**
   * Get current exposure value
   */
  getExposure(): number {
    return this.currentExposure;
  }
  
  /**
   * Reset exposure to default
   */
  reset(): void {
    this.currentExposure = 1.0;
    this.lastTime = performance.now();
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  dispose(): void {
    this.luminanceTarget.dispose();
    this.exposureTargets.forEach(t => t.dispose());
    this.luminanceMaterial.dispose();
    this.adaptationMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
