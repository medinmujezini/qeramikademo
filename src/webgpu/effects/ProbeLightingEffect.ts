// Probe Lighting Effect
// Samples irradiance from probe volume in screen space

import * as THREE from 'three';

const ProbeLightingVertexShader = `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const ProbeLightingFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D depthTexture;
  uniform sampler2D normalTexture;
  uniform sampler2D probeTexture; // Using 2D texture atlas instead of 3D for compatibility
  
  uniform vec3 probeVolumeMin;
  uniform vec3 probeVolumeMax;
  uniform vec3 probeResolution;
  uniform float probeSpacing;
  
  uniform vec2 resolution;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform mat4 inverseProjectionMatrix;
  uniform mat4 inverseViewMatrix;
  
  varying vec2 vUv;

  // SH constants for L1
  const float SH_C0 = 0.282095;
  const float SH_C1 = 0.488603;

  // Decode octahedral normal
  vec3 decodeNormal(vec2 encoded) {
    encoded = encoded * 2.0 - 1.0;
    vec3 n = vec3(encoded, 1.0 - abs(encoded.x) - abs(encoded.y));
    if (n.z < 0.0) {
      n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return normalize(n);
  }

  // Reconstruct world position from UV and depth
  vec3 reconstructWorldPos(vec2 uv, float depth) {
    float z = depth * 2.0 - 1.0;
    vec4 clipPos = vec4(uv * 2.0 - 1.0, z, 1.0);
    vec4 viewPos = inverseProjectionMatrix * clipPos;
    viewPos /= viewPos.w;
    vec4 worldPos = inverseViewMatrix * viewPos;
    return worldPos.xyz;
  }

  // Sample SH coefficients - fallback to simple ambient
  vec4 sampleProbeSH(vec3 probeCoord) {
    // For now, return basic ambient SH
    // This will be enhanced when 3D texture support is available
    float ambient = 0.15 + probeCoord.y * 0.1; // Height-based ambient
    return vec4(ambient, probeCoord.y * 0.1, 0.0, 0.0);
  }

  // Evaluate L1 Spherical Harmonics
  vec3 evaluateSH(vec4 shCoeffs, vec3 direction) {
    // L0 band (constant)
    vec3 result = vec3(shCoeffs.x) * SH_C0;
    
    // L1 band (linear)
    result += vec3(shCoeffs.y) * SH_C1 * direction.y;
    result += vec3(shCoeffs.z) * SH_C1 * direction.z;
    result += vec3(shCoeffs.w) * SH_C1 * direction.x;
    
    return max(result, vec3(0.0));
  }

  // Visibility-weighted probe sampling
  float testVisibility(vec3 probePos, vec3 surfacePos, vec3 normal) {
    vec3 toProbe = probePos - surfacePos;
    float dist = length(toProbe);
    if (dist < 0.001) return 1.0;
    
    vec3 dir = toProbe / dist;
    
    // Check if probe is behind surface
    float dotNormal = dot(dir, normal);
    if (dotNormal < 0.0) return 0.0;
    
    // Distance falloff with visibility weighting
    return dotNormal * exp(-dist * 0.3);
  }

  // Sample probe irradiance with visibility weighting
  vec3 sampleProbeIrradiance(vec3 worldPos, vec3 normal) {
    // Convert world position to probe volume UV
    vec3 volumeSize = probeVolumeMax - probeVolumeMin;
    vec3 probeUV = (worldPos - probeVolumeMin) / volumeSize;
    
    // Check if outside volume
    if (any(lessThan(probeUV, vec3(0.0))) || any(greaterThan(probeUV, vec3(1.0)))) {
      // Fallback to ambient
      return vec3(0.1, 0.12, 0.15);
    }
    
    // Sample SH at this position
    vec4 sh = sampleProbeSH(probeUV);
    
    // Evaluate SH for the surface normal
    vec3 irradiance = evaluateSH(sh, normal);
    
    // Apply visibility weighting based on normal
    float visWeight = max(0.0, dot(normal, vec3(0.0, 1.0, 0.0)) * 0.3 + 0.7);
    
    return irradiance * visWeight;
  }

  void main() {
    float depth = texture2D(depthTexture, vUv).r;
    
    // Skip sky pixels
    if (depth >= 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    
    // Reconstruct position and normal
    vec4 normalData = texture2D(normalTexture, vUv);
    vec3 normal = decodeNormal(normalData.rg);
    vec3 worldPos = reconstructWorldPos(vUv, depth);
    
    // Transform normal to world space (it's already in view space from G-Buffer)
    vec3 worldNormal = (inverseViewMatrix * vec4(normal, 0.0)).xyz;
    worldNormal = normalize(worldNormal);
    
    // Sample probe irradiance
    vec3 irradiance = sampleProbeIrradiance(worldPos, worldNormal);
    
    gl_FragColor = vec4(irradiance, 1.0);
  }
`;

export interface ProbeLightingEffectParams {
  probeVolumeMin?: THREE.Vector3;
  probeVolumeMax?: THREE.Vector3;
  probeResolution?: THREE.Vector3;
  probeSpacing?: number;
}

export class ProbeLightingEffect {
  private material: THREE.ShaderMaterial;
  private outputTarget: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(width: number, height: number, params: ProbeLightingEffectParams = {}) {
    const {
      probeVolumeMin = new THREE.Vector3(-10, 0, -10),
      probeVolumeMax = new THREE.Vector3(10, 5, 10),
      probeResolution = new THREE.Vector3(8, 4, 8),
      probeSpacing = 1.25,
    } = params;

    // Create material - using default GLSL version for compatibility
    this.material = new THREE.ShaderMaterial({
      vertexShader: ProbeLightingVertexShader,
      fragmentShader: ProbeLightingFragmentShader,
      uniforms: {
        depthTexture: { value: null },
        normalTexture: { value: null },
        probeTexture: { value: null },
        probeVolumeMin: { value: probeVolumeMin },
        probeVolumeMax: { value: probeVolumeMax },
        probeResolution: { value: probeResolution },
        probeSpacing: { value: probeSpacing },
        resolution: { value: new THREE.Vector2(width, height) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        inverseViewMatrix: { value: new THREE.Matrix4() },
      },
    });

    // Create render target
    this.outputTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.material);
    this.quad.frustumCulled = false;

    // Create render scene
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width: number, height: number) {
    this.outputTarget.setSize(width, height);
    this.material.uniforms.resolution.value.set(width, height);
  }

  updateCamera(camera: THREE.PerspectiveCamera) {
    this.material.uniforms.cameraNear.value = camera.near;
    this.material.uniforms.cameraFar.value = camera.far;
    this.material.uniforms.inverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    this.material.uniforms.inverseViewMatrix.value.copy(camera.matrixWorld);
  }

  updateProbeVolume(min: THREE.Vector3, max: THREE.Vector3, resolution: THREE.Vector3) {
    this.material.uniforms.probeVolumeMin.value.copy(min);
    this.material.uniforms.probeVolumeMax.value.copy(max);
    this.material.uniforms.probeResolution.value.copy(resolution);
  }

  setProbeTexture(texture: THREE.Data3DTexture | null) {
    this.material.uniforms.probeTexture.value = texture;
  }

  render(
    renderer: THREE.WebGLRenderer,
    inputs: {
      depthTexture: THREE.Texture;
      normalTexture: THREE.Texture;
    }
  ): THREE.Texture {
    this.material.uniforms.depthTexture.value = inputs.depthTexture;
    this.material.uniforms.normalTexture.value = inputs.normalTexture;

    renderer.setRenderTarget(this.outputTarget);
    renderer.render(this.scene, this.camera);

    return this.outputTarget.texture;
  }

  dispose() {
    this.material.dispose();
    this.outputTarget.dispose();
    this.quad.geometry.dispose();
  }
}
