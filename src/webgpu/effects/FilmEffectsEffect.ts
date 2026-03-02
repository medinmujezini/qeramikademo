// Film Grain + Vignette Effect
// Final polish effects for cinematic look

import * as THREE from 'three';

const FilmEffectsVertexShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FilmEffectsFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;
uniform vec2 resolution;
uniform float time;

// Film grain
uniform bool grainEnabled;
uniform float grainIntensity;
uniform float grainSize;

// Vignette
uniform bool vignetteEnabled;
uniform float vignetteIntensity;
uniform float vignetteSmoothness;
uniform float vignetteRoundness;

// Chromatic aberration
uniform bool chromaticEnabled;
uniform float chromaticIntensity;

varying vec2 vUv;

// Noise functions
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Film grain
float filmGrain(vec2 uv, float t) {
  vec2 grainUV = uv * resolution / grainSize;
  float n = noise(grainUV + t * 100.0);
  n = (n - 0.5) * 2.0;
  return n * grainIntensity;
}

// Vignette
float vignette(vec2 uv) {
  vec2 center = uv - 0.5;
  center.x *= resolution.x / resolution.y * vignetteRoundness;
  float dist = length(center);
  return 1.0 - smoothstep(0.5 - vignetteSmoothness, 0.5, dist * vignetteIntensity);
}

void main() {
  vec2 uv = vUv;
  vec3 color;
  
  // Chromatic aberration
  if (chromaticEnabled && chromaticIntensity > 0.0) {
    vec2 direction = (uv - 0.5) * chromaticIntensity;
    color.r = texture2D(inputTexture, uv + direction).r;
    color.g = texture2D(inputTexture, uv).g;
    color.b = texture2D(inputTexture, uv - direction).b;
  } else {
    color = texture2D(inputTexture, uv).rgb;
  }
  
  // Apply vignette
  if (vignetteEnabled) {
    float v = vignette(uv);
    color *= v;
  }
  
  // Apply film grain
  if (grainEnabled) {
    float grain = filmGrain(uv, time);
    // Apply grain more to midtones
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float grainStrength = 1.0 - abs(luminance - 0.5) * 2.0;
    color += grain * grainStrength;
  }
  
  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

export interface FilmEffectsParams {
  enabled?: boolean;
  
  // Film grain
  grainEnabled?: boolean;
  grainIntensity?: number;  // 0.0-0.2 typical
  grainSize?: number;       // Grain texel size
  
  // Vignette
  vignetteEnabled?: boolean;
  vignetteIntensity?: number;   // 0.5-2.0
  vignetteSmoothness?: number;  // 0.0-1.0
  vignetteRoundness?: number;   // Aspect ratio compensation
  
  // Chromatic aberration
  chromaticEnabled?: boolean;
  chromaticIntensity?: number;  // 0.0-0.01 (subtle)
}

/**
 * FilmEffectsEffect - Film grain, vignette, and chromatic aberration
 * 
 * Apply as the final post-processing step for cinematic polish.
 */
export class FilmEffectsEffect {
  private enabled: boolean;
  private width: number;
  private height: number;
  
  private filmEffectsMaterial: THREE.ShaderMaterial;
  private outputTarget: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  constructor(width: number, height: number, params: FilmEffectsParams = {}) {
    this.width = width;
    this.height = height;
    this.enabled = params.enabled ?? true;
    
    // Create material
    this.filmEffectsMaterial = new THREE.ShaderMaterial({
      vertexShader: FilmEffectsVertexShader,
      fragmentShader: FilmEffectsFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        time: { value: 0 },
        
        grainEnabled: { value: params.grainEnabled ?? true },
        grainIntensity: { value: params.grainIntensity ?? 0.05 },
        grainSize: { value: params.grainSize ?? 2.0 },
        
        vignetteEnabled: { value: params.vignetteEnabled ?? true },
        vignetteIntensity: { value: params.vignetteIntensity ?? 1.2 },
        vignetteSmoothness: { value: params.vignetteSmoothness ?? 0.4 },
        vignetteRoundness: { value: params.vignetteRoundness ?? 1.0 },
        
        chromaticEnabled: { value: params.chromaticEnabled ?? false },
        chromaticIntensity: { value: params.chromaticIntensity ?? 0.002 },
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
    this.quad = new THREE.Mesh(geometry, this.filmEffectsMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.outputTarget.setSize(width, height);
    this.filmEffectsMaterial.uniforms.resolution.value.set(width, height);
  }
  
  updateParams(params: FilmEffectsParams): void {
    if (params.enabled !== undefined) this.enabled = params.enabled;
    
    const u = this.filmEffectsMaterial.uniforms;
    
    if (params.grainEnabled !== undefined) u.grainEnabled.value = params.grainEnabled;
    if (params.grainIntensity !== undefined) u.grainIntensity.value = params.grainIntensity;
    if (params.grainSize !== undefined) u.grainSize.value = params.grainSize;
    
    if (params.vignetteEnabled !== undefined) u.vignetteEnabled.value = params.vignetteEnabled;
    if (params.vignetteIntensity !== undefined) u.vignetteIntensity.value = params.vignetteIntensity;
    if (params.vignetteSmoothness !== undefined) u.vignetteSmoothness.value = params.vignetteSmoothness;
    if (params.vignetteRoundness !== undefined) u.vignetteRoundness.value = params.vignetteRoundness;
    
    if (params.chromaticEnabled !== undefined) u.chromaticEnabled.value = params.chromaticEnabled;
    if (params.chromaticIntensity !== undefined) u.chromaticIntensity.value = params.chromaticIntensity;
  }
  
  /**
   * Render film effects
   */
  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    target?: THREE.WebGLRenderTarget | null
  ): THREE.Texture {
    if (!this.enabled) {
      return inputTexture;
    }
    
    // Update time for animated grain
    this.filmEffectsMaterial.uniforms.time.value = performance.now() / 1000;
    this.filmEffectsMaterial.uniforms.inputTexture.value = inputTexture;
    
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
    this.filmEffectsMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
