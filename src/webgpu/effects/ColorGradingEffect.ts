// Color Grading with LUT Support
// Professional color correction like UE4/UE5

import * as THREE from 'three';

const ColorGradingVertexShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const ColorGradingFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;
uniform sampler2D lutTexture;
uniform bool hasLUT;
uniform float lutIntensity;
uniform float lutSize;

// Color adjustment uniforms
uniform float contrast;
uniform float saturation;
uniform float brightness;
uniform vec3 shadows;
uniform vec3 midtones;
uniform vec3 highlights;
uniform float shadowsThreshold;
uniform float highlightsThreshold;

varying vec2 vUv;

// Apply 3D LUT (stored as 2D strip)
vec3 applyLUT(vec3 color, sampler2D lut, float size) {
  float sliceSize = 1.0 / size;
  float slicePixelSize = sliceSize / size;
  float sliceInnerSize = slicePixelSize * (size - 1.0);
  
  float zSlice0 = min(floor(color.b * (size - 1.0)), size - 2.0);
  float zSlice1 = zSlice0 + 1.0;
  
  float xOffset = slicePixelSize * 0.5 + color.r * sliceInnerSize;
  float s0 = xOffset + zSlice0 * sliceSize;
  float s1 = xOffset + zSlice1 * sliceSize;
  
  float yOffset = slicePixelSize * 0.5 + color.g * sliceInnerSize;
  
  vec3 slice0Color = texture2D(lut, vec2(s0, yOffset)).rgb;
  vec3 slice1Color = texture2D(lut, vec2(s1, yOffset)).rgb;
  
  float zOffset = mod(color.b * (size - 1.0), 1.0);
  return mix(slice0Color, slice1Color, zOffset);
}

// Lift-Gamma-Gain style color correction
vec3 colorCorrect(vec3 color, vec3 shadows, vec3 midtones, vec3 highlights) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  
  // Calculate weights for shadows, midtones, highlights
  float shadowWeight = 1.0 - smoothstep(0.0, shadowsThreshold, luminance);
  float highlightWeight = smoothstep(highlightsThreshold, 1.0, luminance);
  float midtoneWeight = 1.0 - shadowWeight - highlightWeight;
  
  // Apply color adjustments
  vec3 result = color;
  result += shadows * shadowWeight;
  result *= 1.0 + (midtones - 1.0) * midtoneWeight;
  result += highlights * highlightWeight;
  
  return result;
}

void main() {
  vec3 color = texture2D(inputTexture, vUv).rgb;
  
  // Apply brightness
  color *= brightness;
  
  // Apply contrast (pivot at middle grey)
  color = (color - 0.5) * contrast + 0.5;
  
  // Apply saturation
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, saturation);
  
  // Apply lift/gamma/gain style color correction
  color = colorCorrect(color, shadows, midtones, highlights);
  
  // Apply LUT if available
  if (hasLUT) {
    vec3 lutColor = applyLUT(clamp(color, 0.0, 1.0), lutTexture, lutSize);
    color = mix(color, lutColor, lutIntensity);
  }
  
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

export interface ColorGradingParams {
  enabled?: boolean;
  lutTexture?: THREE.Texture | null;
  lutIntensity?: number;     // 0.0-1.0
  lutSize?: number;          // LUT dimension (default: 32)
  contrast?: number;         // 0.5-1.5 (1.0 = neutral)
  saturation?: number;       // 0.0-2.0 (1.0 = neutral)
  brightness?: number;       // 0.5-1.5 (1.0 = neutral)
  shadows?: THREE.Color;     // Color tint for shadows
  midtones?: THREE.Color;    // Color tint for midtones
  highlights?: THREE.Color;  // Color tint for highlights
  shadowsThreshold?: number;
  highlightsThreshold?: number;
}

/**
 * ColorGradingEffect - Professional color correction
 * 
 * Supports:
 * - LUT-based color grading
 * - Contrast, saturation, brightness
 * - Lift/Gamma/Gain style color wheels
 */
export class ColorGradingEffect {
  private enabled: boolean;
  private width: number;
  private height: number;
  
  private colorGradingMaterial: THREE.ShaderMaterial;
  private outputTarget: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  constructor(width: number, height: number, params: ColorGradingParams = {}) {
    this.width = width;
    this.height = height;
    this.enabled = params.enabled ?? true;
    
    // Create material
    this.colorGradingMaterial = new THREE.ShaderMaterial({
      vertexShader: ColorGradingVertexShader,
      fragmentShader: ColorGradingFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        lutTexture: { value: params.lutTexture ?? null },
        hasLUT: { value: !!params.lutTexture },
        lutIntensity: { value: params.lutIntensity ?? 1.0 },
        lutSize: { value: params.lutSize ?? 32 },
        contrast: { value: params.contrast ?? 1.0 },
        saturation: { value: params.saturation ?? 1.0 },
        brightness: { value: params.brightness ?? 1.0 },
        shadows: { value: params.shadows ?? new THREE.Color(0, 0, 0) },
        midtones: { value: params.midtones ?? new THREE.Color(1, 1, 1) },
        highlights: { value: params.highlights ?? new THREE.Color(0, 0, 0) },
        shadowsThreshold: { value: params.shadowsThreshold ?? 0.3 },
        highlightsThreshold: { value: params.highlightsThreshold ?? 0.7 },
      },
    });
    
    // Create output target
    this.outputTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    
    // Setup rendering
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.colorGradingMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.outputTarget.setSize(width, height);
  }
  
  updateParams(params: ColorGradingParams): void {
    if (params.enabled !== undefined) this.enabled = params.enabled;
    
    const u = this.colorGradingMaterial.uniforms;
    
    if (params.lutTexture !== undefined) {
      u.lutTexture.value = params.lutTexture;
      u.hasLUT.value = !!params.lutTexture;
    }
    if (params.lutIntensity !== undefined) u.lutIntensity.value = params.lutIntensity;
    if (params.lutSize !== undefined) u.lutSize.value = params.lutSize;
    if (params.contrast !== undefined) u.contrast.value = params.contrast;
    if (params.saturation !== undefined) u.saturation.value = params.saturation;
    if (params.brightness !== undefined) u.brightness.value = params.brightness;
    if (params.shadows !== undefined) u.shadows.value = params.shadows;
    if (params.midtones !== undefined) u.midtones.value = params.midtones;
    if (params.highlights !== undefined) u.highlights.value = params.highlights;
    if (params.shadowsThreshold !== undefined) u.shadowsThreshold.value = params.shadowsThreshold;
    if (params.highlightsThreshold !== undefined) u.highlightsThreshold.value = params.highlightsThreshold;
  }
  
  /**
   * Load a LUT from an image URL
   * LUT should be a horizontal strip of slices
   */
  async loadLUT(url: string, size: number = 32): Promise<void> {
    const loader = new THREE.TextureLoader();
    const texture = await loader.loadAsync(url);
    
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    this.colorGradingMaterial.uniforms.lutTexture.value = texture;
    this.colorGradingMaterial.uniforms.hasLUT.value = true;
    this.colorGradingMaterial.uniforms.lutSize.value = size;
  }
  
  /**
   * Render color grading
   */
  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    target?: THREE.WebGLRenderTarget | null
  ): THREE.Texture {
    if (!this.enabled) {
      return inputTexture;
    }
    
    this.colorGradingMaterial.uniforms.inputTexture.value = inputTexture;
    
    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target ?? this.outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(oldTarget);
    
    return target ? target.texture : this.outputTarget.texture;
  }
  
  getTexture(): THREE.Texture {
    return this.outputTarget.texture;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  dispose(): void {
    this.outputTarget.dispose();
    this.colorGradingMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
