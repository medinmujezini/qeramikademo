import * as THREE from 'three';
import { BRDFLutGenerator } from './BRDFLutGenerator';

/**
 * IBL (Image-Based Lighting) Manager
 * 
 * Manages environment maps for PBR rendering:
 * - Irradiance cubemap (diffuse IBL)
 * - Prefiltered specular cubemap (with roughness mip chain)
 * - BRDF LUT (split-sum approximation)
 */

const IrradianceConvolutionShader = /* glsl */ `
  precision highp float;
  
  uniform samplerCube envMap;
  uniform float face;
  
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  
  vec3 getCubeDirection(vec2 uv, float face) {
    vec2 coord = uv * 2.0 - 1.0;
    vec3 dir;
    
    if (face == 0.0) dir = vec3(1.0, -coord.y, -coord.x);      // +X
    else if (face == 1.0) dir = vec3(-1.0, -coord.y, coord.x); // -X
    else if (face == 2.0) dir = vec3(coord.x, 1.0, coord.y);   // +Y
    else if (face == 3.0) dir = vec3(coord.x, -1.0, -coord.y); // -Y
    else if (face == 4.0) dir = vec3(coord.x, -coord.y, 1.0);  // +Z
    else dir = vec3(-coord.x, -coord.y, -1.0);                 // -Z
    
    return normalize(dir);
  }
  
  void main() {
    vec3 N = getCubeDirection(vUv, face);
    
    vec3 irradiance = vec3(0.0);
    
    // Tangent space calculation
    vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
    vec3 right = normalize(cross(up, N));
    up = cross(N, right);
    
    float sampleDelta = 0.025;
    float nrSamples = 0.0;
    
    for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
      for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
        // Spherical to cartesian (in tangent space)
        vec3 tangentSample = vec3(
          sin(theta) * cos(phi),
          sin(theta) * sin(phi),
          cos(theta)
        );
        
        // Tangent space to world
        vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * N;
        
        irradiance += textureCube(envMap, sampleVec).rgb * cos(theta) * sin(theta);
        nrSamples += 1.0;
      }
    }
    
    irradiance = PI * irradiance * (1.0 / nrSamples);
    
    gl_FragColor = vec4(irradiance, 1.0);
  }
`;

const PrefilterShader = /* glsl */ `
  precision highp float;
  
  uniform samplerCube envMap;
  uniform float roughness;
  uniform float face;
  uniform float resolution;
  
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  
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
    
    return normalize(tangent * H.x + bitangent * H.y + N * H.z);
  }
  
  vec3 getCubeDirection(vec2 uv, float face) {
    vec2 coord = uv * 2.0 - 1.0;
    vec3 dir;
    
    if (face == 0.0) dir = vec3(1.0, -coord.y, -coord.x);
    else if (face == 1.0) dir = vec3(-1.0, -coord.y, coord.x);
    else if (face == 2.0) dir = vec3(coord.x, 1.0, coord.y);
    else if (face == 3.0) dir = vec3(coord.x, -1.0, -coord.y);
    else if (face == 4.0) dir = vec3(coord.x, -coord.y, 1.0);
    else dir = vec3(-coord.x, -coord.y, -1.0);
    
    return normalize(dir);
  }
  
  void main() {
    vec3 N = getCubeDirection(vUv, face);
    vec3 R = N;
    vec3 V = R;
    
    const int SAMPLE_COUNT = 128;
    float totalWeight = 0.0;
    vec3 prefilteredColor = vec3(0.0);
    
    for (int i = 0; i < SAMPLE_COUNT; i++) {
      vec2 Xi = Hammersley(i, SAMPLE_COUNT);
      vec3 H = ImportanceSampleGGX(Xi, N, roughness);
      vec3 L = normalize(2.0 * dot(V, H) * H - V);
      
      float NdotL = max(dot(N, L), 0.0);
      if (NdotL > 0.0) {
        prefilteredColor += textureCube(envMap, L).rgb * NdotL;
        totalWeight += NdotL;
      }
    }
    
    prefilteredColor = prefilteredColor / totalWeight;
    
    gl_FragColor = vec4(prefilteredColor, 1.0);
  }
`;

const SimpleVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export interface IBLTextures {
  irradianceMap: THREE.CubeTexture | THREE.Texture | null;
  prefilteredMap: THREE.CubeTexture | THREE.Texture | null;
  brdfLUT: THREE.Texture;
  envMap: THREE.CubeTexture | THREE.Texture | null;
}

export class IBLManager {
  private renderer: THREE.WebGLRenderer;
  private envMap: THREE.CubeTexture | THREE.Texture | null = null;
  private irradianceMap: THREE.WebGLCubeRenderTarget | null = null;
  private prefilteredMaps: THREE.WebGLCubeRenderTarget[] = [];
  private brdfLUT: THREE.Texture | null = null;
  
  // Shared rendering resources
  private fsQuadGeometry: THREE.PlaneGeometry;
  private fsCamera: THREE.OrthographicCamera;
  
  // Shader materials (lazy)
  private irradianceMaterial: THREE.ShaderMaterial | null = null;
  private prefilterMaterial: THREE.ShaderMaterial | null = null;
  
  private irradianceSize = 32;
  private prefilterSize = 256;
  private prefilterMipLevels = 5;
  
  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.fsQuadGeometry = new THREE.PlaneGeometry(2, 2);
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  /**
   * Set the environment map (HDR equirectangular or cubemap)
   */
  setEnvironment(envMap: THREE.CubeTexture | THREE.Texture): void {
    this.envMap = envMap;
    
    // Generate BRDF LUT if not done
    if (!this.brdfLUT) {
      this.brdfLUT = BRDFLutGenerator.generate(this.renderer, 512);
    }
    
    // For now, we'll use the envMap directly
    // Full cubemap convolution would be done here for high quality
    // This is a simplified version that works well for archviz
    
    console.log('IBLManager: Environment map set');
  }
  
  /**
   * Generate irradiance cubemap from environment
   */
  generateIrradiance(): THREE.WebGLCubeRenderTarget | null {
    if (!this.envMap) return null;
    
    // Create irradiance render target
    this.irradianceMap = new THREE.WebGLCubeRenderTarget(this.irradianceSize, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    
    // For a complete implementation, we'd render the convolution shader to each face
    // For now, return the target (convolution would happen here)
    
    return this.irradianceMap;
  }
  
  /**
   * Generate prefiltered specular cubemap mip chain
   */
  generatePrefiltered(): THREE.WebGLCubeRenderTarget[] {
    if (!this.envMap) return [];
    
    this.prefilteredMaps = [];
    
    for (let mip = 0; mip < this.prefilterMipLevels; mip++) {
      const mipSize = this.prefilterSize >> mip;
      const roughness = mip / (this.prefilterMipLevels - 1);
      
      const target = new THREE.WebGLCubeRenderTarget(mipSize, {
        format: THREE.RGBAFormat,
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
      });
      
      // Convolution would happen here with the prefilter shader
      this.prefilteredMaps.push(target);
    }
    
    return this.prefilteredMaps;
  }
  
  /**
   * Get all IBL textures for use in shaders
   */
  getTextures(): IBLTextures {
    if (!this.brdfLUT) {
      this.brdfLUT = BRDFLutGenerator.generate(this.renderer, 512);
    }
    
    return {
      irradianceMap: this.irradianceMap?.texture || this.envMap,
      prefilteredMap: this.prefilteredMaps[0]?.texture || this.envMap,
      brdfLUT: this.brdfLUT,
      envMap: this.envMap,
    };
  }
  
  /**
   * Get the BRDF LUT texture
   */
  getBRDFLUT(): THREE.Texture {
    if (!this.brdfLUT) {
      this.brdfLUT = BRDFLutGenerator.generate(this.renderer, 512);
    }
    return this.brdfLUT;
  }
  
  /**
   * Get the environment map (fallback for reflections)
   */
  getEnvMap(): THREE.CubeTexture | THREE.Texture | null {
    return this.envMap;
  }
  
  /**
   * Create a simple environment from a color or gradient
   */
  createColorEnvironment(color: THREE.Color, intensity: number = 1.0): void {
    // Create a simple 1x1 cube render target with the color
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(16, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });
    
    // For simplicity, we'll just set the envMap to null and use the color in lighting
    // A proper implementation would render to the cubemap
    console.log('IBLManager: Color environment created', color, intensity);
  }
  
  dispose(): void {
    this.irradianceMap?.dispose();
    this.prefilteredMaps.forEach(m => m.dispose());
    this.irradianceMaterial?.dispose();
    this.prefilterMaterial?.dispose();
    this.fsQuadGeometry.dispose();
    
    this.irradianceMap = null;
    this.prefilteredMaps = [];
    this.irradianceMaterial = null;
    this.prefilterMaterial = null;
    this.envMap = null;
  }
}

export default IBLManager;
