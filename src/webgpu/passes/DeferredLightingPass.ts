import * as THREE from 'three';
import { RenderPassConfig } from '../core/RenderGraph';
import { IBLManager } from '../lighting/IBLManager';

/**
 * Deferred Lighting Pass
 * 
 * Ultra-simple shadow sampling + verified PBR functions from Brandon Jones.
 * Calculates direct and indirect lighting using G-Buffer textures.
 */

const DeferredLightingVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const DeferredLightingFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform sampler2D gAlbedoRoughness;
  uniform sampler2D gNormalMetalAO;
  uniform sampler2D gEmissiveFlags;
  uniform sampler2D gDepth;
  uniform sampler2D ssaoTexture;
  uniform sampler2D brdfLUT;
  uniform samplerCube envMap;
  uniform samplerCube prefilteredEnvMap;
  
  // Shadow uniforms - soft shadows
  uniform sampler2D shadowDepthTexture;
  uniform mat4 shadowMatrix;          // World -> Shadow NDC (not including [0,1] bias)
  uniform float shadowMapSize;
  uniform float shadowBias;
  uniform float shadowSoftness;       // Soft shadow blur radius
  uniform float shadowIntensity;      // Shadow darkness control (1.0 = normal, >1 = darker)
  uniform float shadowDarkness;       // Minimum shadow level (0 = pitch black, 0.5 = lighter)
  uniform bool shadowsEnabled;
  
  uniform mat4 inverseViewMatrix;
  uniform mat4 inverseProjectionMatrix;
  uniform vec3 uCameraPos;
  
  uniform vec3 lightDirection;
  uniform vec3 lightColor;
  uniform float lightIntensity;
  
  uniform vec3 ambientColor;
  uniform float ambientIntensity;
  
  uniform float envMapIntensity;
  uniform bool hasEnvMap;
  
  uniform int uDebugMode;
  
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  
  // === Verified PBR Functions from Brandon Jones ===
  // Source: https://github.com/toji/webgpu-clustered-shading
  
  vec3 FresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (vec3(1.0) - F0) * pow(1.0 - cosTheta, 5.0);
  }
  
  float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    
    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    
    return num / (PI * denom * denom);
  }
  
  float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    
    float num = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return num / denom;
  }
  
  float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
  }
  
  vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }
  
  // === Octahedral Normal Decoding ===
  vec3 decodeNormal(vec2 enc) {
    enc = enc * 2.0 - 1.0;
    vec3 n = vec3(enc.xy, 1.0 - abs(enc.x) - abs(enc.y));
    float t = max(-n.z, 0.0);
    n.x += n.x >= 0.0 ? -t : t;
    n.y += n.y >= 0.0 ? -t : t;
    return normalize(n);
  }
  
  // === World Position Reconstruction ===
  vec3 reconstructWorldPosition(vec2 uv, float depth) {
    vec4 ndcPos = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = inverseProjectionMatrix * ndcPos;
    viewPos /= viewPos.w;
    vec4 worldPos = inverseViewMatrix * vec4(viewPos.xyz, 1.0);
    return worldPos.xyz;
  }
  
  // === Ultra-Simple Shadow Sampling ===
  float sampleShadow(vec3 worldPos) {
    if (!shadowsEnabled) return 1.0;
    
    // Transform world pos to shadow NDC
    vec4 shadowPos = shadowMatrix * vec4(worldPos, 1.0);
    vec3 shadowNDC = shadowPos.xyz / shadowPos.w;
    
    // NDC is [-1,1], convert to [0,1] for texture lookup
    vec2 shadowUV = shadowNDC.xy * 0.5 + 0.5;
    float shadowZ = shadowNDC.z * 0.5 + 0.5;
    
    // Check if outside shadow frustum
    if (shadowUV.x < 0.0 || shadowUV.x > 1.0 || 
        shadowUV.y < 0.0 || shadowUV.y > 1.0 ||
        shadowZ < 0.0 || shadowZ > 1.0) {
      return 1.0; // Outside = lit
    }
    
    // Sample depth texture directly
    float closestDepth = texture2D(shadowDepthTexture, shadowUV).r;
    
    // Simple comparison: in shadow if receiver is further than closest
    float shadow = (shadowZ > closestDepth + shadowBias) ? 0.3 : 1.0;
    
    return shadow;
  }
  
  // High-quality soft shadow sampling with rotated disk PCF
  float sampleShadowPCF(vec3 worldPos, vec3 normal) {
    if (!shadowsEnabled) return 1.0;
    
    // Back-face culling for shadows: surfaces facing away from light
    // should be in shadow, not sampling the shadow map
    vec3 L = normalize(-lightDirection);
    float NdotL_shadow = dot(normal, L);
    if (NdotL_shadow <= 0.0) {
      // Surface faces away from light - always in shadow
      return mix(0.0, 1.0, shadowDarkness);
    }
    
    vec4 shadowPos = shadowMatrix * vec4(worldPos, 1.0);
    vec3 shadowNDC = shadowPos.xyz / shadowPos.w;
    vec2 shadowUV = shadowNDC.xy * 0.5 + 0.5;
    float shadowZ = shadowNDC.z * 0.5 + 0.5;
    
    if (shadowUV.x < 0.0 || shadowUV.x > 1.0 || 
        shadowUV.y < 0.0 || shadowUV.y > 1.0 ||
        shadowZ < 0.0 || shadowZ > 1.0) {
      return 1.0;
    }
    
    float texelSize = shadowSoftness / shadowMapSize;
    float shadow = 0.0;
    
    // 16-sample rotated disk PCF for very soft shadows
    const int SAMPLES = 16;
    vec2 poissonDisk[16];
    poissonDisk[0] = vec2(-0.94201624, -0.39906216);
    poissonDisk[1] = vec2(0.94558609, -0.76890725);
    poissonDisk[2] = vec2(-0.094184101, -0.92938870);
    poissonDisk[3] = vec2(0.34495938, 0.29387760);
    poissonDisk[4] = vec2(-0.91588581, 0.45771432);
    poissonDisk[5] = vec2(-0.81544232, -0.87912464);
    poissonDisk[6] = vec2(-0.38277543, 0.27676845);
    poissonDisk[7] = vec2(0.97484398, 0.75648379);
    poissonDisk[8] = vec2(0.44323325, -0.97511554);
    poissonDisk[9] = vec2(0.53742981, -0.47373420);
    poissonDisk[10] = vec2(-0.26496911, -0.41893023);
    poissonDisk[11] = vec2(0.79197514, 0.19090188);
    poissonDisk[12] = vec2(-0.24188840, 0.99706507);
    poissonDisk[13] = vec2(-0.81409955, 0.91437590);
    poissonDisk[14] = vec2(0.19984126, 0.78641367);
    poissonDisk[15] = vec2(0.14383161, -0.14100790);
    
    // Random rotation based on screen position for noise reduction
    float angle = fract(sin(dot(vUv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453) * 6.283185;
    float s = sin(angle);
    float c = cos(angle);
    mat2 rotation = mat2(c, -s, s, c);
    
    for (int i = 0; i < SAMPLES; i++) {
      vec2 offset = rotation * poissonDisk[i] * texelSize;
      float closestDepth = texture2D(shadowDepthTexture, shadowUV + offset).r;
      shadow += (shadowZ > closestDepth + shadowBias) ? 0.0 : 1.0;
    }
    
    // Normalize shadow value
    float shadowValue = shadow / float(SAMPLES);
    
    // Apply shadow intensity - pow makes shadows darker when intensity > 1
    shadowValue = pow(shadowValue, shadowIntensity);
    
    // Remap shadow using shadowDarkness
    // shadowDarkness = 0: full shadows (pitch black when occluded)
    // shadowDarkness = 1: no shadows at all (always fully lit)
    return mix(shadowValue, 1.0, shadowDarkness);
  }
  
  void main() {
    // Sample G-Buffer
    vec4 albedoRoughness = texture2D(gAlbedoRoughness, vUv);
    vec4 normalMetalAO = texture2D(gNormalMetalAO, vUv);
    vec4 emissiveFlags = texture2D(gEmissiveFlags, vUv);
    vec4 depthData = texture2D(gDepth, vUv);
    float ssao = texture2D(ssaoTexture, vUv).r;
    
    vec3 albedo = albedoRoughness.rgb;
    float roughness = clamp(albedoRoughness.a, 0.04, 1.0);
    
    vec3 normal = decodeNormal(normalMetalAO.rg);
    float metalness = normalMetalAO.b;
    float ao = normalMetalAO.a;
    
    vec3 emissive = emissiveFlags.rgb;
    
    float depth = depthData.g;
    
    // Early out for sky
    if (depth >= 0.9999) {
      gl_FragColor = vec4(0.1, 0.1, 0.15, 1.0);
      return;
    }
    
    // Reconstruct world position
    vec3 worldPos = reconstructWorldPosition(vUv, depth);
    
    vec3 V = normalize(uCameraPos - worldPos);
    vec3 N = normal;
    vec3 L = normalize(-lightDirection);
    vec3 H = normalize(V + L);
    vec3 R = reflect(-V, N);
    
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    
    float combinedAO = ao * clamp(ssao, 0.0, 1.0);
    
    // Get shadow coords for debug modes
    vec4 shadowPos = shadowMatrix * vec4(worldPos, 1.0);
    vec3 shadowNDC = shadowPos.xyz / shadowPos.w;
    vec2 shadowUV = shadowNDC.xy * 0.5 + 0.5;
    float shadowZ = shadowNDC.z * 0.5 + 0.5;
    
    // === DEBUG MODES ===
    
    // Basic debug modes (1-14)
    if (uDebugMode == 1) {
      gl_FragColor = vec4(albedo, 1.0);
      return;
    }
    if (uDebugMode == 2) {
      gl_FragColor = vec4(N * 0.5 + 0.5, 1.0);
      return;
    }
    if (uDebugMode == 3) {
      gl_FragColor = vec4(vec3(depth), 1.0);
      return;
    }
    if (uDebugMode == 4) {
      gl_FragColor = vec4(vec3(ssao), 1.0);
      return;
    }
    if (uDebugMode == 5) {
      gl_FragColor = vec4(vec3(NdotL), 1.0);
      return;
    }
    if (uDebugMode == 12) {
      vec3 wp = worldPos * 0.1;
      gl_FragColor = vec4(fract(abs(wp)), 1.0);
      return;
    }
    if (uDebugMode == 13) {
      gl_FragColor = vec4(vec3(roughness), 1.0);
      return;
    }
    if (uDebugMode == 14) {
      gl_FragColor = vec4(vec3(metalness), 1.0);
      return;
    }
    
    // === NEW SHADOW DEBUG MODES (30-32) ===
    
    // Debug 30: Show shadow UV as red/green gradient
    if (uDebugMode == 30) {
      gl_FragColor = vec4(shadowUV.x, shadowUV.y, 0.0, 1.0);
      return;
    }
    
    // Debug 31: Show shadow depth texture (sampled at shadow UV)
    if (uDebugMode == 31) {
      if (shadowUV.x >= 0.0 && shadowUV.x <= 1.0 && shadowUV.y >= 0.0 && shadowUV.y <= 1.0) {
        float closestDepth = texture2D(shadowDepthTexture, shadowUV).r;
        gl_FragColor = vec4(vec3(closestDepth), 1.0);
      } else {
        gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); // Magenta = out of bounds
      }
      return;
    }
    
    // Debug 32: Show shadow comparison result
    if (uDebugMode == 32) {
      float shadow = sampleShadow(worldPos);
      gl_FragColor = vec4(vec3(shadow), 1.0);
      return;
    }
    
    // Debug 15: Final shadow with PCF
    if (uDebugMode == 15) {
      float shadow = sampleShadowPCF(worldPos, N);
      gl_FragColor = vec4(vec3(shadow), 1.0);
      return;
    }
    
    // === PBR LIGHTING (using verified Brandon Jones functions) ===
    
    vec3 F0 = mix(vec3(0.04), albedo, metalness);
    
    // Sample shadow
    float shadow = sampleShadowPCF(worldPos, N);
    
    // Cook-Torrance BRDF
    float D = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = FresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 numerator = D * G * F;
    float denominator = max(4.0 * NdotV * NdotL, 0.001);
    vec3 specular = numerator / denominator;
    
    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metalness);
    
    // Direct lighting with shadow
    vec3 directLight = (kD * albedo / PI + specular) * lightColor * lightIntensity * NdotL * shadow;
    
    // Debug 9: direct light only
    if (uDebugMode == 9) {
      gl_FragColor = vec4(directLight, 1.0);
      return;
    }
    
    // === Ambient / IBL ===
    vec3 ambient;
    
    if (hasEnvMap) {
      vec3 irradiance = textureCube(envMap, N).rgb;
      vec3 diffuseIBL = irradiance * albedo;
      
      float mipLevel = roughness * 4.0;
      vec3 prefilteredColor = textureCube(prefilteredEnvMap, R).rgb;
      vec2 brdf = texture2D(brdfLUT, vec2(NdotV, roughness)).rg;
      vec3 specularIBL = prefilteredColor * (F0 * brdf.x + brdf.y);
      
      vec3 kSEnv = fresnelSchlickRoughness(NdotV, F0, roughness);
      vec3 kDEnv = (vec3(1.0) - kSEnv) * (1.0 - metalness);
      
      ambient = (kDEnv * diffuseIBL + specularIBL) * envMapIntensity;
    } else {
      ambient = ambientColor * ambientIntensity * albedo;
    }
    
    // Debug 10: ambient only
    if (uDebugMode == 10) {
      gl_FragColor = vec4(ambient * combinedAO, 1.0);
      return;
    }
    
    // Debug 11: emissive only
    if (uDebugMode == 11) {
      gl_FragColor = vec4(emissive, 1.0);
      return;
    }
    
    // Final color
    // Apply shadow to ambient based on shadowDarkness:
    // shadowDarkness = 0: ambient is fully affected by shadow (pitch black in shadow)
    // shadowDarkness = 1: ambient is not affected by shadow at all
    float ambientShadowFactor = mix(shadow, 1.0, shadowDarkness);
    vec3 color = directLight + ambient * combinedAO * ambientShadowFactor + emissive;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

export interface DeferredLightingConfig {
  lightDirection: THREE.Vector3;
  lightColor: THREE.Color;
  lightIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  iblIntensity: number;
}

export class DeferredLightingEffect {
  private material: THREE.ShaderMaterial;
  private renderTarget: THREE.WebGLRenderTarget;
  private fsQuad: THREE.Mesh;
  private fsScene: THREE.Scene;
  private fsCamera: THREE.OrthographicCamera;
  
  private config: DeferredLightingConfig;
  private debugMode: number = 0;
  
  constructor(width: number, height: number, config?: Partial<DeferredLightingConfig>) {
    this.config = {
      lightDirection: config?.lightDirection ?? new THREE.Vector3(-0.5, -1, -0.3).normalize(),
      lightColor: config?.lightColor ?? new THREE.Color(1, 0.98, 0.95),
      lightIntensity: config?.lightIntensity ?? 3.0,
      ambientColor: config?.ambientColor ?? new THREE.Color(0.7, 0.75, 0.85),
      ambientIntensity: config?.ambientIntensity ?? 1.2,
      iblIntensity: config?.iblIntensity ?? 1.0,
    };
    
    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    
    this.material = new THREE.ShaderMaterial({
      vertexShader: DeferredLightingVertexShader,
      fragmentShader: DeferredLightingFragmentShader,
      uniforms: {
        gAlbedoRoughness: { value: null },
        gNormalMetalAO: { value: null },
        gEmissiveFlags: { value: null },
        gDepth: { value: null },
        ssaoTexture: { value: null },
        brdfLUT: { value: null },
        envMap: { value: null },
        prefilteredEnvMap: { value: null },
        hasEnvMap: { value: false },
        
        // Shadow uniforms - soft shadows
        shadowDepthTexture: { value: null },
        shadowMatrix: { value: new THREE.Matrix4() },
        shadowMapSize: { value: 2048 },
        shadowBias: { value: 0.003 },
        shadowSoftness: { value: 2.0 },
        shadowIntensity: { value: 1.0 },
        shadowDarkness: { value: 0.15 },
        shadowsEnabled: { value: true },
        
        inverseViewMatrix: { value: new THREE.Matrix4() },
        inverseProjectionMatrix: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        
        lightDirection: { value: this.config.lightDirection.clone() },
        lightColor: { value: this.config.lightColor.clone() },
        lightIntensity: { value: this.config.lightIntensity },
        
        ambientColor: { value: this.config.ambientColor.clone() },
        ambientIntensity: { value: this.config.ambientIntensity },
        envMapIntensity: { value: this.config.iblIntensity },
        
        uDebugMode: { value: 0 },
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
  
  setDebugMode(mode: number): void {
    if (this.debugMode !== mode) {
      console.log('[DeferredLighting] setDebugMode:', mode);
    }
    this.debugMode = mode;
    this.material.uniforms.uDebugMode.value = mode;
  }
  
  getDebugMode(): number {
    return this.debugMode;
  }
  
  updateCamera(camera: THREE.PerspectiveCamera): void {
    const inverseView = camera.matrixWorld.clone();
    const inverseProj = camera.projectionMatrixInverse.clone();
    
    this.material.uniforms.inverseViewMatrix.value.copy(inverseView);
    this.material.uniforms.inverseProjectionMatrix.value.copy(inverseProj);
    this.material.uniforms.uCameraPos.value.copy(camera.position);
  }
  
  getConfig(): DeferredLightingConfig {
    return { ...this.config };
  }
  
  updateShadowUniforms(uniforms: Record<string, { value: unknown }>): void {
    if (uniforms.shadowDepthTexture) {
      this.material.uniforms.shadowDepthTexture.value = uniforms.shadowDepthTexture.value;
      this.material.uniforms.shadowsEnabled.value = true;
    }
    if (uniforms.shadowMatrix) {
      (this.material.uniforms.shadowMatrix.value as THREE.Matrix4).copy(
        uniforms.shadowMatrix.value as THREE.Matrix4
      );
    }
    if (uniforms.shadowMapSize) {
      this.material.uniforms.shadowMapSize.value = uniforms.shadowMapSize.value;
    }
    if (uniforms.shadowBias) {
      this.material.uniforms.shadowBias.value = uniforms.shadowBias.value;
    }
    if (uniforms.shadowSoftness) {
      this.material.uniforms.shadowSoftness.value = uniforms.shadowSoftness.value;
    }
    if (uniforms.shadowIntensity) {
      this.material.uniforms.shadowIntensity.value = uniforms.shadowIntensity.value;
    }
  }
  
  updateShadowIntensity(intensity: number): void {
    this.material.uniforms.shadowIntensity.value = intensity;
  }
  
  updateShadowDarkness(darkness: number): void {
    this.material.uniforms.shadowDarkness.value = darkness;
  }
  
  updateConfig(config: Partial<DeferredLightingConfig>): void {
    if (config.lightDirection) {
      this.config.lightDirection.copy(config.lightDirection);
      this.material.uniforms.lightDirection.value.copy(config.lightDirection);
    }
    if (config.lightColor) {
      this.config.lightColor.copy(config.lightColor);
      this.material.uniforms.lightColor.value.copy(config.lightColor);
    }
    if (config.lightIntensity !== undefined) {
      this.config.lightIntensity = config.lightIntensity;
      this.material.uniforms.lightIntensity.value = config.lightIntensity;
    }
    if (config.ambientColor) {
      this.config.ambientColor.copy(config.ambientColor);
      this.material.uniforms.ambientColor.value.copy(config.ambientColor);
    }
    if (config.ambientIntensity !== undefined) {
      this.config.ambientIntensity = config.ambientIntensity;
      this.material.uniforms.ambientIntensity.value = config.ambientIntensity;
    }
    if (config.iblIntensity !== undefined) {
      this.config.iblIntensity = config.iblIntensity;
      this.material.uniforms.envMapIntensity.value = config.iblIntensity;
    }
  }
  
  setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }
  
  render(
    renderer: THREE.WebGLRenderer,
    gBufferTextures: {
      albedoRoughness: THREE.Texture;
      normalMetalAO: THREE.Texture;
      emissiveFlags: THREE.Texture;
      depth: THREE.Texture;
    },
    ssaoTexture: THREE.Texture | null,
    iblManager?: IBLManager
  ): THREE.Texture {
    // Update G-Buffer textures
    this.material.uniforms.gAlbedoRoughness.value = gBufferTextures.albedoRoughness;
    this.material.uniforms.gNormalMetalAO.value = gBufferTextures.normalMetalAO;
    this.material.uniforms.gEmissiveFlags.value = gBufferTextures.emissiveFlags;
    this.material.uniforms.gDepth.value = gBufferTextures.depth;
    
    // SSAO
    if (ssaoTexture) {
      this.material.uniforms.ssaoTexture.value = ssaoTexture;
    } else {
      const whiteData = new Uint8Array([255, 255, 255, 255]);
      const whiteTex = new THREE.DataTexture(whiteData, 1, 1, THREE.RGBAFormat);
      whiteTex.needsUpdate = true;
      this.material.uniforms.ssaoTexture.value = whiteTex;
    }
    
    // IBL
    if (iblManager) {
      const textures = iblManager.getTextures();
      this.material.uniforms.brdfLUT.value = textures.brdfLUT;
      
      if (textures.envMap) {
        this.material.uniforms.envMap.value = textures.envMap;
        this.material.uniforms.prefilteredEnvMap.value = textures.envMap;
        this.material.uniforms.hasEnvMap.value = true;
      } else {
        this.material.uniforms.hasEnvMap.value = false;
      }
    } else {
      this.material.uniforms.hasEnvMap.value = false;
    }
    
    // Render
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(this.fsScene, this.fsCamera);
    
    return this.renderTarget.texture;
  }
  
  getOutputTexture(): THREE.Texture {
    return this.renderTarget.texture;
  }
  
  dispose(): void {
    this.material.dispose();
    this.renderTarget.dispose();
    (this.fsQuad.geometry as THREE.PlaneGeometry).dispose();
  }
}

export default DeferredLightingEffect;
