import * as THREE from 'three';

/**
 * Screen-Space Global Illumination (SSGI) Shader
 * Uses screen-space ray marching to compute indirect lighting
 * 
 * Features:
 * - Short ray lengths to prevent light leaks through walls
 * - Temporal reprojection with history clamping
 * - Cosine-weighted hemisphere sampling
 */

export const SSGIVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const SSGIFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D tDepth;
  uniform sampler2D tNormal;
  uniform sampler2D tAlbedo;
  uniform sampler2D tDirect;
  uniform sampler2D tHistory;
  uniform sampler2D tNoise;
  
  uniform mat4 projMatrix;
  uniform mat4 invProjMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 invViewMatrix;
  uniform mat4 prevViewProjMatrix;
  
  uniform vec2 resolution;
  uniform float rayLength;
  uniform int numRays;
  uniform int raySteps;
  uniform float historyWeight;
  uniform float time;
  uniform float near;
  uniform float far;
  
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  const float TWO_PI = 6.28318530718;
  
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
  
  // Reconstruct world position
  vec3 reconstructWorldPos(vec2 uv, float depth) {
    vec3 viewPos = reconstructViewPos(uv, depth);
    return (invViewMatrix * vec4(viewPos, 1.0)).xyz;
  }
  
  // Hash function for random sampling
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // Cosine-weighted hemisphere sampling
  vec3 cosineWeightedDirection(vec3 normal, int sampleIndex, int totalSamples) {
    float phi = TWO_PI * hash(vUv + float(sampleIndex) * 0.1 + time);
    float cosTheta = sqrt(hash(vUv.yx + float(sampleIndex) * 0.2 + time * 0.5));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    
    // Create tangent space basis
    vec3 up = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, normal));
    vec3 bitangent = cross(normal, tangent);
    
    // Sample direction in tangent space
    vec3 sampleDir = tangent * (sinTheta * cos(phi)) +
                     bitangent * (sinTheta * sin(phi)) +
                     normal * cosTheta;
    
    return normalize(sampleDir);
  }
  
  // Screen-space ray marching
  bool traceScreenSpaceRay(
    vec3 origin,
    vec3 direction,
    float maxLength,
    out vec2 hitUV,
    out float hitDepth
  ) {
    // Project ray to screen space
    vec4 startClip = projMatrix * viewMatrix * vec4(origin, 1.0);
    vec2 startScreen = startClip.xy / startClip.w * 0.5 + 0.5;
    
    vec3 endWorld = origin + direction * maxLength;
    vec4 endClip = projMatrix * viewMatrix * vec4(endWorld, 1.0);
    vec2 endScreen = endClip.xy / endClip.w * 0.5 + 0.5;
    
    // Ray march in screen space
    vec2 delta = endScreen - startScreen;
    float steps = float(raySteps);
    vec2 stepSize = delta / steps;
    
    for (int i = 1; i <= raySteps; i++) {
      vec2 sampleUV = startScreen + stepSize * float(i);
      
      // Check bounds
      if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
        break;
      }
      
      // Sample depth at this position
      float sampleDepth = texture2D(tDepth, sampleUV).r;
      
      // Calculate expected depth at this ray position
      float t = float(i) / steps;
      float rayDepth = mix(startClip.w, endClip.w, t);
      float sampleLinearDepth = sampleDepth * (far - near) + near;
      
      // Check for intersection (with thickness threshold)
      float thickness = 0.1;
      if (rayDepth > sampleLinearDepth && rayDepth < sampleLinearDepth + thickness) {
        hitUV = sampleUV;
        hitDepth = sampleDepth;
        return true;
      }
    }
    
    return false;
  }
  
  // Compute SSGI for a pixel
  vec3 computeSSGI(vec2 uv) {
    vec4 normalData = texture2D(tNormal, uv);
    float depth = texture2D(tDepth, uv).r;
    
    if (depth >= 1.0) return vec3(0.0);  // Sky
    
    vec3 normal = decodeNormal(normalData.xy);
    vec3 worldPos = reconstructWorldPos(uv, depth);
    
    vec3 indirect = vec3(0.0);
    float totalWeight = 0.0;
    
    for (int i = 0; i < 16; i++) {  // Max rays (numRays controls actual count)
      if (i >= numRays) break;
      
      vec3 rayDir = cosineWeightedDirection(normal, i, numRays);
      
      vec2 hitUV;
      float hitDepth;
      
      if (traceScreenSpaceRay(worldPos + normal * 0.05, rayDir, rayLength, hitUV, hitDepth)) {
        // Sample hit albedo and direct light
        vec3 hitAlbedo = texture2D(tAlbedo, hitUV).rgb;
        vec3 hitDirect = texture2D(tDirect, hitUV).rgb;
        
        // Indirect contribution = reflected light * albedo
        vec3 hitLight = hitDirect * hitAlbedo;
        
        float weight = max(0.0, dot(normal, rayDir));
        indirect += hitLight * weight;
        totalWeight += weight;
      }
    }
    
    return totalWeight > 0.0 ? indirect / totalWeight : vec3(0.0);
  }
  
  // Neighborhood clamping for temporal stability
  vec3 neighborhoodClamp(vec2 uv, vec3 history) {
    vec3 minBound = vec3(999.0);
    vec3 maxBound = vec3(-999.0);
    
    vec2 texelSize = 1.0 / resolution;
    
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        vec3 neighbor = computeSSGI(uv + vec2(x, y) * texelSize);
        minBound = min(minBound, neighbor);
        maxBound = max(maxBound, neighbor);
      }
    }
    
    return clamp(history, minBound, maxBound);
  }
  
  void main() {
    vec3 currentSSGI = computeSSGI(vUv);
    
    // Temporal reprojection
    vec4 worldPos4 = vec4(reconstructWorldPos(vUv, texture2D(tDepth, vUv).r), 1.0);
    vec4 prevClip = prevViewProjMatrix * worldPos4;
    vec2 prevUV = prevClip.xy / prevClip.w * 0.5 + 0.5;
    
    vec3 history = texture2D(tHistory, prevUV).rgb;
    
    // Clamp history to current neighborhood
    history = neighborhoodClamp(vUv, history);
    
    // Blend with history
    float blendWeight = historyWeight;
    
    // Reduce blending at screen edges
    vec2 screenEdge = abs(prevUV * 2.0 - 1.0);
    blendWeight *= 1.0 - max(screenEdge.x, screenEdge.y);
    blendWeight = max(0.0, blendWeight);
    
    vec3 result = mix(currentSSGI, history, blendWeight);
    
    // Clamp to prevent fireflies
    result = clamp(result, vec3(0.0), vec3(2.0));
    
    gl_FragColor = vec4(result, 1.0);
  }
`;

export function createSSGIUniforms(params: {
  depthTexture: THREE.Texture;
  normalTexture: THREE.Texture;
  albedoTexture: THREE.Texture;
  directTexture: THREE.Texture;
  historyTexture: THREE.Texture;
  camera: THREE.PerspectiveCamera;
  resolution: THREE.Vector2;
  rayLength?: number;
  numRays?: number;
  raySteps?: number;
  historyWeight?: number;
}): Record<string, THREE.IUniform> {
  const {
    depthTexture,
    normalTexture,
    albedoTexture,
    directTexture,
    historyTexture,
    camera,
    resolution,
    rayLength = 2.5,
    numRays = 8,
    raySteps = 24,
    historyWeight = 0.9,
  } = params;
  
  return {
    tDepth: { value: depthTexture },
    tNormal: { value: normalTexture },
    tAlbedo: { value: albedoTexture },
    tDirect: { value: directTexture },
    tHistory: { value: historyTexture },
    tNoise: { value: null },
    projMatrix: { value: camera.projectionMatrix },
    invProjMatrix: { value: camera.projectionMatrixInverse },
    viewMatrix: { value: camera.matrixWorldInverse },
    invViewMatrix: { value: camera.matrixWorld },
    prevViewProjMatrix: { value: new THREE.Matrix4() },
    resolution: { value: resolution },
    rayLength: { value: rayLength },
    numRays: { value: numRays },
    raySteps: { value: raySteps },
    historyWeight: { value: historyWeight },
    time: { value: 0 },
    near: { value: camera.near },
    far: { value: camera.far },
  };
}

export function createSSGIMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SSGIVertexShader,
    fragmentShader: SSGIFragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}
