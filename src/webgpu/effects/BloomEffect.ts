// Bloom Effect
// High-quality multi-scale bloom similar to UE4/UE5

import * as THREE from 'three';

const BloomVertexShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Threshold + downsample shader
const ThresholdFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;
uniform float threshold;
uniform float softThreshold;
uniform vec2 texelSize;

varying vec2 vUv;

vec3 sampleBox(vec2 uv, float delta) {
  vec3 result = texture2D(inputTexture, uv + vec2(-delta, -delta) * texelSize).rgb;
  result += texture2D(inputTexture, uv + vec2(delta, -delta) * texelSize).rgb;
  result += texture2D(inputTexture, uv + vec2(-delta, delta) * texelSize).rgb;
  result += texture2D(inputTexture, uv + vec2(delta, delta) * texelSize).rgb;
  return result * 0.25;
}

void main() {
  vec3 color = sampleBox(vUv, 0.5);
  
  // Soft thresholding
  float brightness = max(max(color.r, color.g), color.b);
  float soft = brightness - threshold + softThreshold;
  soft = clamp(soft, 0.0, 2.0 * softThreshold);
  soft = soft * soft / (4.0 * softThreshold + 0.00001);
  
  float contribution = max(soft, brightness - threshold);
  contribution /= max(brightness, 0.00001);
  
  gl_FragColor = vec4(color * contribution, 1.0);
}
`;

// Gaussian blur shader (separable)
const BlurFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D inputTexture;
uniform vec2 direction;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
  vec3 result = vec3(0.0);
  
  // 9-tap Gaussian blur
  result += texture2D(inputTexture, vUv - 4.0 * direction * texelSize).rgb * 0.0162162162;
  result += texture2D(inputTexture, vUv - 3.0 * direction * texelSize).rgb * 0.0540540541;
  result += texture2D(inputTexture, vUv - 2.0 * direction * texelSize).rgb * 0.1216216216;
  result += texture2D(inputTexture, vUv - 1.0 * direction * texelSize).rgb * 0.1945945946;
  result += texture2D(inputTexture, vUv).rgb * 0.2270270270;
  result += texture2D(inputTexture, vUv + 1.0 * direction * texelSize).rgb * 0.1945945946;
  result += texture2D(inputTexture, vUv + 2.0 * direction * texelSize).rgb * 0.1216216216;
  result += texture2D(inputTexture, vUv + 3.0 * direction * texelSize).rgb * 0.0540540541;
  result += texture2D(inputTexture, vUv + 4.0 * direction * texelSize).rgb * 0.0162162162;
  
  gl_FragColor = vec4(result, 1.0);
}
`;

// Upsample and combine shader
const UpsampleFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D currentLevel;
uniform sampler2D previousLevel;
uniform float bloomIntensity;
uniform vec2 texelSize;

varying vec2 vUv;

vec3 sampleTent(sampler2D tex, vec2 uv) {
  vec3 result = texture2D(tex, uv).rgb * 4.0;
  result += texture2D(tex, uv + vec2(1.0, 0.0) * texelSize).rgb * 2.0;
  result += texture2D(tex, uv + vec2(-1.0, 0.0) * texelSize).rgb * 2.0;
  result += texture2D(tex, uv + vec2(0.0, 1.0) * texelSize).rgb * 2.0;
  result += texture2D(tex, uv + vec2(0.0, -1.0) * texelSize).rgb * 2.0;
  result += texture2D(tex, uv + vec2(1.0, 1.0) * texelSize).rgb;
  result += texture2D(tex, uv + vec2(-1.0, 1.0) * texelSize).rgb;
  result += texture2D(tex, uv + vec2(1.0, -1.0) * texelSize).rgb;
  result += texture2D(tex, uv + vec2(-1.0, -1.0) * texelSize).rgb;
  return result / 16.0;
}

void main() {
  vec3 current = texture2D(currentLevel, vUv).rgb;
  vec3 upsampled = sampleTent(previousLevel, vUv);
  
  gl_FragColor = vec4(current + upsampled * bloomIntensity, 1.0);
}
`;

// Final combine shader
const CombineFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D bloomTexture;
uniform float intensity;

varying vec2 vUv;

void main() {
  gl_FragColor = vec4(texture2D(bloomTexture, vUv).rgb * intensity, 1.0);
}
`;

export interface BloomEffectParams {
  enabled?: boolean;
  threshold?: number;      // Brightness threshold (default: 1.0)
  softThreshold?: number;  // Soft knee (default: 0.5)
  intensity?: number;      // Overall bloom intensity (default: 0.5)
  radius?: number;         // Bloom radius (affects number of passes)
  levels?: number;         // Number of blur levels (3-8)
}

/**
 * BloomEffect - Multi-scale blur bloom
 * 
 * Creates the "glow" effect on bright areas of the image.
 * Uses progressive downsampling and upsampling for efficiency.
 */
export class BloomEffect {
  private enabled: boolean;
  private threshold: number;
  private softThreshold: number;
  private intensity: number;
  private levels: number;
  
  private width: number;
  private height: number;
  
  private mipTargets: THREE.WebGLRenderTarget[][] = []; // [level][0=horizontal, 1=vertical]
  private outputTarget: THREE.WebGLRenderTarget;
  
  private thresholdMaterial: THREE.ShaderMaterial;
  private blurMaterial: THREE.ShaderMaterial;
  private upsampleMaterial: THREE.ShaderMaterial;
  private combineMaterial: THREE.ShaderMaterial;
  
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  constructor(width: number, height: number, params: BloomEffectParams = {}) {
    this.width = width;
    this.height = height;
    this.enabled = params.enabled ?? true;
    this.threshold = params.threshold ?? 1.0;
    this.softThreshold = params.softThreshold ?? 0.5;
    this.intensity = params.intensity ?? 0.5;
    this.levels = params.levels ?? 5;
    
    // Create materials
    this.thresholdMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomVertexShader,
      fragmentShader: ThresholdFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        threshold: { value: this.threshold },
        softThreshold: { value: this.softThreshold },
        texelSize: { value: new THREE.Vector2() },
      },
    });
    
    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomVertexShader,
      fragmentShader: BlurFragmentShader,
      uniforms: {
        inputTexture: { value: null },
        direction: { value: new THREE.Vector2(1, 0) },
        texelSize: { value: new THREE.Vector2() },
      },
    });
    
    this.upsampleMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomVertexShader,
      fragmentShader: UpsampleFragmentShader,
      uniforms: {
        currentLevel: { value: null },
        previousLevel: { value: null },
        bloomIntensity: { value: 1.0 },
        texelSize: { value: new THREE.Vector2() },
      },
    });
    
    this.combineMaterial = new THREE.ShaderMaterial({
      vertexShader: BloomVertexShader,
      fragmentShader: CombineFragmentShader,
      uniforms: {
        bloomTexture: { value: null },
        intensity: { value: this.intensity },
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
    this.quad = new THREE.Mesh(geometry, this.thresholdMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create mip chain
    this.createMipChain();
  }
  
  private createMipChain(): void {
    // Dispose existing
    this.mipTargets.forEach(level => level.forEach(t => t.dispose()));
    this.mipTargets = [];
    
    let w = Math.floor(this.width / 2);
    let h = Math.floor(this.height / 2);
    
    for (let i = 0; i < this.levels && w >= 1 && h >= 1; i++) {
      const targetOptions: THREE.RenderTargetOptions = {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        depthBuffer: false,
      };
      
      // Two targets per level (horizontal and vertical blur passes)
      this.mipTargets.push([
        new THREE.WebGLRenderTarget(w, h, targetOptions),
        new THREE.WebGLRenderTarget(w, h, targetOptions),
      ]);
      
      w = Math.floor(w / 2);
      h = Math.floor(h / 2);
    }
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.outputTarget.setSize(width, height);
    this.createMipChain();
  }
  
  updateParams(params: BloomEffectParams): void {
    if (params.enabled !== undefined) this.enabled = params.enabled;
    if (params.threshold !== undefined) {
      this.threshold = params.threshold;
      this.thresholdMaterial.uniforms.threshold.value = params.threshold;
    }
    if (params.softThreshold !== undefined) {
      this.softThreshold = params.softThreshold;
      this.thresholdMaterial.uniforms.softThreshold.value = params.softThreshold;
    }
    if (params.intensity !== undefined) {
      this.intensity = params.intensity;
      this.combineMaterial.uniforms.intensity.value = params.intensity;
    }
    if (params.levels !== undefined && params.levels !== this.levels) {
      this.levels = params.levels;
      this.createMipChain();
    }
  }
  
  /**
   * Render bloom effect
   * Returns the bloom texture (to be added to the scene)
   */
  render(renderer: THREE.WebGLRenderer, inputTexture: THREE.Texture): THREE.Texture {
    if (!this.enabled || this.mipTargets.length === 0) {
      return inputTexture;
    }
    
    const oldTarget = renderer.getRenderTarget();
    
    // Step 1: Threshold and first downsample
    this.quad.material = this.thresholdMaterial;
    this.thresholdMaterial.uniforms.inputTexture.value = inputTexture;
    this.thresholdMaterial.uniforms.texelSize.value.set(1 / this.width, 1 / this.height);
    
    renderer.setRenderTarget(this.mipTargets[0][0]);
    renderer.render(this.scene, this.camera);
    
    // Step 2: Progressive downsample with blur
    for (let i = 0; i < this.mipTargets.length; i++) {
      const [targetH, targetV] = this.mipTargets[i];
      const w = targetH.width;
      const h = targetH.height;
      
      // Source is either previous level or threshold output
      const source = i === 0 ? this.mipTargets[0][0] : this.mipTargets[i - 1][1];
      
      // Horizontal blur
      this.quad.material = this.blurMaterial;
      this.blurMaterial.uniforms.inputTexture.value = source.texture;
      this.blurMaterial.uniforms.direction.value.set(1, 0);
      this.blurMaterial.uniforms.texelSize.value.set(1 / w, 1 / h);
      
      renderer.setRenderTarget(targetH);
      renderer.render(this.scene, this.camera);
      
      // Vertical blur
      this.blurMaterial.uniforms.inputTexture.value = targetH.texture;
      this.blurMaterial.uniforms.direction.value.set(0, 1);
      
      renderer.setRenderTarget(targetV);
      renderer.render(this.scene, this.camera);
    }
    
    // Step 3: Progressive upsample and combine
    for (let i = this.mipTargets.length - 2; i >= 0; i--) {
      const [targetH, targetV] = this.mipTargets[i];
      const previousLevel = this.mipTargets[i + 1][1];
      
      this.quad.material = this.upsampleMaterial;
      this.upsampleMaterial.uniforms.currentLevel.value = targetV.texture;
      this.upsampleMaterial.uniforms.previousLevel.value = previousLevel.texture;
      this.upsampleMaterial.uniforms.bloomIntensity.value = 1.0;
      this.upsampleMaterial.uniforms.texelSize.value.set(1 / targetV.width, 1 / targetV.height);
      
      renderer.setRenderTarget(targetH);
      renderer.render(this.scene, this.camera);
      
      // Copy back to vertical for next iteration
      this.blurMaterial.uniforms.inputTexture.value = targetH.texture;
      this.blurMaterial.uniforms.direction.value.set(0, 0); // No blur, just copy
      renderer.setRenderTarget(targetV);
      renderer.render(this.scene, this.camera);
    }
    
    // Step 4: Final output
    this.quad.material = this.combineMaterial;
    this.combineMaterial.uniforms.bloomTexture.value = this.mipTargets[0][1].texture;
    
    renderer.setRenderTarget(this.outputTarget);
    renderer.render(this.scene, this.camera);
    
    renderer.setRenderTarget(oldTarget);
    
    return this.outputTarget.texture;
  }
  
  getTexture(): THREE.Texture {
    return this.outputTarget.texture;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  dispose(): void {
    this.mipTargets.forEach(level => level.forEach(t => t.dispose()));
    this.outputTarget.dispose();
    this.thresholdMaterial.dispose();
    this.blurMaterial.dispose();
    this.upsampleMaterial.dispose();
    this.combineMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
