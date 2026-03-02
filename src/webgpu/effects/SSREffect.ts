import * as THREE from 'three';

/**
 * Screen-Space Reflections Effect
 * 
 * Ray marches in screen space to find reflections.
 * Falls back to environment map when ray misses.
 */

const SSRVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SSRFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D colorBuffer;
  uniform sampler2D depthBuffer;
  uniform sampler2D normalBuffer;
  uniform sampler2D gAlbedoRoughness;
  uniform samplerCube envMap;
  uniform bool hasEnvMap;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 inverseProjectionMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 inverseViewMatrix;
  uniform vec2 resolution;
  uniform float maxDistance;
  uniform int maxSteps;
  uniform float thickness;
  uniform float roughnessThreshold;
  uniform float falloffExponent;
  uniform float jitter;
  uniform float time;
  
  varying vec2 vUv;
  
  // Random noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
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
  
  // Binary search for precise hit
  vec3 binarySearch(vec3 rayOrigin, vec3 rayDir, float startT, float endT, int iterations) {
    float t = 0.0;
    vec3 result = vec3(0.0);
    
    for (int i = 0; i < 8; i++) {
      if (i >= iterations) break;
      
      t = (startT + endT) * 0.5;
      vec3 samplePos = rayOrigin + rayDir * t;
      vec2 sampleUV = projectToScreen(samplePos);
      
      if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
        return vec3(-1.0);
      }
      
      float sampleDepth = texture2D(depthBuffer, sampleUV).g;
      vec3 sampleViewPos = getViewPosition(sampleUV, sampleDepth);
      
      float depthDiff = samplePos.z - sampleViewPos.z;
      
      if (depthDiff > 0.0) {
        endT = t;
      } else {
        startT = t;
      }
      
      result = vec3(sampleUV, t);
    }
    
    return result;
  }
  
  // Main SSR ray march
  vec4 rayMarch(vec3 viewPos, vec3 viewDir, vec3 normal, float roughness) {
    vec3 reflectDir = reflect(viewDir, normal);
    
    // Add jitter for noise reduction
    float jitterOffset = hash(vUv * resolution + time) * jitter;
    
    vec3 rayOrigin = viewPos + reflectDir * 0.05; // Offset to avoid self-intersection
    vec3 rayEnd = viewPos + reflectDir * maxDistance;
    
    float stepSize = maxDistance / float(maxSteps);
    float t = jitterOffset * stepSize;
    
    vec2 hitUV = vec2(-1.0);
    float hitT = 0.0;
    bool hit = false;
    
    for (int i = 0; i < 128; i++) {
      if (i >= maxSteps) break;
      if (hit) break;
      
      t += stepSize;
      vec3 samplePos = rayOrigin + reflectDir * t;
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
      
      // Check if ray is behind surface
      if (depthDiff > 0.0 && depthDiff < thickness) {
        // Binary search for precise hit
        vec3 refined = binarySearch(rayOrigin, reflectDir, t - stepSize, t, 5);
        if (refined.x >= 0.0) {
          hitUV = refined.xy;
          hitT = refined.z;
          hit = true;
        }
      }
    }
    
    if (!hit) {
      return vec4(0.0);
    }
    
    // Edge fade
    vec2 edgeFade = smoothstep(0.0, 0.1, hitUV) * smoothstep(1.0, 0.9, hitUV);
    float screenFade = edgeFade.x * edgeFade.y;
    
    // Distance fade
    float distanceFade = 1.0 - pow(hitT / maxDistance, falloffExponent);
    
    // Roughness fade
    float roughnessFade = 1.0 - smoothstep(0.0, roughnessThreshold, roughness);
    
    float confidence = screenFade * distanceFade * roughnessFade;
    
    vec3 hitColor = texture2D(colorBuffer, hitUV).rgb;
    
    return vec4(hitColor, confidence);
  }
  
  void main() {
    // Sample inputs
    float depth = texture2D(depthBuffer, vUv).g;
    
    // Early out for sky
    if (depth >= 0.9999) {
      gl_FragColor = vec4(0.0);
      return;
    }
    
    vec4 normalData = texture2D(normalBuffer, vUv);
    vec4 albedoRoughness = texture2D(gAlbedoRoughness, vUv);
    
    vec3 normal = decodeNormal(normalData.rg);
    float roughness = albedoRoughness.a;
    float metalness = normalData.b;
    
    // Skip rough surfaces
    if (roughness > roughnessThreshold) {
      gl_FragColor = vec4(0.0);
      return;
    }
    
    // Get view-space position and direction
    vec3 viewPos = getViewPosition(vUv, depth);
    vec3 viewDir = normalize(viewPos);
    
    // Transform normal to view space
    vec3 viewNormal = normalize((uViewMatrix * inverseViewMatrix * vec4(normal, 0.0)).xyz);
    
    // Ray march
    vec4 reflection = rayMarch(viewPos, viewDir, viewNormal, roughness);
    
    // Fallback to env map if no hit and env map available
    if (reflection.a < 0.1 && hasEnvMap) {
      vec3 worldDir = (inverseViewMatrix * vec4(reflect(viewDir, viewNormal), 0.0)).xyz;
      vec3 envColor = textureCube(envMap, worldDir).rgb;
      
      // Fresnel
      float fresnel = pow(1.0 - max(dot(-viewDir, viewNormal), 0.0), 5.0);
      float envWeight = fresnel * (1.0 - roughness) * 0.5;
      
      gl_FragColor = vec4(envColor * envWeight, envWeight);
      return;
    }
    
    gl_FragColor = reflection;
  }
`;

export interface SSREffectParams {
  enabled?: boolean;
  maxDistance?: number;
  maxSteps?: number;
  thickness?: number;
  roughnessThreshold?: number;
  falloffExponent?: number;
  jitter?: number;
}

export class SSREffect {
  private material: THREE.ShaderMaterial;
  private renderTarget: THREE.WebGLRenderTarget;
  private fsQuad: THREE.Mesh;
  private fsScene: THREE.Scene;
  private fsCamera: THREE.OrthographicCamera;
  
  private time = 0;
  
  constructor(width: number, height: number, params: SSREffectParams = {}) {
    const {
      maxDistance = 10.0,
      maxSteps = 64,
      thickness = 0.1,
      roughnessThreshold = 0.5,
      falloffExponent = 1.0,
      jitter = 1.0,
    } = params;
    
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: SSRVertexShader,
      fragmentShader: SSRFragmentShader,
      uniforms: {
        colorBuffer: { value: null },
        depthBuffer: { value: null },
        normalBuffer: { value: null },
        gAlbedoRoughness: { value: null },
        envMap: { value: null },
        hasEnvMap: { value: false },
        
        uProjectionMatrix: { value: new THREE.Matrix4() },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        uViewMatrix: { value: new THREE.Matrix4() },
        inverseViewMatrix: { value: new THREE.Matrix4() },
        resolution: { value: new THREE.Vector2(width, height) },
        
        maxDistance: { value: maxDistance },
        maxSteps: { value: maxSteps },
        thickness: { value: thickness },
        roughnessThreshold: { value: roughnessThreshold },
        falloffExponent: { value: falloffExponent },
        jitter: { value: jitter },
        time: { value: 0 },
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
    this.material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
    this.material.uniforms.inverseViewMatrix.value.copy(camera.matrixWorld);
  }
  
  updateParams(params: SSREffectParams): void {
    if (params.maxDistance !== undefined) {
      this.material.uniforms.maxDistance.value = params.maxDistance;
    }
    if (params.maxSteps !== undefined) {
      this.material.uniforms.maxSteps.value = params.maxSteps;
    }
    if (params.thickness !== undefined) {
      this.material.uniforms.thickness.value = params.thickness;
    }
    if (params.roughnessThreshold !== undefined) {
      this.material.uniforms.roughnessThreshold.value = params.roughnessThreshold;
    }
    if (params.falloffExponent !== undefined) {
      this.material.uniforms.falloffExponent.value = params.falloffExponent;
    }
    if (params.jitter !== undefined) {
      this.material.uniforms.jitter.value = params.jitter;
    }
  }
  
  setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }
  
  render(
    renderer: THREE.WebGLRenderer,
    colorBuffer: THREE.Texture,
    depthBuffer: THREE.Texture,
    normalBuffer: THREE.Texture,
    albedoRoughnessBuffer: THREE.Texture,
    envMap?: THREE.CubeTexture
  ): THREE.Texture {
    this.time += 0.016;
    this.material.uniforms.time.value = this.time;
    
    this.material.uniforms.colorBuffer.value = colorBuffer;
    this.material.uniforms.depthBuffer.value = depthBuffer;
    this.material.uniforms.normalBuffer.value = normalBuffer;
    this.material.uniforms.gAlbedoRoughness.value = albedoRoughnessBuffer;
    
    if (envMap) {
      this.material.uniforms.envMap.value = envMap;
      this.material.uniforms.hasEnvMap.value = true;
    } else {
      this.material.uniforms.hasEnvMap.value = false;
    }
    
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

export default SSREffect;
