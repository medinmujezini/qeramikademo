import * as THREE from 'three';

/**
 * Fake Mobile Bloom Effect
 * 
 * A lightweight, single-pass bloom alternative designed for mobile performance.
 * Uses a simple threshold + box blur approach instead of multi-pass Gaussian blur.
 * Much faster than full bloom while still providing a pleasant glow effect.
 */

const FakeMobileBloomVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FakeMobileBloomFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D inputTexture;
  uniform vec2 resolution;
  uniform float intensity;
  uniform float threshold;
  
  varying vec2 vUv;
  
  void main() {
    vec2 texelSize = 1.0 / resolution;
    vec3 color = texture2D(inputTexture, vUv).rgb;
    
    // Extract bright pixels above threshold
    float brightness = max(max(color.r, color.g), color.b);
    vec3 bright = color * smoothstep(threshold, threshold + 0.5, brightness);
    
    // Simple 9-tap box blur at larger offset for bloom spread
    vec3 bloom = vec3(0.0);
    float blurSize = 4.0;
    
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      for (float y = -1.0; y <= 1.0; y += 1.0) {
        vec2 offset = vec2(x, y) * texelSize * blurSize;
        vec3 sample = texture2D(inputTexture, vUv + offset).rgb;
        float sampleBrightness = max(max(sample.r, sample.g), sample.b);
        bloom += sample * smoothstep(threshold, threshold + 0.5, sampleBrightness);
      }
    }
    bloom /= 9.0;
    
    // Add second layer with larger offset for wider glow
    vec3 bloom2 = vec3(0.0);
    float blurSize2 = 12.0;
    
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      for (float y = -1.0; y <= 1.0; y += 1.0) {
        vec2 offset = vec2(x, y) * texelSize * blurSize2;
        vec3 sample = texture2D(inputTexture, vUv + offset).rgb;
        float sampleBrightness = max(max(sample.r, sample.g), sample.b);
        bloom2 += sample * smoothstep(threshold, threshold + 0.5, sampleBrightness);
      }
    }
    bloom2 /= 9.0;
    
    // Combine blooms with falloff
    vec3 finalBloom = bloom * 0.6 + bloom2 * 0.4;
    
    // Add bloom to original color
    vec3 result = color + finalBloom * intensity;
    
    gl_FragColor = vec4(result, 1.0);
  }
`;

export interface FakeMobileBloomConfig {
  enabled: boolean;
  intensity: number;
  threshold: number;
}

export class FakeMobileBloomEffect {
  private material: THREE.ShaderMaterial;
  private renderTarget: THREE.WebGLRenderTarget;
  private fsQuad: THREE.Mesh;
  private fsScene: THREE.Scene;
  private fsCamera: THREE.OrthographicCamera;
  
  private config: FakeMobileBloomConfig;
  private width: number;
  private height: number;
  
  constructor(width: number, height: number, config?: Partial<FakeMobileBloomConfig>) {
    this.width = width;
    this.height = height;
    
    this.config = {
      enabled: config?.enabled ?? false,
      intensity: config?.intensity ?? 0.5,
      threshold: config?.threshold ?? 0.3,
    };
    
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: FakeMobileBloomVertexShader,
      fragmentShader: FakeMobileBloomFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        intensity: { value: this.config.intensity },
        threshold: { value: this.config.threshold },
      },
      depthTest: false,
      depthWrite: false,
    });
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.fsQuad = new THREE.Mesh(geometry, this.material);
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.fsQuad);
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  updateParams(params: Partial<FakeMobileBloomConfig>): void {
    if (params.enabled !== undefined) {
      this.config.enabled = params.enabled;
    }
    if (params.intensity !== undefined) {
      this.config.intensity = params.intensity;
      this.material.uniforms.intensity.value = params.intensity;
    }
    if (params.threshold !== undefined) {
      this.config.threshold = params.threshold;
      this.material.uniforms.threshold.value = params.threshold;
    }
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }
  
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  render(
    renderer: THREE.WebGLRenderer,
    inputTexture: THREE.Texture,
    outputTarget?: THREE.WebGLRenderTarget
  ): THREE.Texture {
    if (!this.config.enabled) {
      return inputTexture;
    }
    
    // Safety check - if no valid input, return it unchanged
    if (!inputTexture) {
      console.warn('[FakeMobileBloom] No input texture provided');
      return inputTexture;
    }
    
    this.material.uniforms.inputTexture.value = inputTexture;
    
    const target = outputTarget ?? this.renderTarget;
    renderer.setRenderTarget(target);
    renderer.render(this.fsScene, this.fsCamera);
    
    return target.texture;
  }
  
  getOutputTexture(): THREE.Texture {
    return this.renderTarget.texture;
  }
  
  dispose(): void {
    this.material.dispose();
    this.renderTarget.dispose();
    (this.fsQuad.geometry as THREE.PlaneGeometry).dispose();
  }
}

export default FakeMobileBloomEffect;
