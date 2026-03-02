import * as THREE from 'three';

/**
 * Screen-Space Ambient Occlusion (SSAO) Shader
 * Computes local occlusion based on depth buffer
 */

export const SSAOVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const SSAOFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform sampler2D tNoise;
  
  uniform mat4 projMatrix;
  uniform mat4 invProjMatrix;
  
  uniform vec2 resolution;
  uniform float radius;
  uniform float intensity;
  uniform float bias;
  uniform int samples;
  uniform float near;
  uniform float far;
  
  varying vec2 vUv;
  
  const int MAX_SAMPLES = 64;
  const float PI = 3.14159265359;
  
  // Precomputed hemisphere samples
  vec3 hemisphereKernel[64];
  
  // Decode normal from octahedral representation
  vec3 decodeNormal(vec2 f) {
    f = f * 2.0 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }
  
  // Reconstruct view-space position from depth
  vec3 reconstructViewPos(vec2 uv, float depth) {
    float z = depth * (far - near) + near;
    vec4 clipPos = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
    vec4 viewPos = invProjMatrix * clipPos;
    viewPos.xyz /= viewPos.w;
    viewPos.z = -z;
    return viewPos.xyz;
  }
  
  // Hash function for noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // Generate random vector for hemisphere sampling
  vec3 randomHemisphereVector(vec2 seed, vec3 normal) {
    float r1 = hash(seed);
    float r2 = hash(seed + vec2(1.0, 0.0));
    
    float theta = 2.0 * PI * r1;
    float phi = acos(2.0 * r2 - 1.0);
    
    vec3 v = vec3(
      sin(phi) * cos(theta),
      sin(phi) * sin(theta),
      cos(phi)
    );
    
    // Make sure it's in the hemisphere
    return dot(v, normal) < 0.0 ? -v : v;
  }
  
  void main() {
    float depth = texture2D(tDepth, vUv).r;
    
    // Skip background
    if (depth >= 1.0) {
      gl_FragColor = vec4(1.0);
      return;
    }
    
    vec3 viewNormal = decodeNormal(texture2D(tNormal, vUv).xy);
    vec3 viewPos = reconstructViewPos(vUv, depth);
    
    // Create TBN matrix from normal
    vec3 randomVec = normalize(vec3(
      hash(vUv) * 2.0 - 1.0,
      hash(vUv + vec2(1.0, 0.0)) * 2.0 - 1.0,
      0.0
    ));
    vec3 tangent = normalize(randomVec - viewNormal * dot(randomVec, viewNormal));
    vec3 bitangent = cross(viewNormal, tangent);
    mat3 TBN = mat3(tangent, bitangent, viewNormal);
    
    float occlusion = 0.0;
    int actualSamples = min(samples, MAX_SAMPLES);
    
    for (int i = 0; i < MAX_SAMPLES; i++) {
      if (i >= actualSamples) break;
      
      // Generate sample in hemisphere
      vec3 sampleOffset = randomHemisphereVector(vUv + vec2(float(i) * 0.1), viewNormal);
      
      // Scale sample by radius with distribution bias toward origin
      float scale = float(i) / float(actualSamples);
      scale = mix(0.1, 1.0, scale * scale);  // Bias toward center
      
      vec3 samplePos = viewPos + TBN * sampleOffset * radius * scale;
      
      // Project sample to screen space
      vec4 offset = projMatrix * vec4(samplePos, 1.0);
      offset.xy /= offset.w;
      offset.xy = offset.xy * 0.5 + 0.5;
      
      // Get depth at sample position
      float sampleDepth = texture2D(tDepth, offset.xy).r;
      float sampleLinearDepth = sampleDepth * (far - near) + near;
      
      // Range check & occlusion
      float rangeCheck = smoothstep(0.0, 1.0, radius / abs(-viewPos.z - sampleLinearDepth));
      occlusion += (sampleLinearDepth <= -samplePos.z + bias ? 1.0 : 0.0) * rangeCheck;
    }
    
    occlusion = 1.0 - (occlusion / float(actualSamples));
    occlusion = pow(occlusion, intensity);
    
    gl_FragColor = vec4(occlusion, occlusion, occlusion, 1.0);
  }
`;

// Blur pass for SSAO
export const SSAOBlurFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D tSSAO;
  uniform vec2 resolution;
  uniform vec2 direction;  // (1,0) for horizontal, (0,1) for vertical
  
  varying vec2 vUv;
  
  void main() {
    vec2 texelSize = 1.0 / resolution;
    float result = 0.0;
    
    // 4x4 box blur
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize * direction;
        result += texture2D(tSSAO, vUv + offset).r;
      }
    }
    
    result /= 25.0;
    
    gl_FragColor = vec4(result, result, result, 1.0);
  }
`;

export function createSSAOUniforms(params: {
  depthTexture: THREE.Texture;
  normalTexture: THREE.Texture;
  camera: THREE.PerspectiveCamera;
  resolution: THREE.Vector2;
  radius?: number;
  intensity?: number;
  bias?: number;
  samples?: number;
}): Record<string, THREE.IUniform> {
  const {
    depthTexture,
    normalTexture,
    camera,
    resolution,
    radius = 0.5,
    intensity = 1.5,
    bias = 0.025,
    samples = 16,
  } = params;
  
  return {
    tDepth: { value: depthTexture },
    tNormal: { value: normalTexture },
    tNoise: { value: null },
    projMatrix: { value: camera.projectionMatrix },
    invProjMatrix: { value: camera.projectionMatrixInverse },
    resolution: { value: resolution },
    radius: { value: radius },
    intensity: { value: intensity },
    bias: { value: bias },
    samples: { value: samples },
    near: { value: camera.near },
    far: { value: camera.far },
  };
}

export function createSSAOMaterial(
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SSAOVertexShader,
    fragmentShader: SSAOFragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export function createSSAOBlurMaterial(params: {
  ssaoTexture: THREE.Texture;
  resolution: THREE.Vector2;
  direction: THREE.Vector2;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SSAOVertexShader,
    fragmentShader: SSAOBlurFragmentShader,
    uniforms: {
      tSSAO: { value: params.ssaoTexture },
      resolution: { value: params.resolution },
      direction: { value: params.direction },
    },
    depthTest: false,
    depthWrite: false,
  });
}
