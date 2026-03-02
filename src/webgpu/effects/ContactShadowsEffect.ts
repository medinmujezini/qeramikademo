import * as THREE from 'three';

/**
 * Contact Shadows Effect
 * 
 * Screen-space ray march in depth for soft close-range shadows.
 * This is a cheap effect that adds grounding to objects.
 */

const ContactShadowsVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ContactShadowsFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D depthBuffer;
  uniform sampler2D normalBuffer;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 inverseProjectionMatrix;
  uniform vec3 lightDirection;
  uniform vec2 resolution;
  uniform float maxDistance;
  uniform int maxSteps;
  uniform float thickness;
  uniform float intensity;
  uniform float bias;
  
  varying vec2 vUv;
  
  // Decode octahedral normal
  vec3 decodeNormal(vec2 enc) {
    enc = enc * 2.0 - 1.0;
    vec3 n = vec3(enc.xy, 1.0 - abs(enc.x) - abs(enc.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }
  
  // Get view-space position from UV and depth
  vec3 getViewPosition(vec2 uv, float depth) {
    vec4 clipPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = inverseProjectionMatrix * clipPos;
    return viewPos.xyz / viewPos.w;
  }
  
  // Project view-space position to screen
  vec2 projectToScreen(vec3 viewPos) {
    vec4 clipPos = uProjectionMatrix * vec4(viewPos, 1.0);
    return (clipPos.xy / clipPos.w) * 0.5 + 0.5;
  }
  
  void main() {
    float depth = texture2D(depthBuffer, vUv).g;
    
    // Early out for sky
    if (depth >= 0.9999) {
      gl_FragColor = vec4(1.0);
      return;
    }
    
    vec4 normalData = texture2D(normalBuffer, vUv);
    vec3 normal = decodeNormal(normalData.rg);
    
    vec3 viewPos = getViewPosition(vUv, depth);
    
    // Transform light direction to view space (approximate)
    vec3 viewLightDir = normalize(-lightDirection);
    
    // Check if surface faces light
    float NdotL = dot(normal, viewLightDir);
    if (NdotL <= 0.0) {
      gl_FragColor = vec4(vec3(1.0 - intensity * 0.5), 1.0);
      return;
    }
    
    // Ray march toward light
    vec3 rayOrigin = viewPos + normal * bias;
    float stepSize = maxDistance / float(maxSteps);
    
    float shadow = 0.0;
    float t = 0.0;
    
    for (int i = 0; i < 32; i++) {
      if (i >= maxSteps) break;
      
      t += stepSize;
      vec3 samplePos = rayOrigin + viewLightDir * t;
      vec2 sampleUV = projectToScreen(samplePos);
      
      // Check bounds
      if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
        break;
      }
      
      float sampleDepth = texture2D(depthBuffer, sampleUV).g;
      
      // Skip sky
      if (sampleDepth >= 0.9999) continue;
      
      vec3 sampleViewPos = getViewPosition(sampleUV, sampleDepth);
      float depthDiff = samplePos.z - sampleViewPos.z;
      
      // Check if ray is occluded
      if (depthDiff > 0.0 && depthDiff < thickness) {
        // Accumulate shadow with distance falloff
        float distanceFalloff = 1.0 - t / maxDistance;
        shadow = max(shadow, distanceFalloff);
        break;
      }
    }
    
    float result = 1.0 - shadow * intensity;
    gl_FragColor = vec4(vec3(result), 1.0);
  }
`;

export interface ContactShadowsParams {
  enabled?: boolean;
  maxDistance?: number;
  maxSteps?: number;
  thickness?: number;
  intensity?: number;
  bias?: number;
  lightDirection?: THREE.Vector3;
}

export class ContactShadowsEffect {
  private material: THREE.ShaderMaterial;
  private renderTarget: THREE.WebGLRenderTarget;
  private fsQuad: THREE.Mesh;
  private fsScene: THREE.Scene;
  private fsCamera: THREE.OrthographicCamera;
  
  constructor(width: number, height: number, params: ContactShadowsParams = {}) {
    const {
      maxDistance = 0.5,
      maxSteps = 16,
      thickness = 0.05,
      intensity = 0.5,
      bias = 0.01,
      lightDirection = new THREE.Vector3(-1, -1, -1).normalize(),
    } = params;
    
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RedFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: ContactShadowsVertexShader,
      fragmentShader: ContactShadowsFragmentShader,
      uniforms: {
        depthBuffer: { value: null },
        normalBuffer: { value: null },
        
        uProjectionMatrix: { value: new THREE.Matrix4() },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        lightDirection: { value: lightDirection },
        resolution: { value: new THREE.Vector2(width, height) },
        
        maxDistance: { value: maxDistance },
        maxSteps: { value: maxSteps },
        thickness: { value: thickness },
        intensity: { value: intensity },
        bias: { value: bias },
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
  
  updateCamera(camera: THREE.PerspectiveCamera): void {
    this.material.uniforms.uProjectionMatrix.value.copy(camera.projectionMatrix);
    this.material.uniforms.inverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
  }
  
  updateParams(params: ContactShadowsParams): void {
    if (params.maxDistance !== undefined) {
      this.material.uniforms.maxDistance.value = params.maxDistance;
    }
    if (params.maxSteps !== undefined) {
      this.material.uniforms.maxSteps.value = params.maxSteps;
    }
    if (params.thickness !== undefined) {
      this.material.uniforms.thickness.value = params.thickness;
    }
    if (params.intensity !== undefined) {
      this.material.uniforms.intensity.value = params.intensity;
    }
    if (params.bias !== undefined) {
      this.material.uniforms.bias.value = params.bias;
    }
    if (params.lightDirection) {
      this.material.uniforms.lightDirection.value.copy(params.lightDirection);
    }
  }
  
  setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }
  
  render(
    renderer: THREE.WebGLRenderer,
    depthBuffer: THREE.Texture,
    normalBuffer: THREE.Texture
  ): THREE.Texture {
    this.material.uniforms.depthBuffer.value = depthBuffer;
    this.material.uniforms.normalBuffer.value = normalBuffer;
    
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.fsScene, this.fsCamera);
    
    return this.renderTarget.texture;
  }
  
  dispose(): void {
    this.material.dispose();
    this.renderTarget.dispose();
    (this.fsQuad.geometry as THREE.PlaneGeometry).dispose();
  }
}

export default ContactShadowsEffect;
