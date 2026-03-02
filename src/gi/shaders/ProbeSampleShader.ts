import * as THREE from 'three';

/**
 * Probe Sampling Shader
 * Samples irradiance from the 3D probe grid using trilinear interpolation
 */

export const ProbeSampleVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const ProbeSampleFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform sampler2D tAlbedo;
  
  // Probe volume data (packed as 2D texture atlas for WebGL2 compatibility)
  uniform sampler2D tProbeGrid;
  uniform vec3 probeGridMin;
  uniform vec3 probeGridMax;
  uniform vec3 probeGridResolution;
  uniform float probeSpacing;
  
  uniform mat4 invViewMatrix;
  uniform mat4 invProjMatrix;
  uniform vec2 resolution;
  uniform float near;
  uniform float far;
  
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  
  // Decode normal from octahedral representation
  vec3 decodeNormal(vec2 f) {
    f = f * 2.0 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }
  
  // Reconstruct world position from depth
  vec3 reconstructWorldPos(vec2 uv, float depth) {
    float z = depth * (far - near) + near;
    vec4 clipPos = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
    vec4 viewPos = invProjMatrix * clipPos;
    viewPos.xyz /= viewPos.w;
    viewPos.z = -z;
    vec4 worldPos = invViewMatrix * vec4(viewPos.xyz, 1.0);
    return worldPos.xyz;
  }
  
  // SH basis functions for L1
  vec4 getSHBasis(vec3 dir) {
    return vec4(
      0.282095,             // Y_0^0
      0.488603 * dir.y,     // Y_1^-1
      0.488603 * dir.z,     // Y_1^0
      0.488603 * dir.x      // Y_1^1
    );
  }
  
  // Sample SH coefficients from probe grid texture
  // Grid is stored as 2D atlas: each probe has 4 texels (for L1 SH)
  vec4[4] sampleProbeSH(vec3 probeIdx) {
    vec4 sh[4];
    
    // Calculate texture coordinates
    // Atlas layout: probes arranged in 2D with 4 texels per probe
    float probeIndex = probeIdx.z * probeGridResolution.x * probeGridResolution.y +
                       probeIdx.y * probeGridResolution.x +
                       probeIdx.x;
    
    float atlasWidth = probeGridResolution.x * 4.0;
    float atlasHeight = probeGridResolution.y * probeGridResolution.z;
    
    float row = floor(probeIndex / (probeGridResolution.x));
    float col = mod(probeIndex, probeGridResolution.x) * 4.0;
    
    vec2 texelSize = vec2(1.0 / atlasWidth, 1.0 / atlasHeight);
    
    for (int i = 0; i < 4; i++) {
      vec2 texCoord = (vec2(col + float(i) + 0.5, row + 0.5)) * texelSize;
      sh[i] = texture2D(tProbeGrid, texCoord);
    }
    
    return sh;
  }
  
  // Evaluate SH irradiance in a direction
  vec3 evaluateSH(vec4 sh[4], vec3 normal) {
    vec4 basis = getSHBasis(normal);
    
    vec3 irradiance = vec3(
      dot(vec4(sh[0].r, sh[1].r, sh[2].r, sh[3].r), basis),
      dot(vec4(sh[0].g, sh[1].g, sh[2].g, sh[3].g), basis),
      dot(vec4(sh[0].b, sh[1].b, sh[2].b, sh[3].b), basis)
    );
    
    return max(irradiance, vec3(0.0));
  }
  
  // Trilinear interpolation of probe irradiance
  vec3 sampleProbeIrradiance(vec3 worldPos, vec3 normal) {
    // Convert world position to grid coordinates
    vec3 gridPos = (worldPos - probeGridMin) / probeSpacing;
    
    // Clamp to grid bounds
    gridPos = clamp(gridPos, vec3(0.0), probeGridResolution - 1.0);
    
    // Get integer and fractional parts
    vec3 probeCoord = floor(gridPos);
    vec3 frac = fract(gridPos);
    
    vec3 irradiance = vec3(0.0);
    
    // Trilinear interpolation between 8 nearest probes
    for (int dx = 0; dx <= 1; dx++) {
      for (int dy = 0; dy <= 1; dy++) {
        for (int dz = 0; dz <= 1; dz++) {
          vec3 offset = vec3(float(dx), float(dy), float(dz));
          vec3 probeIdx = probeCoord + offset;
          
          // Clamp to grid bounds
          probeIdx = clamp(probeIdx, vec3(0.0), probeGridResolution - 1.0);
          
          // Fetch SH coefficients
          vec4 sh[4] = sampleProbeSH(probeIdx);
          
          // Evaluate SH in normal direction
          vec3 probeIrradiance = evaluateSH(sh, normal);
          
          // Trilinear weight
          vec3 w = mix(1.0 - frac, frac, offset);
          float weight = w.x * w.y * w.z;
          
          irradiance += probeIrradiance * weight;
        }
      }
    }
    
    return irradiance;
  }
  
  void main() {
    float depth = texture2D(tDepth, vUv).r;
    
    // Background - no probe GI
    if (depth >= 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }
    
    vec3 normal = decodeNormal(texture2D(tNormal, vUv).xy);
    vec3 worldPos = reconstructWorldPos(vUv, depth);
    
    // Sample probe irradiance
    vec3 irradiance = sampleProbeIrradiance(worldPos, normal);
    
    // Clamp to reasonable range
    irradiance = clamp(irradiance, vec3(0.0), vec3(2.0));
    
    gl_FragColor = vec4(irradiance, 1.0);
  }
`;

export function createProbeSampleUniforms(params: {
  depthTexture: THREE.Texture;
  normalTexture: THREE.Texture;
  albedoTexture: THREE.Texture;
  probeGridTexture: THREE.Texture;
  probeGridMin: THREE.Vector3;
  probeGridMax: THREE.Vector3;
  probeGridResolution: THREE.Vector3;
  probeSpacing: number;
  camera: THREE.PerspectiveCamera;
  resolution: THREE.Vector2;
}): Record<string, THREE.IUniform> {
  const {
    depthTexture,
    normalTexture,
    albedoTexture,
    probeGridTexture,
    probeGridMin,
    probeGridMax,
    probeGridResolution,
    probeSpacing,
    camera,
    resolution,
  } = params;
  
  return {
    tDepth: { value: depthTexture },
    tNormal: { value: normalTexture },
    tAlbedo: { value: albedoTexture },
    tProbeGrid: { value: probeGridTexture },
    probeGridMin: { value: probeGridMin },
    probeGridMax: { value: probeGridMax },
    probeGridResolution: { value: probeGridResolution },
    probeSpacing: { value: probeSpacing },
    invViewMatrix: { value: camera.matrixWorld },
    invProjMatrix: { value: camera.projectionMatrixInverse },
    resolution: { value: resolution },
    near: { value: camera.near },
    far: { value: camera.far },
  };
}

export function createProbeSampleMaterial(
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ProbeSampleVertexShader,
    fragmentShader: ProbeSampleFragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}
