import * as THREE from 'three';

/**
 * Edge-Aware Bilateral Denoise Shader
 * Preserves edges based on depth and normal discontinuities
 * while smoothing noisy GI
 */

export const BilateralDenoiseVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const BilateralDenoiseFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D tInput;
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  
  uniform vec2 resolution;
  uniform int kernelRadius;
  uniform float depthSigma;
  uniform float normalSigma;
  uniform float spatialSigma;
  uniform float strength;
  
  varying vec2 vUv;
  
  // Decode normal from octahedral representation
  vec3 decodeNormal(vec2 f) {
    f = f * 2.0 - 1.0;
    vec3 n = vec3(f.x, f.y, 1.0 - abs(f.x) - abs(f.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }
  
  void main() {
    vec2 texelSize = 1.0 / resolution;
    
    vec3 centerColor = texture2D(tInput, vUv).rgb;
    float centerDepth = texture2D(tDepth, vUv).r;
    vec3 centerNormal = decodeNormal(texture2D(tNormal, vUv).xy);
    
    // Skip if background
    if (centerDepth >= 1.0) {
      gl_FragColor = vec4(centerColor, 1.0);
      return;
    }
    
    vec3 result = vec3(0.0);
    float totalWeight = 0.0;
    
    for (int x = -4; x <= 4; x++) {
      for (int y = -4; y <= 4; y++) {
        if (abs(x) > kernelRadius || abs(y) > kernelRadius) continue;
        
        vec2 sampleUV = vUv + vec2(float(x), float(y)) * texelSize;
        
        // Sample data
        vec3 sampleColor = texture2D(tInput, sampleUV).rgb;
        float sampleDepth = texture2D(tDepth, sampleUV).r;
        vec3 sampleNormal = decodeNormal(texture2D(tNormal, sampleUV).xy);
        
        // Skip background samples
        if (sampleDepth >= 1.0) continue;
        
        // Depth weight - exponential falloff for depth difference
        float depthDiff = abs(sampleDepth - centerDepth);
        float depthWeight = exp(-depthDiff * depthDiff * depthSigma * 1000.0);
        
        // Normal weight - dot product based
        float normalDot = max(0.0, dot(sampleNormal, centerNormal));
        float normalWeight = pow(normalDot, normalSigma);
        
        // Spatial weight - Gaussian
        float dist2 = float(x * x + y * y);
        float spatialWeight = exp(-dist2 * spatialSigma);
        
        // Combined weight
        float weight = depthWeight * normalWeight * spatialWeight;
        
        result += sampleColor * weight;
        totalWeight += weight;
      }
    }
    
    vec3 denoised = totalWeight > 0.0 ? result / totalWeight : centerColor;
    
    // Blend with original based on strength
    vec3 finalColor = mix(centerColor, denoised, strength);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export function createBilateralDenoiseUniforms(params: {
  inputTexture: THREE.Texture;
  depthTexture: THREE.Texture;
  normalTexture: THREE.Texture;
  resolution: THREE.Vector2;
  kernelRadius?: number;
  depthSigma?: number;
  normalSigma?: number;
  spatialSigma?: number;
  strength?: number;
}): Record<string, THREE.IUniform> {
  const {
    inputTexture,
    depthTexture,
    normalTexture,
    resolution,
    kernelRadius = 3,
    depthSigma = 0.5,
    normalSigma = 32.0,
    spatialSigma = 0.1,
    strength = 0.8,
  } = params;
  
  return {
    tInput: { value: inputTexture },
    tDepth: { value: depthTexture },
    tNormal: { value: normalTexture },
    resolution: { value: resolution },
    kernelRadius: { value: kernelRadius },
    depthSigma: { value: depthSigma },
    normalSigma: { value: normalSigma },
    spatialSigma: { value: spatialSigma },
    strength: { value: strength },
  };
}

export function createBilateralDenoiseMaterial(
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: BilateralDenoiseVertexShader,
    fragmentShader: BilateralDenoiseFragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}
