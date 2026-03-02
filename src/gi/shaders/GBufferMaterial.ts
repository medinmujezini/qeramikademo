import * as THREE from 'three';

/**
 * G-Buffer Material for deferred rendering
 * Outputs to multiple render targets:
 * - RT0: Packed normals (RG) + roughness (B) + metalness (A)
 * - RT1: Albedo (RGB) + ambient occlusion (A)
 * - RT2: Linear depth
 */

export const GBufferVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDepth;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    
    vec4 viewPos = viewMatrix * worldPos;
    vDepth = -viewPos.z;  // Linear depth (positive going away from camera)
    
    gl_Position = projectionMatrix * viewPos;
  }
`;

export const GBufferFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform vec3 uAlbedo;
  uniform float uRoughness;
  uniform float uMetalness;
  uniform float uAO;
  uniform sampler2D uAlbedoMap;
  uniform bool uHasAlbedoMap;
  uniform float uNear;
  uniform float uFar;
  
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDepth;
  
  // Pack normal to octahedral representation
  vec2 encodeNormal(vec3 n) {
    n = normalize(n);
    float sum = abs(n.x) + abs(n.y) + abs(n.z);
    n.xy = n.z >= 0.0 ? n.xy / sum : (1.0 - abs(n.yx)) * sign(n.xy);
    return n.xy * 0.5 + 0.5;
  }
  
  // Linearize depth
  float linearizeDepth(float depth) {
    return (depth - uNear) / (uFar - uNear);
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    
    // Get albedo
    vec3 albedo = uAlbedo;
    if (uHasAlbedoMap) {
      albedo *= texture2D(uAlbedoMap, vUv).rgb;
    }
    
    // Pack outputs
    vec2 encodedNormal = encodeNormal(normal);
    float linearDepth = linearizeDepth(vDepth);
    
    // Output to multiple render targets (using gl_FragData for WebGL1 compatibility)
    // In WebGL2, we'd use layout(location = X) out
    gl_FragColor = vec4(
      encodedNormal.x,
      encodedNormal.y,
      uRoughness,
      uMetalness
    );
    
    // Note: For MRT in Three.js, we need to use WebGLMultipleRenderTargets
    // This single output version is a fallback
  }
`;

// Extended version with MRT support for WebGL2
export const GBufferFragmentShaderMRT = /* glsl */ `
  precision highp float;
  
  layout(location = 0) out vec4 gNormalRoughMetal;
  layout(location = 1) out vec4 gAlbedoAO;
  layout(location = 2) out vec4 gDepth;
  
  uniform vec3 uAlbedo;
  uniform float uRoughness;
  uniform float uMetalness;
  uniform float uAO;
  uniform sampler2D uAlbedoMap;
  uniform bool uHasAlbedoMap;
  uniform float uNear;
  uniform float uFar;
  
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  varying float vDepth;
  
  vec2 encodeNormal(vec3 n) {
    n = normalize(n);
    float sum = abs(n.x) + abs(n.y) + abs(n.z);
    n.xy = n.z >= 0.0 ? n.xy / sum : (1.0 - abs(n.yx)) * sign(n.xy);
    return n.xy * 0.5 + 0.5;
  }
  
  float linearizeDepth(float depth) {
    return (depth - uNear) / (uFar - uNear);
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    
    vec3 albedo = uAlbedo;
    if (uHasAlbedoMap) {
      albedo *= texture2D(uAlbedoMap, vUv).rgb;
    }
    
    vec2 encodedNormal = encodeNormal(normal);
    float linearDepth = linearizeDepth(vDepth);
    
    gNormalRoughMetal = vec4(encodedNormal, uRoughness, uMetalness);
    gAlbedoAO = vec4(albedo, uAO);
    gDepth = vec4(linearDepth, vDepth, 0.0, 1.0);
  }
`;

export function createGBufferMaterial(params: {
  albedo?: THREE.Color;
  roughness?: number;
  metalness?: number;
  ao?: number;
  albedoMap?: THREE.Texture | null;
  near?: number;
  far?: number;
}): THREE.ShaderMaterial {
  const {
    albedo = new THREE.Color(0.8, 0.8, 0.8),
    roughness = 0.5,
    metalness = 0.0,
    ao = 1.0,
    albedoMap = null,
    near = 0.1,
    far = 100,
  } = params;
  
  return new THREE.ShaderMaterial({
    vertexShader: GBufferVertexShader,
    fragmentShader: GBufferFragmentShader,
    uniforms: {
      uAlbedo: { value: albedo },
      uRoughness: { value: roughness },
      uMetalness: { value: metalness },
      uAO: { value: ao },
      uAlbedoMap: { value: albedoMap },
      uHasAlbedoMap: { value: albedoMap !== null },
      uNear: { value: near },
      uFar: { value: far },
    },
    side: THREE.DoubleSide,
  });
}

// Create a material that can be used with MRT
export function createGBufferMaterialMRT(params: {
  albedo?: THREE.Color;
  roughness?: number;
  metalness?: number;
  ao?: number;
  near?: number;
  far?: number;
}): THREE.ShaderMaterial {
  const material = createGBufferMaterial(params);
  material.fragmentShader = GBufferFragmentShaderMRT;
  material.glslVersion = THREE.GLSL3;
  return material;
}
