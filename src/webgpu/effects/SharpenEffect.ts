// Contrast-Adaptive Sharpening (CAS) Effect
// Based on AMD FidelityFX CAS algorithm
// Apply after TAA to recover detail lost during temporal blending

import * as THREE from 'three';

const SharpenVertexShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const SharpenFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;
uniform vec2 resolution;
uniform float sharpness; // 0.0 = off, 1.0 = max sharpening
uniform bool enabled;

varying vec2 vUv;

// CAS algorithm
vec3 cas(vec2 uv, vec2 texelSize) {
  // Sample 3x3 neighborhood
  vec3 a = texture2D(inputTexture, uv + vec2(-1.0, -1.0) * texelSize).rgb;
  vec3 b = texture2D(inputTexture, uv + vec2( 0.0, -1.0) * texelSize).rgb;
  vec3 c = texture2D(inputTexture, uv + vec2( 1.0, -1.0) * texelSize).rgb;
  vec3 d = texture2D(inputTexture, uv + vec2(-1.0,  0.0) * texelSize).rgb;
  vec3 e = texture2D(inputTexture, uv).rgb; // Center
  vec3 f = texture2D(inputTexture, uv + vec2( 1.0,  0.0) * texelSize).rgb;
  vec3 g = texture2D(inputTexture, uv + vec2(-1.0,  1.0) * texelSize).rgb;
  vec3 h = texture2D(inputTexture, uv + vec2( 0.0,  1.0) * texelSize).rgb;
  vec3 i = texture2D(inputTexture, uv + vec2( 1.0,  1.0) * texelSize).rgb;
  
  // Calculate min and max in cross pattern (+ shape)
  vec3 minRGB = min(min(min(b, d), min(f, h)), e);
  vec3 maxRGB = max(max(max(b, d), max(f, h)), e);
  
  // Calculate min and max in X pattern
  vec3 minRGB2 = min(min(min(a, c), min(g, i)), e);
  vec3 maxRGB2 = max(max(max(a, c), max(g, i)), e);
  
  // Combine both patterns
  minRGB = min(minRGB, minRGB2);
  maxRGB = max(maxRGB, maxRGB2);
  
  // Calculate amplification factor
  // Higher contrast = less sharpening needed (adaptive)
  vec3 rcpM = 1.0 / maxRGB;
  vec3 amp = clamp(min(minRGB, 2.0 - maxRGB) * rcpM, 0.0, 1.0);
  amp = sqrt(amp);
  
  // Calculate sharpening weight
  float peak = 8.0 - 3.0 * sharpness;
  vec3 weight = amp / peak;
  
  // Apply sharpening using weighted average
  vec3 wsum = weight * 4.0 + 1.0;
  vec3 result = (
    weight * (b + d + f + h) + e
  ) / wsum;
  
  return result;
}

// Simpler unsharp mask alternative
vec3 unsharpMask(vec2 uv, vec2 texelSize) {
  vec3 center = texture2D(inputTexture, uv).rgb;
  
  // 5-tap Gaussian blur
  vec3 blur = center * 0.25;
  blur += texture2D(inputTexture, uv + vec2(-1.0,  0.0) * texelSize).rgb * 0.1875;
  blur += texture2D(inputTexture, uv + vec2( 1.0,  0.0) * texelSize).rgb * 0.1875;
  blur += texture2D(inputTexture, uv + vec2( 0.0, -1.0) * texelSize).rgb * 0.1875;
  blur += texture2D(inputTexture, uv + vec2( 0.0,  1.0) * texelSize).rgb * 0.1875;
  
  // Sharpen = center + (center - blur) * amount
  vec3 sharpened = center + (center - blur) * sharpness * 2.0;
  
  return clamp(sharpened, 0.0, 1.0);
}

void main() {
  if (!enabled || sharpness <= 0.0) {
    gl_FragColor = texture2D(inputTexture, vUv);
    return;
  }
  
  vec2 texelSize = 1.0 / resolution;
  
  // Use CAS for quality sharpening
  vec3 sharpened = cas(vUv, texelSize);
  
  // Preserve luminance to avoid color shifts
  vec3 original = texture2D(inputTexture, vUv).rgb;
  float originalLuma = dot(original, vec3(0.299, 0.587, 0.114));
  float sharpenedLuma = dot(sharpened, vec3(0.299, 0.587, 0.114));
  
  // Prevent over-brightening dark areas
  float lumaRatio = originalLuma / max(sharpenedLuma, 0.0001);
  if (lumaRatio > 1.5) {
    sharpened = mix(sharpened, original, 0.5);
  }
  
  gl_FragColor = vec4(sharpened, 1.0);
}
`;

export interface SharpenEffectParams {
  enabled?: boolean;
  sharpness?: number;  // 0.0-1.0, typical value 0.3-0.5
}

/**
 * SharpenEffect - Contrast-Adaptive Sharpening
 * Use after TAA to recover detail and reduce softness
 */
export class SharpenEffect {
  private width: number;
  private height: number;
  
  private sharpenMaterial: THREE.ShaderMaterial;
  private outputTarget: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private enabled: boolean;
  private sharpness: number;
  
  constructor(width: number, height: number, params: SharpenEffectParams = {}) {
    this.width = width;
    this.height = height;
    this.enabled = params.enabled ?? true;
    this.sharpness = params.sharpness ?? 0.4;
    
    // Create output target
    this.outputTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    
    // Create sharpen material
    this.sharpenMaterial = new THREE.ShaderMaterial({
      vertexShader: SharpenVertexShader,
      fragmentShader: SharpenFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        sharpness: { value: this.sharpness },
        enabled: { value: this.enabled },
      },
    });
    
    // Setup fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.sharpenMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.outputTarget.setSize(width, height);
    this.sharpenMaterial.uniforms.resolution.value.set(width, height);
  }
  
  updateParams(params: SharpenEffectParams): void {
    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      this.sharpenMaterial.uniforms.enabled.value = params.enabled;
    }
    if (params.sharpness !== undefined) {
      this.sharpness = params.sharpness;
      this.sharpenMaterial.uniforms.sharpness.value = params.sharpness;
    }
  }
  
  /**
   * Render sharpening pass
   */
  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    target?: THREE.WebGLRenderTarget | null
  ): THREE.Texture {
    this.sharpenMaterial.uniforms.inputTexture.value = inputTexture;
    
    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(target ?? this.outputTarget);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(oldTarget);
    
    return target ? target.texture : this.outputTarget.texture;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  getTexture(): THREE.Texture {
    return this.outputTarget.texture;
  }
  
  dispose(): void {
    this.outputTarget.dispose();
    this.sharpenMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
