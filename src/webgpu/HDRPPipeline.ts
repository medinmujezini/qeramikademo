import * as THREE from 'three';
import { RenderGraph } from './core/RenderGraph';
import { GBufferMaterialFactory, createGBufferPass } from './passes/GBufferPass';
import DeferredLightingEffect from './passes/DeferredLightingPass';
import { SSAOEffect } from './effects/SSAOEffect';
import { SSREffect } from './effects/SSREffect';
import { ContactShadowsEffect } from './effects/ContactShadowsEffect';
import { BloomEffect } from './effects/BloomEffect';
import { ColorGradingEffect } from './effects/ColorGradingEffect';
import { FilmEffectsEffect } from './effects/FilmEffectsEffect';
import { FakeMobileBloomEffect } from './effects/FakeMobileBloomEffect';
import { IBLManager } from './lighting/IBLManager';
import { TileLightGrid } from './lighting/TileLightGrid';
import { SimpleShadowMap } from './shadows/SimpleShadowMap';
/**
 * High Definition Render Pipeline (HDRP) style implementation
 * 
 * Features:
 * - Deferred rendering with G-Buffer
 * - Screen-space ambient occlusion (SSAO)
 * - Screen-space reflections (SSR)
 * - Contact shadows
 * - Bloom
 * - Color grading
 * - Film effects (vignette, grain)
 * - PBR lighting with IBL
 * - Debug visualization modes
 */

export interface HDRPPipelineConfig {
  // SSAO
  ssaoEnabled: boolean;
  ssaoRadius: number;
  ssaoIntensity: number;
  ssaoSamples: number;
  ssaoBias: number;
  ssaoBlurSharpness: number;
  // SSR
  ssrEnabled: boolean;
  ssrMaxDistance: number;
  ssrThickness: number;
  ssrMaxSteps: number;
  // Shadows
  contactShadowsEnabled: boolean;
  contactShadowsIntensity: number;
  shadowSoftness: number;
  shadowIntensity: number;
  shadowDarkness: number;
  // Lighting
  skyLightIntensity: number;
  // Bloom
  bloomEnabled: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  // Fake Mobile Bloom
  fakeMobileBloomEnabled: boolean;
  fakeMobileBloomIntensity: number;
  // Color Grading
  colorGradingEnabled: boolean;
  contrast: number;
  saturation: number;
  brightness: number;
  // Film Effects
  vignetteEnabled: boolean;
  vignetteIntensity: number;
  grainEnabled: boolean;
  grainIntensity: number;
}

const defaultConfig: HDRPPipelineConfig = {
  // SSAO
  ssaoEnabled: true,
  ssaoRadius: 0.5,
  ssaoIntensity: 0.8,
  ssaoSamples: 9999,
  ssaoBias: 0.025,
  ssaoBlurSharpness: 4.0,
  // SSR
  ssrEnabled: false,
  ssrMaxDistance: 10,
  ssrThickness: 0.1,
  ssrMaxSteps: 32,
  // Shadows
  contactShadowsEnabled: true,
  contactShadowsIntensity: 0.4,
  shadowSoftness: 1.5,
  shadowIntensity: 1.0,
  shadowDarkness: 0.15,
  // Lighting
  skyLightIntensity: 1.2,
  // Bloom
  bloomEnabled: false,
  bloomIntensity: 0.5,
  bloomThreshold: 1.0,
  // Fake Mobile Bloom
  fakeMobileBloomEnabled: false,
  fakeMobileBloomIntensity: 0.3,
  // Color Grading
  colorGradingEnabled: true,
  contrast: 1.0,
  saturation: 1.0,
  brightness: 1.0,
  // Film Effects
  vignetteEnabled: false,
  vignetteIntensity: 0.3,
  grainEnabled: false,
  grainIntensity: 0.05,
};

export class HDRPPipeline {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  
  private config: HDRPPipelineConfig;
  
  private renderGraph: RenderGraph;
  private gBufferFactory: GBufferMaterialFactory;
  
  // Effects (lazy initialized)
  private ssaoEffect: SSAOEffect | null = null;
  private ssrEffect: SSREffect | null = null;
  private contactShadowsEffect: ContactShadowsEffect | null = null;
  private deferredLighting: DeferredLightingEffect | null = null;
  private bloomEffect: BloomEffect | null = null;
  private fakeMobileBloomEffect: FakeMobileBloomEffect | null = null;
  private colorGradingEffect: ColorGradingEffect | null = null;
  private filmEffectsEffect: FilmEffectsEffect | null = null;
  
  // Shadows - using simplified single shadow map
  private shadowMap: SimpleShadowMap;
  
  // Output
  private outputTarget: THREE.WebGLRenderTarget;
  private ssrCompositeTarget: THREE.WebGLRenderTarget;
  private bloomBlendTarget: THREE.WebGLRenderTarget;
  private copyMaterial: THREE.MeshBasicMaterial;
  private compositeMaterial: THREE.ShaderMaterial;
  private bloomBlendMaterial: THREE.ShaderMaterial;
  private tonemapMaterial: THREE.ShaderMaterial;
  private fsQuad: THREE.Mesh;
  private fsScene: THREE.Scene;
  private fsCamera: THREE.OrthographicCamera;
  
  // Lighting
  private lightGrid: TileLightGrid;
  private iblManager: IBLManager;
  
  // Debug
  private debugMode: number = 0;
  
  private width: number;
  private height: number;
  private initialized = false;
  private debugLogging = false;
  
  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    config?: Partial<HDRPPipelineConfig>
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = { ...defaultConfig, ...config };
    
    const size = renderer.getSize(new THREE.Vector2());
    this.width = size.x || 800;
    this.height = size.y || 600;
    
    // Initialize core systems
    this.renderGraph = new RenderGraph();
    this.gBufferFactory = new GBufferMaterialFactory();
    this.iblManager = new IBLManager(renderer);
    this.lightGrid = new TileLightGrid(this.width, this.height);
    
    // Initialize simple shadow map with soft shadows
    this.shadowMap = new SimpleShadowMap({
      mapSize: 2048,          // Higher resolution for soft shadows
      worldSize: 30,          // Cover -15 to +15 world units
      near: 0.5,
      far: 100,
      bias: 0.003,            // Lower bias for soft shadows
      softness: this.config.shadowSoftness,
    });
    // Output targets
    this.outputTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });
    
    this.ssrCompositeTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });
    
    this.bloomBlendTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });
    
    // Fullscreen copy resources
    this.copyMaterial = new THREE.MeshBasicMaterial();
    
    // Composite shader - NO tonemapping, stays in HDR
    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D baseColor;
        uniform sampler2D ssrTexture;
        uniform sampler2D contactShadows;
        uniform bool hasSSR;
        uniform bool hasContactShadows;
        varying vec2 vUv;
        
        void main() {
          vec4 base = texture2D(baseColor, vUv);
          
          // Apply contact shadows
          if (hasContactShadows) {
            float shadow = texture2D(contactShadows, vUv).r;
            base.rgb *= shadow;
          }
          
          // Blend SSR
          if (hasSSR) {
            vec4 ssr = texture2D(ssrTexture, vUv);
            base.rgb = mix(base.rgb, ssr.rgb, ssr.a);
          }
          
          // Output HDR - no tonemapping here
          gl_FragColor = vec4(base.rgb, 1.0);
        }
      `,
      uniforms: {
        baseColor: { value: null },
        ssrTexture: { value: null },
        contactShadows: { value: null },
        hasSSR: { value: false },
        hasContactShadows: { value: false },
      },
    });
    
    // Additive bloom blend material
    this.bloomBlendMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        uniform float bloomIntensity;
        varying vec2 vUv;
        
        void main() {
          vec3 base = texture2D(baseTexture, vUv).rgb;
          vec3 bloom = texture2D(bloomTexture, vUv).rgb;
          gl_FragColor = vec4(base + bloom * bloomIntensity, 1.0);
        }
      `,
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: null },
        bloomIntensity: { value: 1.0 },
      },
    });
    
    // Final tonemapping + gamma material
    this.tonemapMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D inputTexture;
        varying vec2 vUv;
        
        void main() {
          vec3 color = texture2D(inputTexture, vUv).rgb;
          
          // ACES tone mapping
          color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
          color = clamp(color, 0.0, 1.0);
          
          // Gamma correction
          color = pow(color, vec3(1.0 / 2.2));
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        inputTexture: { value: null },
      },
    });
    
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.fsQuad = new THREE.Mesh(geometry, this.copyMaterial);
    this.fsScene = new THREE.Scene();
    this.fsScene.add(this.fsQuad);
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.setupRenderGraph();
    
    if (this.debugLogging) {
      console.log('[HDRPPipeline] Initialized');
    }
  }
  
  private setupRenderGraph(): void {
    // Register G-Buffer textures with NEAREST filtering for float types (compatibility)
    this.renderGraph.registerTexture('gDepth', {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: true,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.renderGraph.registerTexture('gAlbedoRoughness', {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    });
    this.renderGraph.registerTexture('gNormalMetalAO', {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    });
    this.renderGraph.registerTexture('gEmissiveFlags', {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
    });
    this.renderGraph.registerTexture('ssao', {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });
    this.renderGraph.registerTexture('directLighting', {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
    });
    
    // Mark persistent textures (these are consumed outside the render graph)
    this.renderGraph.markPersistent('gDepth');
    this.renderGraph.markPersistent('gAlbedoRoughness');
    this.renderGraph.markPersistent('gNormalMetalAO');
    this.renderGraph.markPersistent('gEmissiveFlags');
    this.renderGraph.markPersistent('directLighting');
    
    // Add G-Buffer passes
    const gBufferPasses = createGBufferPass(this.gBufferFactory);
    gBufferPasses.forEach(pass => this.renderGraph.addPass(pass));
    
    this.initialized = true;
  }
  
  private getSSAOEffect(): SSAOEffect {
    if (!this.ssaoEffect) {
      this.ssaoEffect = new SSAOEffect(this.width, this.height, {
        radius: this.config.ssaoRadius,
        intensity: this.config.ssaoIntensity,
        samples: this.config.ssaoSamples,
        bias: this.config.ssaoBias,
        blurSharpness: this.config.ssaoBlurSharpness,
      });
    }
    return this.ssaoEffect;
  }
  
  private getSSREffect(): SSREffect {
    if (!this.ssrEffect) {
      this.ssrEffect = new SSREffect(this.width, this.height, {
        maxDistance: this.config.ssrMaxDistance,
        maxSteps: this.config.ssrMaxSteps,
      });
    }
    return this.ssrEffect;
  }
  
  private getContactShadowsEffect(): ContactShadowsEffect {
    if (!this.contactShadowsEffect) {
      this.contactShadowsEffect = new ContactShadowsEffect(this.width, this.height, {
        intensity: this.config.contactShadowsIntensity,
      });
    }
    return this.contactShadowsEffect;
  }
  
  private getDeferredLighting(): DeferredLightingEffect {
    if (!this.deferredLighting) {
      this.deferredLighting = new DeferredLightingEffect(this.width, this.height);
    }
    return this.deferredLighting;
  }
  
  private getBloomEffect(): BloomEffect {
    if (!this.bloomEffect) {
      this.bloomEffect = new BloomEffect(this.width, this.height, {
        enabled: this.config.bloomEnabled,
        threshold: this.config.bloomThreshold,
        intensity: this.config.bloomIntensity,
      });
    }
    return this.bloomEffect;
  }
  
  private getFakeMobileBloomEffect(): FakeMobileBloomEffect {
    if (!this.fakeMobileBloomEffect) {
      this.fakeMobileBloomEffect = new FakeMobileBloomEffect(this.width, this.height, {
        enabled: this.config.fakeMobileBloomEnabled,
        intensity: this.config.fakeMobileBloomIntensity,
        threshold: 0.8,
      });
    }
    return this.fakeMobileBloomEffect;
  }
  
  private getColorGradingEffect(): ColorGradingEffect {
    if (!this.colorGradingEffect) {
      this.colorGradingEffect = new ColorGradingEffect(this.width, this.height, {
        enabled: this.config.colorGradingEnabled,
        contrast: this.config.contrast,
        saturation: this.config.saturation,
        brightness: this.config.brightness,
      });
    }
    return this.colorGradingEffect;
  }
  
  private getFilmEffectsEffect(): FilmEffectsEffect {
    if (!this.filmEffectsEffect) {
      this.filmEffectsEffect = new FilmEffectsEffect(this.width, this.height, {
        enabled: this.config.vignetteEnabled || this.config.grainEnabled,
        vignetteEnabled: this.config.vignetteEnabled,
        vignetteIntensity: this.config.vignetteIntensity,
        grainEnabled: this.config.grainEnabled,
        grainIntensity: this.config.grainIntensity,
      });
    }
    return this.filmEffectsEffect;
  }
  
  /**
   * Extract lights from the Three.js scene and update deferred lighting
   * FIX: Use world positions for DirectionalLight direction
   */
  private updateLightsFromScene(): void {
    let foundDirectional = false;
    
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight && !foundDirectional) {
        // Get world positions for both light and target
        const lightWorldPos = new THREE.Vector3();
        const targetWorldPos = new THREE.Vector3();
        
        obj.getWorldPosition(lightWorldPos);
        obj.target.getWorldPosition(targetWorldPos);
        
        // Direction FROM the light TO the target (the direction light travels)
        const dir = new THREE.Vector3()
          .subVectors(targetWorldPos, lightWorldPos)
          .normalize();
        
        this.getDeferredLighting().updateConfig({
          lightDirection: dir,
          lightColor: obj.color,
          lightIntensity: obj.intensity,
        });
        
        // Also update contact shadows light direction (in view space)
        if (this.contactShadowsEffect) {
          // Transform to view space for contact shadows
          const viewDir = dir.clone().transformDirection(this.camera.matrixWorldInverse);
          this.contactShadowsEffect.updateParams({ lightDirection: viewDir });
        }
        
        foundDirectional = true;
      }
    });
    
    // If no directional light found, use default sun
    if (!foundDirectional) {
      const defaultDir = new THREE.Vector3(-0.5, -1, -0.3).normalize();
      this.getDeferredLighting().updateConfig({
        lightDirection: defaultDir,
        lightColor: new THREE.Color(1, 0.98, 0.95),
        lightIntensity: 3.0,
      });
      
      if (this.contactShadowsEffect) {
        const viewDir = defaultDir.clone().transformDirection(this.camera.matrixWorldInverse);
        this.contactShadowsEffect.updateParams({ lightDirection: viewDir });
      }
    }
  }
  
  // Debug mode methods
  setDebugMode(mode: number): void {
    console.log('[HDRPPipeline] setDebugMode called with:', mode);
    this.debugMode = mode;
    this.getDeferredLighting().setDebugMode(mode);
  }
  
  getDebugMode(): number {
    return this.debugMode;
  }
  
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    this.renderGraph.resize(width, height);
    this.outputTarget.setSize(width, height);
    this.ssrCompositeTarget.setSize(width, height);
    this.bloomBlendTarget.setSize(width, height);
    this.lightGrid.setSize(width, height);
    
    this.ssaoEffect?.setSize(width, height);
    this.ssrEffect?.setSize(width, height);
    this.contactShadowsEffect?.setSize(width, height);
    this.deferredLighting?.setSize(width, height);
    this.bloomEffect?.setSize(width, height);
    this.fakeMobileBloomEffect?.setSize(width, height);
    this.colorGradingEffect?.setSize(width, height);
    this.filmEffectsEffect?.setSize(width, height);
  }
  
  updateConfig(config: Partial<HDRPPipelineConfig>): void {
    Object.assign(this.config, config);
    
    // SSAO updates
    const ssaoChanged = config.ssaoRadius !== undefined || 
                        config.ssaoIntensity !== undefined ||
                        config.ssaoSamples !== undefined ||
                        config.ssaoBias !== undefined ||
                        config.ssaoBlurSharpness !== undefined;
    
    if (this.ssaoEffect && ssaoChanged) {
      this.ssaoEffect.updateParams({
        radius: this.config.ssaoRadius,
        intensity: this.config.ssaoIntensity,
        samples: this.config.ssaoSamples,
        bias: this.config.ssaoBias,
        blurSharpness: this.config.ssaoBlurSharpness,
      });
    }
    
    // SSR updates
    if (this.ssrEffect && (config.ssrMaxDistance !== undefined || config.ssrMaxSteps !== undefined)) {
      this.ssrEffect.updateParams({
        maxDistance: this.config.ssrMaxDistance,
        maxSteps: this.config.ssrMaxSteps,
      });
    }
    
    // Contact shadows updates
    if (this.contactShadowsEffect && config.contactShadowsIntensity !== undefined) {
      this.contactShadowsEffect.updateParams({
        intensity: this.config.contactShadowsIntensity,
      });
    }
    
    // Shadow softness updates
    if (config.shadowSoftness !== undefined) {
      this.shadowMap.setSoftness(this.config.shadowSoftness);
    }
    
    // Shadow intensity updates - pass to deferred lighting
    if (config.shadowIntensity !== undefined && this.deferredLighting) {
      this.deferredLighting.updateShadowIntensity(this.config.shadowIntensity);
    }
    
    // Shadow darkness updates - pass to deferred lighting
    if (config.shadowDarkness !== undefined && this.deferredLighting) {
      this.deferredLighting.updateShadowDarkness(this.config.shadowDarkness);
    }
    
    // Sky light intensity updates - pass to deferred lighting
    if (config.skyLightIntensity !== undefined && this.deferredLighting) {
      this.deferredLighting.updateConfig({
        ambientIntensity: this.config.skyLightIntensity,
      });
    }
    
    // Bloom updates
    const bloomChanged = config.bloomEnabled !== undefined ||
                         config.bloomIntensity !== undefined ||
                         config.bloomThreshold !== undefined;
    if (this.bloomEffect && bloomChanged) {
      this.bloomEffect.updateParams({
        enabled: this.config.bloomEnabled,
        intensity: this.config.bloomIntensity,
        threshold: this.config.bloomThreshold,
      });
    }
    
    // Color grading updates
    const colorGradingChanged = config.colorGradingEnabled !== undefined ||
                                config.contrast !== undefined ||
                                config.saturation !== undefined ||
                                config.brightness !== undefined;
    if (this.colorGradingEffect && colorGradingChanged) {
      this.colorGradingEffect.updateParams({
        enabled: this.config.colorGradingEnabled,
        contrast: this.config.contrast,
        saturation: this.config.saturation,
        brightness: this.config.brightness,
      });
    }
    
    // Film effects updates
    const filmEffectsChanged = config.vignetteEnabled !== undefined ||
                               config.vignetteIntensity !== undefined ||
                               config.grainEnabled !== undefined ||
                               config.grainIntensity !== undefined;
    if (this.filmEffectsEffect && filmEffectsChanged) {
      this.filmEffectsEffect.updateParams({
        enabled: this.config.vignetteEnabled || this.config.grainEnabled,
        vignetteEnabled: this.config.vignetteEnabled,
        vignetteIntensity: this.config.vignetteIntensity,
        grainEnabled: this.config.grainEnabled,
        grainIntensity: this.config.grainIntensity,
      });
    }
    
    // Fake mobile bloom updates
    const fakeMobileBloomChanged = config.fakeMobileBloomEnabled !== undefined ||
                                   config.fakeMobileBloomIntensity !== undefined;
    if (this.fakeMobileBloomEffect && fakeMobileBloomChanged) {
      this.fakeMobileBloomEffect.updateParams({
        enabled: this.config.fakeMobileBloomEnabled,
        intensity: this.config.fakeMobileBloomIntensity,
      });
    }
  }
  
  render(): void {
    if (!this.initialized) return;
    
    // Update camera on materials
    this.gBufferFactory.setCamera(this.camera);
    
    // Update lights from scene
    this.updateLightsFromScene();
    
    // Execute render graph for G-Buffer
    this.renderGraph.execute(this.renderer, this.scene, this.camera, 0.016);
    
    // Get G-Buffer textures
    const depthTex = this.renderGraph.getTexture('gDepth');
    const albedoTex = this.renderGraph.getTexture('gAlbedoRoughness');
    const normalTex = this.renderGraph.getTexture('gNormalMetalAO');
    const emissiveTex = this.renderGraph.getTexture('gEmissiveFlags');
    
    if (!depthTex || !albedoTex || !normalTex || !emissiveTex) {
      // Fallback to direct rendering
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    
    // Update light grid from scene
    this.lightGrid.updateFromScene(this.scene, this.camera);
    
    // Update and render simple shadow map
    const lightingEffect = this.getDeferredLighting();
    const lightDir = lightingEffect.getConfig().lightDirection;
    this.shadowMap.update(this.camera, lightDir);
    this.shadowMap.render(this.renderer, this.scene);
    
    // SSAO - render when enabled OR when debugging SSAO/AO modes
    let ssaoTex: THREE.Texture | null = null;
    const ssaoDebugModes = [0, 4, 8]; // Normal, SSAO debug, Combined AO debug
    if (this.config.ssaoEnabled || ssaoDebugModes.includes(this.debugMode)) {
      const ssao = this.getSSAOEffect();
      ssao.updateCamera(this.camera);
      ssaoTex = ssao.render(this.renderer, depthTex, normalTex);
    }

    // Contact Shadows (skip in debug modes)
    let contactShadowsTex: THREE.Texture | null = null;
    if (this.config.contactShadowsEnabled && this.debugMode === 0) {
      const contactShadows = this.getContactShadowsEffect();
      contactShadows.updateCamera(this.camera);
      contactShadowsTex = contactShadows.render(this.renderer, depthTex, normalTex);
    }
    
    // Deferred Lighting - use lightingEffect from earlier
    lightingEffect.updateCamera(this.camera);
    
    // Pass shadow uniforms to deferred lighting (simplified)
    lightingEffect.updateShadowUniforms(this.shadowMap.getShadowUniforms());
    
    const litResult = lightingEffect.render(
      this.renderer,
      {
        albedoRoughness: albedoTex,
        normalMetalAO: normalTex,
        emissiveFlags: emissiveTex,
        depth: depthTex,
      },
      ssaoTex,
      this.iblManager
    );
    
    // SSR (skip in debug modes)
    let ssrTex: THREE.Texture | null = null;
    if (this.config.ssrEnabled && this.debugMode === 0) {
      const ssr = this.getSSREffect();
      ssr.updateCamera(this.camera);
      ssrTex = ssr.render(
        this.renderer,
        litResult,
        depthTex,
        normalTex,
        albedoTex,
        this.iblManager.getTextures().envMap as THREE.CubeTexture | undefined
      );
    }
    
    // Debug modes that should still get post-processing (e.g., Shadow Map mode 17)
    const debugModesWithPostProcessing = [0, 17];
    
    // In debug mode (except those with post-processing), skip post-processing
    if (this.debugMode !== 0 && !debugModesWithPostProcessing.includes(this.debugMode)) {
      // Apply tonemapping for debug views
      this.compositeMaterial.uniforms.baseColor.value = litResult;
      this.compositeMaterial.uniforms.hasSSR.value = false;
      this.compositeMaterial.uniforms.hasContactShadows.value = false;
      
      this.fsQuad.material = this.compositeMaterial;
      this.renderer.setRenderTarget(this.outputTarget);
      this.renderer.render(this.fsScene, this.fsCamera);
      
      // Apply tonemapping
      this.tonemapMaterial.uniforms.inputTexture.value = this.outputTarget.texture;
      this.fsQuad.material = this.tonemapMaterial;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.fsScene, this.fsCamera);
      return;
    }
    
    // Composite base lighting with contact shadows and SSR (HDR)
    this.compositeMaterial.uniforms.baseColor.value = litResult;
    this.compositeMaterial.uniforms.ssrTexture.value = ssrTex;
    this.compositeMaterial.uniforms.contactShadows.value = contactShadowsTex;
    this.compositeMaterial.uniforms.hasSSR.value = ssrTex !== null;
    this.compositeMaterial.uniforms.hasContactShadows.value = contactShadowsTex !== null;
    
    this.fsQuad.material = this.compositeMaterial;
    this.renderer.setRenderTarget(this.outputTarget);
    this.renderer.render(this.fsScene, this.fsCamera);
    
    let currentResult: THREE.Texture = this.outputTarget.texture;
    let currentTarget: THREE.WebGLRenderTarget = this.outputTarget;
    
    // Bloom pass - proper additive blend
    if (this.config.bloomEnabled) {
      const bloom = this.getBloomEffect();
      const bloomTex = bloom.render(this.renderer, currentResult);
      
      // Use additive blend material
      this.bloomBlendMaterial.uniforms.baseTexture.value = currentResult;
      this.bloomBlendMaterial.uniforms.bloomTexture.value = bloomTex;
      this.bloomBlendMaterial.uniforms.bloomIntensity.value = this.config.bloomIntensity;
      
      this.fsQuad.material = this.bloomBlendMaterial;
      this.renderer.setRenderTarget(this.bloomBlendTarget);
      this.renderer.render(this.fsScene, this.fsCamera);
      
      currentResult = this.bloomBlendTarget.texture;
      currentTarget = this.bloomBlendTarget;
    }
    
    // Fake mobile bloom pass (alternative to full bloom for mobile)
    if (this.config.fakeMobileBloomEnabled && !this.config.bloomEnabled) {
      const fakeMobileBloom = this.getFakeMobileBloomEffect();
      const nextTarget = currentTarget === this.outputTarget ? this.ssrCompositeTarget : this.outputTarget;
      currentResult = fakeMobileBloom.render(this.renderer, currentResult, nextTarget);
      currentTarget = nextTarget;
    }
    
    // Color grading pass (operates on HDR data)
    if (this.config.colorGradingEnabled) {
      const colorGrading = this.getColorGradingEffect();
      const nextTarget = currentTarget === this.outputTarget ? this.ssrCompositeTarget : this.outputTarget;
      currentResult = colorGrading.render(this.renderer, currentResult, nextTarget);
      currentTarget = nextTarget;
    }
    
    // Film effects pass (vignette + grain)
    if (this.config.vignetteEnabled || this.config.grainEnabled) {
      const filmEffects = this.getFilmEffectsEffect();
      const nextTarget = currentTarget === this.outputTarget ? this.ssrCompositeTarget : this.outputTarget;
      currentResult = filmEffects.render(this.renderer, currentResult, nextTarget);
      currentTarget = nextTarget;
    }
    
    // Final tonemapping + gamma output to screen
    this.tonemapMaterial.uniforms.inputTexture.value = currentResult;
    this.fsQuad.material = this.tonemapMaterial;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.fsScene, this.fsCamera);
  }
  
  dispose(): void {
    this.renderGraph.dispose();
    this.gBufferFactory.dispose();
    this.iblManager.dispose();
    this.lightGrid.dispose();
    this.shadowMap.dispose();
    
    this.ssaoEffect?.dispose();
    this.ssrEffect?.dispose();
    this.contactShadowsEffect?.dispose();
    this.deferredLighting?.dispose();
    this.bloomEffect?.dispose();
    this.fakeMobileBloomEffect?.dispose();
    this.colorGradingEffect?.dispose();
    this.filmEffectsEffect?.dispose();
    
    this.outputTarget.dispose();
    this.ssrCompositeTarget.dispose();
    this.bloomBlendTarget.dispose();
    this.copyMaterial.dispose();
    this.compositeMaterial.dispose();
    this.bloomBlendMaterial.dispose();
    this.tonemapMaterial.dispose();
    (this.fsQuad.geometry as THREE.PlaneGeometry).dispose();
    
    if (this.debugLogging) {
      console.log('[HDRPPipeline] Disposed');
    }
  }
}

export default HDRPPipeline;
