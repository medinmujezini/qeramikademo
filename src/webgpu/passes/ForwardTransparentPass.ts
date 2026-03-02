import * as THREE from 'three';
import type { RenderPassConfig, RenderContext } from '../core/RenderGraph';
import type { TileLightGrid } from '../lighting/TileLightGrid';

/**
 * Forward+ Transparent Pass
 * 
 * Renders transparent objects after deferred opaques.
 * Uses tiled light culling for efficient lighting.
 */

const ForwardPlusVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ForwardPlusFragmentShader = /* glsl */ `
  precision highp float;
  
  uniform vec3 uAlbedo;
  uniform float uRoughness;
  uniform float uMetalness;
  uniform float uOpacity;
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;
  
  uniform sampler2D uAlbedoMap;
  uniform bool uHasAlbedoMap;
  
  uniform vec3 cameraPosition;
  uniform vec3 ambientColor;
  uniform float ambientIntensity;
  
  // Lights (simple array approach for <50 lights)
  #define MAX_LIGHTS 50
  uniform vec4 lightPositions[MAX_LIGHTS];
  uniform vec4 lightColors[MAX_LIGHTS];
  uniform vec4 lightParams[MAX_LIGHTS];
  uniform vec4 lightDirections[MAX_LIGHTS];
  uniform int lightCount;
  
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  const float PI = 3.14159265359;
  
  // PBR functions (same as deferred)
  float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float num = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return num / denom;
  }
  
  float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
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
  
  vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  }
  
  vec3 evaluateLight(int idx, vec3 worldPos, vec3 N, vec3 V, vec3 albedo, float roughness, float metalness, vec3 F0) {
    vec4 lightPos = lightPositions[idx];
    vec4 lightCol = lightColors[idx];
    vec4 params = lightParams[idx];
    vec4 lightDir = lightDirections[idx];
    
    float lightType = params.y;
    float range = params.x;
    
    vec3 L;
    float attenuation = 1.0;
    
    if (lightType < 0.5) {
      // Point light
      vec3 toLight = lightPos.xyz - worldPos;
      float dist = length(toLight);
      L = normalize(toLight);
      
      // Distance attenuation
      attenuation = 1.0 / (1.0 + dist * dist / (range * range));
      attenuation *= max(0.0, 1.0 - dist / range);
    } else if (lightType < 1.5) {
      // Spot light
      vec3 toLight = lightPos.xyz - worldPos;
      float dist = length(toLight);
      L = normalize(toLight);
      
      // Distance attenuation
      attenuation = 1.0 / (1.0 + dist * dist / (range * range));
      attenuation *= max(0.0, 1.0 - dist / range);
      
      // Spot attenuation
      float spotAngle = params.z;
      float spotPenumbra = params.w;
      float theta = dot(L, normalize(-lightDir.xyz));
      float outerCos = cos(spotAngle);
      float innerCos = cos(spotAngle * (1.0 - spotPenumbra));
      attenuation *= smoothstep(outerCos, innerCos, theta);
    } else {
      // Directional light
      L = normalize(-lightDir.xyz);
    }
    
    vec3 H = normalize(V + L);
    float NdotL = max(dot(N, L), 0.0);
    
    // Cook-Torrance BRDF
    float D = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 numerator = D * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL + 0.0001;
    vec3 specular = numerator / denominator;
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metalness;
    
    return (kD * albedo / PI + specular) * lightCol.rgb * lightCol.a * NdotL * attenuation;
  }
  
  void main() {
    vec3 albedo = uAlbedo;
    if (uHasAlbedoMap) {
      vec4 texColor = texture2D(uAlbedoMap, vUv);
      albedo *= texColor.rgb;
    }
    
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, uMetalness);
    
    // Accumulate direct lighting
    vec3 directLight = vec3(0.0);
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= lightCount) break;
      directLight += evaluateLight(i, vWorldPosition, N, V, albedo, uRoughness, uMetalness, F0);
    }
    
    // Ambient
    vec3 ambient = albedo * ambientColor * ambientIntensity;
    
    // Emissive
    vec3 emissive = uEmissive * uEmissiveIntensity;
    
    vec3 color = directLight + ambient + emissive;
    
    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * Material for transparent Forward+ rendering
 */
export class ForwardPlusMaterial extends THREE.ShaderMaterial {
  constructor(params: {
    albedo?: THREE.Color;
    roughness?: number;
    metalness?: number;
    opacity?: number;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    albedoMap?: THREE.Texture;
  } = {}) {
    super({
      vertexShader: ForwardPlusVertexShader,
      fragmentShader: ForwardPlusFragmentShader,
      uniforms: {
        uAlbedo: { value: params.albedo ?? new THREE.Color(1, 1, 1) },
        uRoughness: { value: params.roughness ?? 0.5 },
        uMetalness: { value: params.metalness ?? 0.0 },
        uOpacity: { value: params.opacity ?? 1.0 },
        uEmissive: { value: params.emissive ?? new THREE.Color(0, 0, 0) },
        uEmissiveIntensity: { value: params.emissiveIntensity ?? 1.0 },
        uAlbedoMap: { value: params.albedoMap ?? null },
        uHasAlbedoMap: { value: params.albedoMap !== null && params.albedoMap !== undefined },
        
        cameraPosition: { value: new THREE.Vector3() },
        ambientColor: { value: new THREE.Color(0.4, 0.45, 0.5) },
        ambientIntensity: { value: 0.5 },
        
        lightPositions: { value: new Array(50).fill(new THREE.Vector4()) },
        lightColors: { value: new Array(50).fill(new THREE.Vector4()) },
        lightParams: { value: new Array(50).fill(new THREE.Vector4()) },
        lightDirections: { value: new Array(50).fill(new THREE.Vector4()) },
        lightCount: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }
  
  updateLights(lightGrid: TileLightGrid): void {
    const positions = lightGrid.getLightPositions();
    const colors = lightGrid.getLightColors();
    const params = lightGrid.getLightParams();
    const directions = lightGrid.getLightDirections();
    const count = lightGrid.getLightCount();
    
    // Convert to Vector4 arrays
    const posArray = this.uniforms.lightPositions.value as THREE.Vector4[];
    const colArray = this.uniforms.lightColors.value as THREE.Vector4[];
    const paramArray = this.uniforms.lightParams.value as THREE.Vector4[];
    const dirArray = this.uniforms.lightDirections.value as THREE.Vector4[];
    
    for (let i = 0; i < count && i < 50; i++) {
      const offset = i * 4;
      posArray[i].set(positions[offset], positions[offset + 1], positions[offset + 2], positions[offset + 3]);
      colArray[i].set(colors[offset], colors[offset + 1], colors[offset + 2], colors[offset + 3]);
      paramArray[i].set(params[offset], params[offset + 1], params[offset + 2], params[offset + 3]);
      dirArray[i].set(directions[offset], directions[offset + 1], directions[offset + 2], 0);
    }
    
    this.uniforms.lightCount.value = Math.min(count, 50);
  }
}

/**
 * Forward+ Transparent Pass
 */
export class ForwardTransparentPass {
  private transparentObjects: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();
  private forwardMaterials: Map<THREE.Object3D, ForwardPlusMaterial> = new Map();
  
  constructor() {}
  
  /**
   * Prepare transparent objects for Forward+ rendering
   */
  prepareScene(scene: THREE.Scene, lightGrid: TileLightGrid, camera: THREE.Camera): void {
    this.transparentObjects.clear();
    
    scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      
      const mat = obj.material as THREE.Material;
      if (!mat || !mat.transparent) return;
      
      // Store original material
      this.transparentObjects.set(obj, obj.material);
      
      // Get or create Forward+ material
      let forwardMat = this.forwardMaterials.get(obj);
      if (!forwardMat) {
        const stdMat = mat as THREE.MeshStandardMaterial;
        forwardMat = new ForwardPlusMaterial({
          albedo: stdMat.color?.clone(),
          roughness: stdMat.roughness ?? 0.5,
          metalness: stdMat.metalness ?? 0.0,
          opacity: stdMat.opacity ?? 1.0,
          emissive: stdMat.emissive?.clone(),
          emissiveIntensity: stdMat.emissiveIntensity ?? 1.0,
          albedoMap: stdMat.map ?? undefined,
        });
        this.forwardMaterials.set(obj, forwardMat);
      }
      
      // Update light data
      forwardMat.updateLights(lightGrid);
      forwardMat.uniforms.cameraPosition.value.copy(camera.position);
      
      // Apply Forward+ material
      obj.material = forwardMat;
    });
  }
  
  /**
   * Restore original materials after rendering
   */
  restoreScene(): void {
    this.transparentObjects.forEach((originalMat, obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = originalMat;
      }
    });
    this.transparentObjects.clear();
  }
  
  dispose(): void {
    this.forwardMaterials.forEach(mat => mat.dispose());
    this.forwardMaterials.clear();
    this.transparentObjects.clear();
  }
}

/**
 * Create Forward+ transparent pass for RenderGraph
 */
export function createForwardTransparentPass(
  pass: ForwardTransparentPass,
  lightGrid: TileLightGrid
): RenderPassConfig {
  return {
    name: 'ForwardTransparent',
    inputs: ['directLighting', 'gDepth'],
    outputs: ['sceneColor'],
    execute: (ctx: RenderContext) => {
      const directLighting = ctx.getRenderTarget('directLighting');
      const depthTarget = ctx.getRenderTarget('gDepth');
      
      if (!directLighting) {
        console.warn('ForwardTransparentPass: Missing directLighting target');
        return;
      }
      
      // Update light grid
      lightGrid.updateFromScene(ctx.scene, ctx.camera);
      
      // Prepare transparent objects with Forward+ materials
      pass.prepareScene(ctx.scene, lightGrid, ctx.camera);
      
      // Render transparent objects over the deferred result
      ctx.renderer.setRenderTarget(directLighting);
      ctx.renderer.autoClear = false;
      
      // Render only transparent objects
      ctx.scene.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.material && (obj.material as THREE.Material).transparent) {
          ctx.renderer.render(obj as unknown as THREE.Scene, ctx.camera);
        }
      });
      
      ctx.renderer.autoClear = true;
      
      // Restore original materials
      pass.restoreScene();
    },
  };
}

export default ForwardTransparentPass;
