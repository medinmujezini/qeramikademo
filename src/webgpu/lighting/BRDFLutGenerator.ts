import * as THREE from 'three';

/**
 * BRDF LUT Generator
 * 
 * Generates a 2D lookup table for the split-sum approximation of the BRDF integral.
 * Used for IBL (Image-Based Lighting) with PBR materials.
 * 
 * X-axis: NdotV (0 to 1)
 * Y-axis: Roughness (0 to 1)
 * Output: R = scale, G = bias for F0 * scale + bias
 */

const BRDFIntegratorVertexShader = /* glsl */ `
  out vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRDFIntegratorFragmentShader = /* glsl */ `
  precision highp float;
  
  in vec2 vUv;
  out vec4 fragColor;
  
  const float PI = 3.14159265359;
  const uint SAMPLE_COUNT = 1024u;
  
  // Van der Corput radical inverse
  float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10;
  }
  
  vec2 Hammersley(uint i, uint N) {
    return vec2(float(i) / float(N), RadicalInverse_VdC(i));
  }
  
  vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
    float a = roughness * roughness;
    
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    
    // From spherical to cartesian
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;
    
    // From tangent-space to world-space
    vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);
    
    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
  }
  
  float GeometrySchlickGGX(float NdotV, float roughness) {
    float a = roughness;
    float k = (a * a) / 2.0;
    
    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return nom / denom;
  }
  
  float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
  }
  
  vec2 IntegrateBRDF(float NdotV, float roughness) {
    vec3 V;
    V.x = sqrt(1.0 - NdotV * NdotV);
    V.y = 0.0;
    V.z = NdotV;
    
    float A = 0.0;
    float B = 0.0;
    
    vec3 N = vec3(0.0, 0.0, 1.0);
    
    for (uint i = 0u; i < SAMPLE_COUNT; i++) {
      vec2 Xi = Hammersley(i, SAMPLE_COUNT);
      vec3 H = ImportanceSampleGGX(Xi, N, roughness);
      vec3 L = normalize(2.0 * dot(V, H) * H - V);
      
      float NdotL = max(L.z, 0.0);
      float NdotH = max(H.z, 0.0);
      float VdotH = max(dot(V, H), 0.0);
      
      if (NdotL > 0.0) {
        float G = GeometrySmith(N, V, L, roughness);
        float G_Vis = (G * VdotH) / (NdotH * NdotV);
        float Fc = pow(1.0 - VdotH, 5.0);
        
        A += (1.0 - Fc) * G_Vis;
        B += Fc * G_Vis;
      }
    }
    
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    
    return vec2(A, B);
  }
  
  void main() {
    vec2 integratedBRDF = IntegrateBRDF(vUv.x, vUv.y);
    fragColor = vec4(integratedBRDF, 0.0, 1.0);
  }
`;

// Fallback for WebGL1 without bitwise operations
const BRDFIntegratorFragmentShaderFallback = /* glsl */ `
  precision highp float;
  
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  const int SAMPLE_COUNT = 256;
  
  // Simple pseudo-random based on golden ratio
  float VanDerCorput(int n, int base) {
    float invBase = 1.0 / float(base);
    float denom = 1.0;
    float result = 0.0;
    
    for (int i = 0; i < 32; i++) {
      if (n <= 0) break;
      denom = denom * float(base);
      int remainder = n - (n / base) * base;
      result += float(remainder) / denom;
      n = n / base;
    }
    
    return result;
  }
  
  vec2 Hammersley(int i, int N) {
    return vec2(float(i) / float(N), VanDerCorput(i, 2));
  }
  
  vec3 ImportanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
    float a = roughness * roughness;
    
    float phi = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    
    vec3 H;
    H.x = cos(phi) * sinTheta;
    H.y = sin(phi) * sinTheta;
    H.z = cosTheta;
    
    vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 tangent = normalize(cross(up, N));
    vec3 bitangent = cross(N, tangent);
    
    vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
    return normalize(sampleVec);
  }
  
  float GeometrySchlickGGX(float NdotV, float roughness) {
    float a = roughness;
    float k = (a * a) / 2.0;
    return NdotV / (NdotV * (1.0 - k) + k);
  }
  
  float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
  }
  
  vec2 IntegrateBRDF(float NdotV, float roughness) {
    vec3 V;
    V.x = sqrt(1.0 - NdotV * NdotV);
    V.y = 0.0;
    V.z = NdotV;
    
    float A = 0.0;
    float B = 0.0;
    
    vec3 N = vec3(0.0, 0.0, 1.0);
    
    for (int i = 0; i < SAMPLE_COUNT; i++) {
      vec2 Xi = Hammersley(i, SAMPLE_COUNT);
      vec3 H = ImportanceSampleGGX(Xi, N, roughness);
      vec3 L = normalize(2.0 * dot(V, H) * H - V);
      
      float NdotL = max(L.z, 0.0);
      float NdotH = max(H.z, 0.0);
      float VdotH = max(dot(V, H), 0.0);
      
      if (NdotL > 0.0) {
        float G = GeometrySmith(N, V, L, roughness);
        float G_Vis = (G * VdotH) / (NdotH * NdotV);
        float Fc = pow(1.0 - VdotH, 5.0);
        
        A += (1.0 - Fc) * G_Vis;
        B += Fc * G_Vis;
      }
    }
    
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    
    return vec2(A, B);
  }
  
  void main() {
    vec2 integratedBRDF = IntegrateBRDF(vUv.x, vUv.y);
    gl_FragColor = vec4(integratedBRDF, 0.0, 1.0);
  }
`;

export class BRDFLutGenerator {
  private static instance: THREE.Texture | null = null;
  
  /**
   * Generate or return cached BRDF LUT
   */
  static generate(renderer: THREE.WebGLRenderer, size: number = 512): THREE.Texture {
    if (BRDFLutGenerator.instance) {
      return BRDFLutGenerator.instance;
    }
    
    // Check WebGL2 support
    const isWebGL2 = renderer.capabilities.isWebGL2;
    
    const renderTarget = new THREE.WebGLRenderTarget(size, size, {
      format: THREE.RGFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    
    const material = new THREE.ShaderMaterial({
      vertexShader: BRDFIntegratorVertexShader,
      fragmentShader: isWebGL2 
        ? BRDFIntegratorFragmentShader 
        : BRDFIntegratorFragmentShaderFallback,
      depthTest: false,
      depthWrite: false,
    });
    
    // Use GLSL3 for WebGL2 to get uint support
    if (isWebGL2) {
      material.glslVersion = THREE.GLSL3;
    }
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    const scene = new THREE.Scene();
    scene.add(mesh);
    
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const currentRenderTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(currentRenderTarget);
    
    // Cleanup
    geometry.dispose();
    material.dispose();
    
    BRDFLutGenerator.instance = renderTarget.texture;
    return renderTarget.texture;
  }
  
  /**
   * Clear cached LUT
   */
  static dispose(): void {
    if (BRDFLutGenerator.instance) {
      BRDFLutGenerator.instance = null;
    }
  }
}

export default BRDFLutGenerator;
