import * as THREE from 'three';
import type { RenderContext, RenderPassConfig } from '../core/RenderGraph';

/**
 * G-Buffer Pass - Single geometry pass with Multiple Render Targets
 * 
 * Outputs:
 * - RT0 (gAlbedoRoughness): Albedo.rgb + Roughness.a (RGBA8)
 * - RT1 (gNormalMetalAO): Normal.rg (octahedral) + Metalness.b + AO.a (RGBA8 or RGBA16F)
 * - RT2 (gEmissiveFlags): Emissive.rgb + MaterialFlags.a (RGBA8)
 * - Depth: Scene depth (Depth24Plus)
 */

// Vertex shader shared by all G-Buffer materials
// Includes Three.js clipping plane support so tiles are clipped at wall boundaries
export const GBufferVertexShader = /* glsl */ `
  #include <clipping_planes_pars_vertex>
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    // Output world-space normals for correct lighting calculations
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <clipping_planes_vertex>
  }
`;

// MRT Fragment shader for WebGL2
export const GBufferFragmentShaderMRT = /* glsl */ `
  precision highp float;
  
  uniform vec3 uAlbedo;
  uniform float uRoughness;
  uniform float uMetalness;
  uniform float uAO;
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;
  uniform sampler2D uAlbedoMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uRoughnessMap;
  uniform sampler2D uMetalnessMap;
  uniform sampler2D uAOMap;
  uniform sampler2D uEmissiveMap;
  uniform bool uHasAlbedoMap;
  uniform bool uHasNormalMap;
  uniform bool uHasRoughnessMap;
  uniform bool uHasMetalnessMap;
  uniform bool uHasAOMap;
  uniform bool uHasEmissiveMap;
  uniform float uMaterialFlags;
  
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  // Octahedral normal encoding
  vec2 encodeNormal(vec3 n) {
    n = normalize(n);
    n /= (abs(n.x) + abs(n.y) + abs(n.z));
    if (n.z < 0.0) {
      n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return n.xy * 0.5 + 0.5;
  }
  
  void main() {
    // Sample textures
    vec3 albedo = uAlbedo;
    if (uHasAlbedoMap) {
      albedo *= texture2D(uAlbedoMap, vUv).rgb;
    }
    
    float roughness = uRoughness;
    if (uHasRoughnessMap) {
      roughness *= texture2D(uRoughnessMap, vUv).g; // Often in green channel (glTF)
    }
    
    float metalness = uMetalness;
    if (uHasMetalnessMap) {
      metalness *= texture2D(uMetalnessMap, vUv).b; // Often in blue channel (glTF)
    }
    
    float ao = uAO;
    if (uHasAOMap) {
      ao *= texture2D(uAOMap, vUv).r;
    }
    
    vec3 emissive = uEmissive * uEmissiveIntensity;
    if (uHasEmissiveMap) {
      emissive *= texture2D(uEmissiveMap, vUv).rgb;
    }
    
    // Get normal (world space)
    vec3 normal = normalize(vNormal);
    // Note: For proper normal mapping, we'd need tangent space calculation
    // Simplified version for now
    
    // Encode normal
    vec2 encodedNormal = encodeNormal(normal);
    
    // Output to G-Buffer
    // Since WebGL2 MRT with Three.js requires special handling,
    // we output to gl_FragColor for single-pass mode
    // The RenderGraph will handle MRT setup
    
    // Pack output: We'll use a single output for now and do multi-pass if needed
    // RT0: Albedo + Roughness
    gl_FragColor = vec4(albedo, roughness);
  }
`;

// Single-pass fragment shaders for each G-Buffer target
export const AlbedoRoughnessFragmentShader = /* glsl */ `
  precision highp float;
  #include <clipping_planes_pars_fragment>
  
  uniform vec3 uAlbedo;
  uniform float uRoughness;
  uniform sampler2D uAlbedoMap;
  uniform sampler2D uRoughnessMap;
  uniform bool uHasAlbedoMap;
  uniform bool uHasRoughnessMap;
  
  varying vec2 vUv;
  
  void main() {
    #include <clipping_planes_fragment>
    vec3 albedo = uAlbedo;
    if (uHasAlbedoMap) {
      vec4 albedoSample = texture2D(uAlbedoMap, vUv);
      albedo *= albedoSample.rgb;
    }
    
    float roughness = uRoughness;
    if (uHasRoughnessMap) {
      roughness *= texture2D(uRoughnessMap, vUv).g;
    }
    
    gl_FragColor = vec4(albedo, roughness);
  }
`;

export const NormalMetalAOFragmentShader = /* glsl */ `
  precision highp float;
  #include <clipping_planes_pars_fragment>
  
  uniform float uMetalness;
  uniform float uAO;
  uniform sampler2D uMetalnessMap;
  uniform sampler2D uAOMap;
  uniform bool uHasMetalnessMap;
  uniform bool uHasAOMap;
  
  varying vec3 vNormal;
  varying vec2 vUv;
  
  vec2 encodeNormal(vec3 n) {
    n = normalize(n);
    n /= (abs(n.x) + abs(n.y) + abs(n.z));
    if (n.z < 0.0) {
      n.xy = (1.0 - abs(n.yx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.y >= 0.0 ? 1.0 : -1.0);
    }
    return n.xy * 0.5 + 0.5;
  }
  
  void main() {
    #include <clipping_planes_fragment>
    vec3 normal = normalize(vNormal);
    vec2 encodedNormal = encodeNormal(normal);
    
    float metalness = uMetalness;
    if (uHasMetalnessMap) {
      metalness *= texture2D(uMetalnessMap, vUv).b;
    }
    
    float ao = uAO;
    if (uHasAOMap) {
      ao *= texture2D(uAOMap, vUv).r;
    }
    
    gl_FragColor = vec4(encodedNormal, metalness, ao);
  }
`;

export const EmissiveFlagsFragmentShader = /* glsl */ `
  precision highp float;
  #include <clipping_planes_pars_fragment>
  
  uniform vec3 uEmissive;
  uniform float uEmissiveIntensity;
  uniform float uMaterialFlags;
  uniform sampler2D uEmissiveMap;
  uniform bool uHasEmissiveMap;
  
  varying vec2 vUv;
  
  void main() {
    #include <clipping_planes_fragment>
    vec3 emissive = uEmissive * uEmissiveIntensity;
    if (uHasEmissiveMap) {
      emissive *= texture2D(uEmissiveMap, vUv).rgb;
    }
    
    gl_FragColor = vec4(emissive, uMaterialFlags);
  }
`;

export const DepthOnlyFragmentShader = /* glsl */ `
  precision highp float;
  #include <clipping_planes_pars_fragment>
  
  uniform float uNear;
  uniform float uFar;
  
  void main() {
    #include <clipping_planes_fragment>
    float depth = gl_FragCoord.z;
    // Linear depth
    float linearDepth = (2.0 * uNear * uFar) / (uFar + uNear - depth * (uFar - uNear));
    linearDepth = (linearDepth - uNear) / (uFar - uNear);
    
    gl_FragColor = vec4(linearDepth, depth, 0.0, 1.0);
  }
`;

/**
 * G-Buffer material cache - creates and manages materials per mesh
 */
export class GBufferMaterialFactory {
  private albedoRoughnessMaterials = new Map<string, THREE.ShaderMaterial>();
  private normalMetalAOMaterials = new Map<string, THREE.ShaderMaterial>();
  private emissiveFlagsMaterials = new Map<string, THREE.ShaderMaterial>();
  private depthMaterials = new Map<string, THREE.ShaderMaterial>();
  private defaultDepthMaterial: THREE.ShaderMaterial;
  
  private near = 0.1;
  private far = 100;
  
  constructor() {
    this.defaultDepthMaterial = new THREE.ShaderMaterial({
      vertexShader: GBufferVertexShader,
      fragmentShader: DepthOnlyFragmentShader,
      uniforms: {
        uNear: { value: this.near },
        uFar: { value: this.far },
      },
    });
  }
  
  setCamera(camera: THREE.PerspectiveCamera): void {
    this.near = camera.near;
    this.far = camera.far;
    this.defaultDepthMaterial.uniforms.uNear.value = this.near;
    this.defaultDepthMaterial.uniforms.uFar.value = this.far;
    // Update all per-mesh depth materials
    this.depthMaterials.forEach(mat => {
      mat.uniforms.uNear.value = this.near;
      mat.uniforms.uFar.value = this.far;
    });
  }
  
  getDepthMaterial(): THREE.ShaderMaterial {
    return this.defaultDepthMaterial;
  }
  
  /**
   * Get a depth material for a specific mesh, with clipping planes if needed
   */
  getDepthMaterialForMesh(mesh: THREE.Mesh): THREE.ShaderMaterial {
    const originalMat = mesh.material as THREE.Material;
    const clips = originalMat.clippingPlanes;
    
    // If no clipping planes, use shared default
    if (!clips || clips.length === 0) {
      return this.defaultDepthMaterial;
    }
    
    const id = mesh.uuid;
    let depthMat = this.depthMaterials.get(id);
    
    if (depthMat) {
      depthMat.clippingPlanes = clips;
      depthMat.clipping = true;
      return depthMat;
    }
    
    depthMat = new THREE.ShaderMaterial({
      vertexShader: GBufferVertexShader,
      fragmentShader: DepthOnlyFragmentShader,
      uniforms: {
        uNear: { value: this.near },
        uFar: { value: this.far },
      },
      clippingPlanes: clips,
      clipping: true,
    });
    
    this.depthMaterials.set(id, depthMat);
    return depthMat;
  }
  
  /**
   * Create G-Buffer materials for a mesh based on its original material
   */
  getMaterialsForMesh(mesh: THREE.Mesh): {
    albedoRoughness: THREE.ShaderMaterial;
    normalMetalAO: THREE.ShaderMaterial;
    emissiveFlags: THREE.ShaderMaterial;
  } {
    const id = mesh.uuid;
    
    // Check cache
    let albedoRoughness = this.albedoRoughnessMaterials.get(id);
    let normalMetalAO = this.normalMetalAOMaterials.get(id);
    let emissiveFlags = this.emissiveFlagsMaterials.get(id);
    
    if (albedoRoughness && normalMetalAO && emissiveFlags) {
      // Sync dynamic properties from original material (color, roughness, clipping, etc.)
      const originalMat = mesh.material as THREE.Material;
      const clips = originalMat.clippingPlanes || null;
      const hasClips = clips && clips.length > 0;
      albedoRoughness.clippingPlanes = clips;
      albedoRoughness.clipping = !!hasClips;
      normalMetalAO.clippingPlanes = clips;
      normalMetalAO.clipping = !!hasClips;
      emissiveFlags.clippingPlanes = clips;
      emissiveFlags.clipping = !!hasClips;
      
      // Sync material properties that may change at runtime (e.g. floor color change)
      if (originalMat instanceof THREE.MeshStandardMaterial || 
          originalMat instanceof THREE.MeshPhysicalMaterial) {
        albedoRoughness.uniforms.uAlbedo.value.copy(originalMat.color);
        albedoRoughness.uniforms.uRoughness.value = originalMat.roughness ?? 0.5;
        normalMetalAO.uniforms.uMetalness.value = originalMat.metalness ?? 0.0;
        if (originalMat.map !== albedoRoughness.uniforms.uAlbedoMap.value) {
          albedoRoughness.uniforms.uAlbedoMap.value = originalMat.map;
          albedoRoughness.uniforms.uHasAlbedoMap.value = !!originalMat.map;
        }
      } else if (originalMat instanceof THREE.MeshBasicMaterial) {
        albedoRoughness.uniforms.uAlbedo.value.copy(originalMat.color);
      } else if ('color' in originalMat && (originalMat as any).color instanceof THREE.Color) {
        albedoRoughness.uniforms.uAlbedo.value.copy((originalMat as any).color);
      }
      
      return { albedoRoughness, normalMetalAO, emissiveFlags };
    }
    
    // Extract parameters from original material
    const originalMat = mesh.material as THREE.Material;
    
    let albedo = new THREE.Color(0.8, 0.8, 0.8);
    let roughness = 0.5;
    let metalness = 0.0;
    let ao = 1.0;
    let emissive = new THREE.Color(0, 0, 0);
    let emissiveIntensity = 1.0;
    let albedoMap: THREE.Texture | null = null;
    let roughnessMap: THREE.Texture | null = null;
    let metalnessMap: THREE.Texture | null = null;
    let aoMap: THREE.Texture | null = null;
    let emissiveMap: THREE.Texture | null = null;
    
    // Handle different material types for color extraction
    if (originalMat instanceof THREE.MeshStandardMaterial || 
        originalMat instanceof THREE.MeshPhysicalMaterial) {
      albedo = originalMat.color.clone();
      roughness = originalMat.roughness ?? 0.5;
      metalness = originalMat.metalness ?? 0.0;
      if (originalMat.emissive) emissive = originalMat.emissive.clone();
      emissiveIntensity = originalMat.emissiveIntensity ?? 1.0;
      albedoMap = originalMat.map || null;
      roughnessMap = originalMat.roughnessMap || null;
      metalnessMap = originalMat.metalnessMap || null;
      aoMap = originalMat.aoMap || null;
      emissiveMap = originalMat.emissiveMap || null;
      ao = originalMat.aoMapIntensity ?? 1.0;
    } else if (originalMat instanceof THREE.MeshBasicMaterial) {
      // MeshBasicMaterial - extract color, treat as non-metal diffuse
      albedo = originalMat.color.clone();
      roughness = 1.0; // Diffuse-like
      metalness = 0.0;
      albedoMap = originalMat.map || null;
    } else if (originalMat instanceof THREE.MeshLambertMaterial) {
      // MeshLambertMaterial - extract color
      albedo = originalMat.color.clone();
      roughness = 1.0;
      metalness = 0.0;
      if (originalMat.emissive) emissive = originalMat.emissive.clone();
      emissiveIntensity = originalMat.emissiveIntensity ?? 1.0;
      albedoMap = originalMat.map || null;
      aoMap = originalMat.aoMap || null;
      emissiveMap = originalMat.emissiveMap || null;
    } else if (originalMat instanceof THREE.MeshPhongMaterial) {
      // MeshPhongMaterial - extract color, estimate roughness from shininess
      albedo = originalMat.color.clone();
      roughness = 1.0 - Math.min(originalMat.shininess / 100, 1.0);
      metalness = 0.0;
      if (originalMat.emissive) emissive = originalMat.emissive.clone();
      emissiveIntensity = originalMat.emissiveIntensity ?? 1.0;
      albedoMap = originalMat.map || null;
      aoMap = originalMat.aoMap || null;
      emissiveMap = originalMat.emissiveMap || null;
    } else if ('color' in originalMat && (originalMat as any).color instanceof THREE.Color) {
      // Generic fallback for any material with a color property
      albedo = ((originalMat as any).color as THREE.Color).clone();
    }
    
    // Extract clipping planes from original material
    const clips = originalMat.clippingPlanes || null;
    const hasClips = clips && clips.length > 0;
    
    // Create materials
    albedoRoughness = new THREE.ShaderMaterial({
      vertexShader: GBufferVertexShader,
      fragmentShader: AlbedoRoughnessFragmentShader,
      uniforms: {
        uAlbedo: { value: albedo },
        uRoughness: { value: roughness },
        uAlbedoMap: { value: albedoMap },
        uRoughnessMap: { value: roughnessMap },
        uHasAlbedoMap: { value: albedoMap !== null },
        uHasRoughnessMap: { value: roughnessMap !== null },
      },
      side: originalMat.side,
      clippingPlanes: clips,
      clipping: !!hasClips,
    });
    
    normalMetalAO = new THREE.ShaderMaterial({
      vertexShader: GBufferVertexShader,
      fragmentShader: NormalMetalAOFragmentShader,
      uniforms: {
        uMetalness: { value: metalness },
        uAO: { value: ao },
        uMetalnessMap: { value: metalnessMap },
        uAOMap: { value: aoMap },
        uHasMetalnessMap: { value: metalnessMap !== null },
        uHasAOMap: { value: aoMap !== null },
      },
      side: originalMat.side,
      clippingPlanes: clips,
      clipping: !!hasClips,
    });
    
    emissiveFlags = new THREE.ShaderMaterial({
      vertexShader: GBufferVertexShader,
      fragmentShader: EmissiveFlagsFragmentShader,
      uniforms: {
        uEmissive: { value: emissive },
        uEmissiveIntensity: { value: emissiveIntensity },
        uMaterialFlags: { value: 0.0 },
        uEmissiveMap: { value: emissiveMap },
        uHasEmissiveMap: { value: emissiveMap !== null },
      },
      side: originalMat.side,
      clippingPlanes: clips,
      clipping: !!hasClips,
    });
    
    // Cache
    this.albedoRoughnessMaterials.set(id, albedoRoughness);
    this.normalMetalAOMaterials.set(id, normalMetalAO);
    this.emissiveFlagsMaterials.set(id, emissiveFlags);
    
    return { albedoRoughness, normalMetalAO, emissiveFlags };
  }
  
  /**
   * Update emissive values for a mesh (called when material properties change)
   */
  updateEmissiveForMesh(mesh: THREE.Mesh): void {
    const id = mesh.uuid;
    const emissiveFlags = this.emissiveFlagsMaterials.get(id);
    if (!emissiveFlags) return;
    
    const originalMat = mesh.material as THREE.Material;
    let emissive = new THREE.Color(0, 0, 0);
    let emissiveIntensity = 1.0;
    
    if (originalMat instanceof THREE.MeshStandardMaterial || 
        originalMat instanceof THREE.MeshPhysicalMaterial ||
        originalMat instanceof THREE.MeshLambertMaterial ||
        originalMat instanceof THREE.MeshPhongMaterial) {
      if (originalMat.emissive) emissive = originalMat.emissive.clone();
      emissiveIntensity = originalMat.emissiveIntensity ?? 1.0;
    }
    
    emissiveFlags.uniforms.uEmissive.value = emissive;
    emissiveFlags.uniforms.uEmissiveIntensity.value = emissiveIntensity;
    emissiveFlags.needsUpdate = true;
  }
  
  /**
   * Invalidate cached materials for a mesh (forces re-creation on next access)
   */
  invalidateMesh(meshId: string): void {
    const albedoRoughness = this.albedoRoughnessMaterials.get(meshId);
    const normalMetalAO = this.normalMetalAOMaterials.get(meshId);
    const emissiveFlags = this.emissiveFlagsMaterials.get(meshId);
    
    if (albedoRoughness) {
      albedoRoughness.dispose();
      this.albedoRoughnessMaterials.delete(meshId);
    }
    if (normalMetalAO) {
      normalMetalAO.dispose();
      this.normalMetalAOMaterials.delete(meshId);
    }
    if (emissiveFlags) {
      emissiveFlags.dispose();
      this.emissiveFlagsMaterials.delete(meshId);
    }
  }
  
  dispose(): void {
    this.albedoRoughnessMaterials.forEach(m => m.dispose());
    this.normalMetalAOMaterials.forEach(m => m.dispose());
    this.emissiveFlagsMaterials.forEach(m => m.dispose());
    this.depthMaterials.forEach(m => m.dispose());
    this.defaultDepthMaterial.dispose();
    
    this.albedoRoughnessMaterials.clear();
    this.normalMetalAOMaterials.clear();
    this.emissiveFlagsMaterials.clear();
    this.depthMaterials.clear();
  }
}

/**
 * Create G-Buffer pass configuration for the RenderGraph
 */
export function createGBufferPass(
  materialFactory: GBufferMaterialFactory
): RenderPassConfig[] {
  const originalMaterials = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>();
  
  const backupMaterials = (scene: THREE.Scene): void => {
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material) {
        originalMaterials.set(obj, obj.material);
      }
    });
  };
  
  const restoreMaterials = (): void => {
    originalMaterials.forEach((mat, obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = mat;
      }
    });
    originalMaterials.clear();
  };
  
  const applyMaterial = (
    scene: THREE.Scene,
    getMaterial: (mesh: THREE.Mesh) => THREE.Material
  ): void => {
    scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.visible) {
        obj.material = getMaterial(obj);
      }
    });
  };
  
  // Pass 1: Depth - Clear to (1,1,1,1) so sky pixels have depth=1.0 (far)
  const depthPass: RenderPassConfig = {
    name: 'GBuffer_Depth',
    inputs: [],
    outputs: ['gDepth'],
    execute: (ctx: RenderContext) => {
      const target = ctx.getRenderTarget('gDepth');
      if (!target) return;
      
      if (ctx.camera instanceof THREE.PerspectiveCamera) {
        materialFactory.setCamera(ctx.camera);
      }
      
      backupMaterials(ctx.scene);
      applyMaterial(ctx.scene, mesh => materialFactory.getDepthMaterialForMesh(mesh));
      
      // Clear depth buffer to 1.0 (far plane) so sky is detected correctly
      ctx.renderer.setRenderTarget(target);
      ctx.renderer.setClearColor(0xffffff, 1);
      ctx.renderer.clear();
      ctx.renderer.render(ctx.scene, ctx.camera);
      
      restoreMaterials();
    },
  };
  
  // Pass 2: Albedo + Roughness - Clear to black albedo, roughness=1
  const albedoRoughnessPass: RenderPassConfig = {
    name: 'GBuffer_AlbedoRoughness',
    inputs: [],
    outputs: ['gAlbedoRoughness'],
    execute: (ctx: RenderContext) => {
      const target = ctx.getRenderTarget('gAlbedoRoughness');
      if (!target) return;
      
      backupMaterials(ctx.scene);
      applyMaterial(ctx.scene, mesh => materialFactory.getMaterialsForMesh(mesh).albedoRoughness);
      
      // Clear to black albedo with roughness=1 (stored in alpha)
      ctx.renderer.setRenderTarget(target);
      ctx.renderer.setClearColor(0x000000, 1);
      ctx.renderer.clear();
      ctx.renderer.render(ctx.scene, ctx.camera);
      
      restoreMaterials();
    },
  };
  
  // Pass 3: Normal + Metalness + AO - Clear to encoded up-normal (0.5, 0.5, 1.0)
  const normalMetalAOPass: RenderPassConfig = {
    name: 'GBuffer_NormalMetalAO',
    inputs: [],
    outputs: ['gNormalMetalAO'],
    execute: (ctx: RenderContext) => {
      const target = ctx.getRenderTarget('gNormalMetalAO');
      if (!target) return;
      
      backupMaterials(ctx.scene);
      applyMaterial(ctx.scene, mesh => materialFactory.getMaterialsForMesh(mesh).normalMetalAO);
      
      // Clear to encoded up-normal (0,0,1) -> (0.5, 0.5, 1.0), metal=0, AO=1
      ctx.renderer.setRenderTarget(target);
      ctx.renderer.setClearColor(new THREE.Color(0.5, 0.5, 1.0), 0);
      ctx.renderer.clear();
      ctx.renderer.render(ctx.scene, ctx.camera);
      
      restoreMaterials();
    },
  };
  
  // Pass 4: Emissive + Flags - Clear to no emission
  // This pass updates emissive values from live materials before rendering
  const emissiveFlagsPass: RenderPassConfig = {
    name: 'GBuffer_EmissiveFlags',
    inputs: [],
    outputs: ['gEmissiveFlags'],
    execute: (ctx: RenderContext) => {
      const target = ctx.getRenderTarget('gEmissiveFlags');
      if (!target) return;
      
      backupMaterials(ctx.scene);
      
      // Apply emissive materials and update emissive values from live materials
      applyMaterial(ctx.scene, mesh => {
        // Update emissive values from the current material state before rendering
        materialFactory.updateEmissiveForMesh(mesh);
        return materialFactory.getMaterialsForMesh(mesh).emissiveFlags;
      });
      
      // Clear to no emission, no flags
      ctx.renderer.setRenderTarget(target);
      ctx.renderer.setClearColor(0x000000, 0);
      ctx.renderer.clear();
      ctx.renderer.render(ctx.scene, ctx.camera);
      
      restoreMaterials();
    },
  };
  
  return [depthPass, albedoRoughnessPass, normalMetalAOPass, emissiveFlagsPass];
}

export default GBufferMaterialFactory;
