// Temporal Anti-Aliasing with TSR-style Upscaling
// Implements high-quality temporal supersampling similar to Unreal Engine's TSR

import * as THREE from 'three';

const TAAVertexShader = /* glsl */ `
precision highp float;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const TAAFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D currentFrame;
uniform sampler2D historyFrame;
uniform sampler2D velocityTexture;
uniform sampler2D depthTexture;

uniform vec2 resolution;
uniform vec2 jitter;
uniform float historyWeight;
uniform float varianceClipGamma;
uniform bool enabled;

varying vec2 vUv;

// Helper to convert velocity from encoded format
vec2 decodeVelocity(vec2 encoded) {
  return encoded / 10.0; // Reverse the *10 encoding
}

// Catmull-Rom bicubic sampling for sharper history
vec4 sampleCatmullRom(sampler2D tex, vec2 uv, vec2 texSize) {
  vec2 position = uv * texSize;
  vec2 centerPosition = floor(position - 0.5) + 0.5;
  vec2 f = position - centerPosition;
  vec2 f2 = f * f;
  vec2 f3 = f * f2;
  
  vec2 w0 = f2 - 0.5 * (f3 + f);
  vec2 w1 = 1.5 * f3 - 2.5 * f2 + 1.0;
  vec2 w2 = -1.5 * f3 + 2.0 * f2 + 0.5 * f;
  vec2 w3 = 0.5 * (f3 - f2);
  
  vec2 w12 = w1 + w2;
  vec2 tc12 = (centerPosition + w2 / w12) / texSize;
  vec2 tc0 = (centerPosition - 1.0) / texSize;
  vec2 tc3 = (centerPosition + 2.0) / texSize;
  
  vec4 result = vec4(0.0);
  result += texture2D(tex, vec2(tc12.x, tc0.y)) * (w12.x * w0.y);
  result += texture2D(tex, vec2(tc0.x, tc12.y)) * (w0.x * w12.y);
  result += texture2D(tex, vec2(tc12.x, tc12.y)) * (w12.x * w12.y);
  result += texture2D(tex, vec2(tc3.x, tc12.y)) * (w3.x * w12.y);
  result += texture2D(tex, vec2(tc12.x, tc3.y)) * (w12.x * w3.y);
  
  return result;
}

// RGB to YCoCg color space (better for variance clipping)
vec3 RGBToYCoCg(vec3 rgb) {
  float Y = dot(rgb, vec3(0.25, 0.5, 0.25));
  float Co = dot(rgb, vec3(0.5, 0.0, -0.5));
  float Cg = dot(rgb, vec3(-0.25, 0.5, -0.25));
  return vec3(Y, Co, Cg);
}

vec3 YCoCgToRGB(vec3 ycocg) {
  float Y = ycocg.x;
  float Co = ycocg.y;
  float Cg = ycocg.z;
  return vec3(Y + Co - Cg, Y + Cg, Y - Co - Cg);
}

// Neighborhood clamping with variance
vec3 clipToAABB(vec3 color, vec3 minimum, vec3 maximum) {
  vec3 center = 0.5 * (maximum + minimum);
  vec3 extents = 0.5 * (maximum - minimum);
  
  vec3 offset = color - center;
  vec3 ts = abs(extents / (offset + 0.0001));
  float t = clamp(min(min(ts.x, ts.y), ts.z), 0.0, 1.0);
  
  return center + offset * t;
}

void main() {
  if (!enabled) {
    gl_FragColor = texture2D(currentFrame, vUv);
    return;
  }
  
  vec2 texelSize = 1.0 / resolution;
  
  // Sample velocity and reproject
  vec2 velocity = decodeVelocity(texture2D(velocityTexture, vUv).rg);
  vec2 reprojectedUV = vUv - velocity;
  
  // Unjitter current frame sample
  vec2 unjitteredUV = vUv - jitter / resolution;
  vec4 currentColor = texture2D(currentFrame, unjitteredUV);
  
  // Check if reprojected UV is valid
  bool validHistory = reprojectedUV.x >= 0.0 && reprojectedUV.x <= 1.0 &&
                      reprojectedUV.y >= 0.0 && reprojectedUV.y <= 1.0;
  
  if (!validHistory) {
    gl_FragColor = currentColor;
    return;
  }
  
  // Sample history with bicubic filtering
  vec4 historyColor = sampleCatmullRom(historyFrame, reprojectedUV, resolution);
  
  // Gather neighborhood for variance clipping
  vec3 m1 = vec3(0.0);
  vec3 m2 = vec3(0.0);
  
  // 3x3 neighborhood
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 sampleUV = unjitteredUV + vec2(float(x), float(y)) * texelSize;
      vec3 sampleColor = texture2D(currentFrame, sampleUV).rgb;
      vec3 sampleYCoCg = RGBToYCoCg(sampleColor);
      m1 += sampleYCoCg;
      m2 += sampleYCoCg * sampleYCoCg;
    }
  }
  
  m1 /= 9.0;
  m2 /= 9.0;
  
  vec3 variance = sqrt(max(m2 - m1 * m1, vec3(0.0)));
  vec3 minimum = m1 - varianceClipGamma * variance;
  vec3 maximum = m1 + varianceClipGamma * variance;
  
  // Clip history to neighborhood bounds (in YCoCg space)
  vec3 historyYCoCg = RGBToYCoCg(historyColor.rgb);
  vec3 clippedHistory = clipToAABB(historyYCoCg, minimum, maximum);
  vec3 clippedHistoryRGB = YCoCgToRGB(clippedHistory);
  
  // Calculate blend weight
  // Reduce weight when history was clipped significantly
  float clipAmount = length(historyYCoCg - clippedHistory);
  float adaptiveWeight = mix(historyWeight, 0.5, clamp(clipAmount * 2.0, 0.0, 1.0));
  
  // Velocity-based weight reduction (fast motion = less history)
  float velocityMagnitude = length(velocity * resolution);
  adaptiveWeight = mix(adaptiveWeight, 0.2, clamp(velocityMagnitude / 50.0, 0.0, 1.0));
  
  // Blend current and history
  vec3 result = mix(currentColor.rgb, clippedHistoryRGB, adaptiveWeight);
  
  // Preserve alpha from current frame
  gl_FragColor = vec4(result, currentColor.a);
}
`;

// Additional reactive mask shader for handling emissives/transparents
const ReactiveResolveShader = /* glsl */ `
precision highp float;

uniform sampler2D taaResult;
uniform sampler2D currentFrame;
uniform sampler2D reactiveMask;
uniform vec2 resolution;

varying vec2 vUv;

void main() {
  vec4 taa = texture2D(taaResult, vUv);
  vec4 current = texture2D(currentFrame, vUv);
  float reactive = texture2D(reactiveMask, vUv).r;
  
  // Reactive pixels use more current frame (less ghosting on emissives)
  gl_FragColor = mix(taa, current, reactive);
}
`;

export interface TAAEffectParams {
  enabled?: boolean;
  historyWeight?: number;      // 0.9-0.95 typical
  varianceClipGamma?: number;  // 1.0-1.5 (higher = more ghosting, less flicker)
  renderScale?: number;        // 0.7-1.0 for TSR-style upscaling
}

/**
 * TAAEffect - Temporal Anti-Aliasing with TSR-style Upscaling
 * Provides smooth, stable image quality with optional upscaling
 */
export class TAAEffect {
  private width: number;
  private height: number;
  private renderWidth: number;
  private renderHeight: number;
  
  private taaMaterial: THREE.ShaderMaterial;
  private historyTarget: THREE.WebGLRenderTarget;
  private outputTarget: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  
  private enabled: boolean;
  private historyWeight: number;
  private varianceClipGamma: number;
  private renderScale: number;
  
  private frameIndex: number = 0;
  
  constructor(width: number, height: number, params: TAAEffectParams = {}) {
    this.enabled = params.enabled ?? true;
    this.historyWeight = params.historyWeight ?? 0.9;
    this.varianceClipGamma = params.varianceClipGamma ?? 1.25;
    this.renderScale = params.renderScale ?? 1.0;
    
    this.width = width;
    this.height = height;
    this.renderWidth = Math.floor(width * this.renderScale);
    this.renderHeight = Math.floor(height * this.renderScale);
    
    // Create render targets
    const targetOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    };
    
    this.historyTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);
    this.outputTarget = new THREE.WebGLRenderTarget(width, height, targetOptions);
    
    // Create TAA material
    this.taaMaterial = new THREE.ShaderMaterial({
      vertexShader: TAAVertexShader,
      fragmentShader: TAAFragmentShader,
      uniforms: {
        currentFrame: { value: null },
        historyFrame: { value: this.historyTarget.texture },
        velocityTexture: { value: null },
        depthTexture: { value: null },
        resolution: { value: new THREE.Vector2(width, height) },
        jitter: { value: new THREE.Vector2(0, 0) },
        historyWeight: { value: this.historyWeight },
        varianceClipGamma: { value: this.varianceClipGamma },
        enabled: { value: this.enabled },
      },
    });
    
    // Setup fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.taaMaterial);
    this.quad.frustumCulled = false;
    
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderWidth = Math.floor(width * this.renderScale);
    this.renderHeight = Math.floor(height * this.renderScale);
    
    this.historyTarget.setSize(width, height);
    this.outputTarget.setSize(width, height);
    
    this.taaMaterial.uniforms.resolution.value.set(width, height);
  }
  
  setRenderScale(scale: number): void {
    this.renderScale = scale;
    this.renderWidth = Math.floor(this.width * scale);
    this.renderHeight = Math.floor(this.height * scale);
  }
  
  getRenderSize(): { width: number; height: number } {
    return {
      width: this.renderWidth,
      height: this.renderHeight,
    };
  }
  
  updateParams(params: TAAEffectParams): void {
    if (params.enabled !== undefined) {
      this.enabled = params.enabled;
      this.taaMaterial.uniforms.enabled.value = params.enabled;
    }
    if (params.historyWeight !== undefined) {
      this.historyWeight = params.historyWeight;
      this.taaMaterial.uniforms.historyWeight.value = params.historyWeight;
    }
    if (params.varianceClipGamma !== undefined) {
      this.varianceClipGamma = params.varianceClipGamma;
      this.taaMaterial.uniforms.varianceClipGamma.value = params.varianceClipGamma;
    }
    if (params.renderScale !== undefined) {
      this.setRenderScale(params.renderScale);
    }
  }
  
  /**
   * Set current frame jitter offset (in pixels)
   */
  setJitter(jitter: THREE.Vector2): void {
    this.taaMaterial.uniforms.jitter.value.copy(jitter);
  }
  
  /**
   * Render TAA pass
   * @param renderer WebGL renderer
   * @param currentFrame Current rendered frame (may be lower res if using TSR)
   * @param velocityTexture Per-pixel motion vectors
   * @param depthTexture Scene depth
   * @returns Resolved texture at full resolution
   */
  render(
    renderer: THREE.WebGLRenderer,
    currentFrame: THREE.Texture,
    velocityTexture: THREE.Texture,
    depthTexture?: THREE.Texture
  ): THREE.Texture {
    this.frameIndex++;
    
    // Update uniforms
    this.taaMaterial.uniforms.currentFrame.value = currentFrame;
    this.taaMaterial.uniforms.velocityTexture.value = velocityTexture;
    if (depthTexture) {
      this.taaMaterial.uniforms.depthTexture.value = depthTexture;
    }
    
    // Render TAA resolve
    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.outputTarget);
    renderer.render(this.scene, this.camera);
    
    // Copy output to history for next frame
    renderer.setRenderTarget(this.historyTarget);
    this.taaMaterial.uniforms.currentFrame.value = this.outputTarget.texture;
    this.taaMaterial.uniforms.historyFrame.value = this.outputTarget.texture;
    this.taaMaterial.uniforms.enabled.value = false; // Just copy
    renderer.render(this.scene, this.camera);
    this.taaMaterial.uniforms.enabled.value = this.enabled;
    this.taaMaterial.uniforms.historyFrame.value = this.historyTarget.texture;
    
    renderer.setRenderTarget(oldTarget);
    
    return this.outputTarget.texture;
  }
  
  /**
   * Reset history (call on scene/camera change)
   */
  reset(): void {
    this.frameIndex = 0;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  getTexture(): THREE.Texture {
    return this.outputTarget.texture;
  }
  
  dispose(): void {
    this.historyTarget.dispose();
    this.outputTarget.dispose();
    this.taaMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
