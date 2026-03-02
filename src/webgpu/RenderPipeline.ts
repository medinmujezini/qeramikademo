// Multi-Pass Render Pipeline
// Orchestrates G-Buffer, TAA, lighting, SSAO, SSGI, probes, and composition passes
// With full UE5-style post-processing stack

import * as THREE from 'three';
import { GBufferMaterialCache } from './materials/GBufferMaterial';
import { SSAOEffect, SSAOEffectParams } from './effects/SSAOEffect';
import { SSGIEffect, SSGIEffectParams } from './effects/SSGIEffect';
import { ProbeLightingEffect } from './effects/ProbeLightingEffect';
import { CompositionEffect, CompositionEffectParams } from './effects/CompositionEffect';
import { VelocityBufferEffect } from './effects/VelocityBufferEffect';
import { TAAEffect, TAAEffectParams } from './effects/TAAEffect';
import { SharpenEffect, SharpenEffectParams } from './effects/SharpenEffect';
import { AutoExposureEffect, AutoExposureParams } from './effects/AutoExposureEffect';
import { BloomEffect, BloomEffectParams } from './effects/BloomEffect';
import { ColorGradingEffect, ColorGradingParams } from './effects/ColorGradingEffect';
import { FilmEffectsEffect, FilmEffectsParams } from './effects/FilmEffectsEffect';
import { ProbeVolumeManager } from './ProbeVolumeManager';
import { JitterManager } from './utils/JitterSequence';
import { GIConfig, TAAConfig } from '@/gi/GIConfig';

export interface RenderPipelineConfig {
  enabled: boolean;
  ssao: SSAOEffectParams & { enabled: boolean };
  ssgi: SSGIEffectParams & { enabled: boolean };
  probes: { enabled: boolean };
  taa: TAAConfig;
  exposure: number;
  ambientIntensity: number;
  ambientColor: THREE.Color;
}

export function configFromGI(giConfig: GIConfig): RenderPipelineConfig {
  return {
    enabled: giConfig.enabled,
    ssao: {
      enabled: giConfig.ssao.enabled,
      radius: giConfig.ssao.radius,
      intensity: giConfig.ssao.intensity,
      bias: giConfig.ssao.bias,
      samples: giConfig.ssao.samples,
    },
    ssgi: {
      enabled: giConfig.ssgi.enabled,
      rayLength: giConfig.ssgi.rayLength,
      numRays: giConfig.ssgi.raysPerPixel,
      raySteps: giConfig.ssgi.raySteps,
      historyWeight: giConfig.ssgi.temporalBlend,
      denoiseStrength: giConfig.ssgi.denoiseStrength * 100,
    },
    probes: {
      enabled: giConfig.probes.enabled,
    },
    taa: giConfig.taa,
    exposure: 1.0,
    ambientIntensity: 0.3,
    ambientColor: new THREE.Color(0.5, 0.6, 0.7),
  };
}

export class RenderPipeline {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private width: number;
  private height: number;
  private renderWidth: number;
  private renderHeight: number;

  // Render targets (core - always created)
  private depthTarget: THREE.WebGLRenderTarget;
  private normalTarget: THREE.WebGLRenderTarget;
  private albedoTarget: THREE.WebGLRenderTarget;
  private directTarget: THREE.WebGLRenderTarget;
  private preComposeTarget: THREE.WebGLRenderTarget;
  private postProcessTarget: THREE.WebGLRenderTarget;

  // Effects (lazy initialized to reduce VRAM spike)
  private ssaoEffect: SSAOEffect | null = null;
  private ssgiEffect: SSGIEffect | null = null;
  private probeLightingEffect: ProbeLightingEffect | null = null;
  private compositionEffect: CompositionEffect | null = null;
  private velocityBufferEffect: VelocityBufferEffect | null = null;
  private taaEffect: TAAEffect | null = null;
  private sharpenEffect: SharpenEffect | null = null;
  
  // Post-processing stack (lazy initialized)
  private autoExposureEffect: AutoExposureEffect | null = null;
  private bloomEffect: BloomEffect | null = null;
  private colorGradingEffect: ColorGradingEffect | null = null;
  private filmEffectsEffect: FilmEffectsEffect | null = null;

  // TAA jitter
  private jitterManager: JitterManager;

  // Probe volume manager
  private probeManager: ProbeVolumeManager | null = null;
  private probesInitialized: boolean = false;

  // Materials
  private materialCache: GBufferMaterialCache;

  // Config
  private config: RenderPipelineConfig;
  private giConfig: GIConfig;

  // Original materials backup
  private originalMaterials: Map<string, THREE.Material | THREE.Material[]> = new Map();
  
  // Shared fullscreen rendering resources (prevent memory leaks)
  private fsQuadGeometry: THREE.PlaneGeometry;
  private fsCamera: THREE.OrthographicCamera;
  private fsScene: THREE.Scene;
  private fsQuad: THREE.Mesh;
  
  // Bloom combine resources
  private bloomCombineMaterial: THREE.ShaderMaterial | null = null;
  
  // Copy to screen resources  
  private copyMaterial: THREE.MeshBasicMaterial | null = null;
  
  // Debug flag - enable to see detailed pass-by-pass logging
  private debugLogging = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    config: RenderPipelineConfig,
    giConfig?: GIConfig
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = config;
    this.giConfig = giConfig || {
      enabled: true,
      qualityTier: 'medium',
      ssgi: { enabled: true, raysPerPixel: 8, rayLength: 2.5, raySteps: 24, temporalBlend: 0.9, denoiseStrength: 0.8, denoiseRadius: 3, emissiveBoost: 1.5 },
      probes: { enabled: true, spacing: 1.25, updateBudget: 6, shOrder: 1, blendSpeed: 0.15, cubemapResolution: 64, wallRelocation: true, minWallDistance: 0.3 },
      ssao: { enabled: true, radius: 0.4, intensity: 1.2, samples: 16, bias: 0.02 },
      roomTint: { enabled: true, intensity: 0.2, sampleRadius: 4.0 },
      taa: { enabled: true, renderScale: 0.85, historyWeight: 0.9, varianceClipGamma: 1.25, sharpness: 0.35 },
      postProcessing: {
        autoExposure: { enabled: true, minExposure: 0.25, maxExposure: 4.0, adaptationSpeed: 1.0, exposureCompensation: 0.0 },
        bloom: { enabled: true, threshold: 0.8, softThreshold: 0.5, intensity: 0.3, levels: 3 }, // Reduced from 5 to 3
        colorGrading: { enabled: true, contrast: 1.0, saturation: 1.0, brightness: 1.0 },
        filmEffects: { grainEnabled: false, grainIntensity: 0.05, grainSize: 1.5, vignetteEnabled: true, vignetteIntensity: 0.25, vignetteSmoothness: 0.5 },
      },
    };

    // Get initial size
    const size = renderer.getSize(new THREE.Vector2());
    this.width = size.x || 800;
    this.height = size.y || 600;
    
    // Calculate render resolution based on TAA scale
    const taaScale = config.taa?.renderScale ?? 1.0;
    this.renderWidth = Math.floor(this.width * taaScale);
    this.renderHeight = Math.floor(this.height * taaScale);

    if (this.debugLogging) {
      console.log(`[RenderPipeline] Creating with size ${this.width}x${this.height}, render ${this.renderWidth}x${this.renderHeight}`);
    }

    // Create shared fullscreen rendering resources ONCE
    this.fsQuadGeometry = new THREE.PlaneGeometry(2, 2);
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsScene = new THREE.Scene();
    this.fsQuad = new THREE.Mesh(this.fsQuadGeometry);
    this.fsQuad.frustumCulled = false;
    this.fsScene.add(this.fsQuad);

    // Create CORE render targets at render resolution (6 targets)
    const targetOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    };

    this.depthTarget = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, {
      ...targetOptions,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(this.renderWidth, this.renderHeight, THREE.FloatType),
    });

    this.normalTarget = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, targetOptions);
    this.albedoTarget = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, targetOptions);
    this.directTarget = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, {
      ...targetOptions,
      type: THREE.HalfFloatType,
    });
    
    // Pre-composition target for TAA input
    this.preComposeTarget = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
    });
    
    // Post-processing target (reused for multiple passes)
    this.postProcessTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });

    // Create jitter manager for TAA
    this.jitterManager = new JitterManager(
      new THREE.Vector2(this.renderWidth, this.renderHeight),
      config.taa?.enabled ? 1.0 : 0.0
    );
    this.jitterManager.setEnabled(config.taa?.enabled ?? true);

    // Create material cache
    this.materialCache = new GBufferMaterialCache();
    this.materialCache.setCamera(camera.near, camera.far);

    // Initialize probe manager (lightweight)
    if (config.probes.enabled) {
      this.probeManager = new ProbeVolumeManager(this.giConfig);
    }

    if (this.debugLogging) {
      console.log('[RenderPipeline] Constructor complete - core resources created');
    }
  }

  // Lazy getters for effects - create on first use
  private getSSAOEffect(): SSAOEffect {
    if (!this.ssaoEffect) {
      this.ssaoEffect = new SSAOEffect(this.renderWidth, this.renderHeight, this.config.ssao);
      this.ssaoEffect.updateCamera(this.camera);
    }
    return this.ssaoEffect;
  }

  private getSSGIEffect(): SSGIEffect {
    if (!this.ssgiEffect) {
      this.ssgiEffect = new SSGIEffect(this.renderWidth, this.renderHeight, this.config.ssgi);
      this.ssgiEffect.updateCamera(this.camera);
    }
    return this.ssgiEffect;
  }

  private getProbeLightingEffect(): ProbeLightingEffect {
    if (!this.probeLightingEffect) {
      this.probeLightingEffect = new ProbeLightingEffect(this.renderWidth, this.renderHeight);
      this.probeLightingEffect.updateCamera(this.camera);
    }
    return this.probeLightingEffect;
  }

  private getCompositionEffect(): CompositionEffect {
    if (!this.compositionEffect) {
      this.compositionEffect = new CompositionEffect({
        useSSAO: this.config.ssao.enabled,
        useSSGI: this.config.ssgi.enabled,
        ssaoStrength: this.config.ssao.intensity,
        ssgiStrength: 1.0,
        exposure: this.config.exposure,
        ambientIntensity: this.config.ambientIntensity,
        ambientColor: this.config.ambientColor,
      });
    }
    return this.compositionEffect;
  }

  private getVelocityBufferEffect(): VelocityBufferEffect {
    if (!this.velocityBufferEffect) {
      this.velocityBufferEffect = new VelocityBufferEffect(this.renderWidth, this.renderHeight);
    }
    return this.velocityBufferEffect;
  }

  private getTAAEffect(): TAAEffect {
    if (!this.taaEffect) {
      this.taaEffect = new TAAEffect(this.width, this.height, {
        enabled: this.config.taa?.enabled ?? true,
        historyWeight: this.config.taa?.historyWeight ?? 0.9,
        varianceClipGamma: this.config.taa?.varianceClipGamma ?? 1.25,
        renderScale: this.config.taa?.renderScale ?? 1.0,
      });
    }
    return this.taaEffect;
  }

  private getSharpenEffect(): SharpenEffect {
    if (!this.sharpenEffect) {
      this.sharpenEffect = new SharpenEffect(this.width, this.height, {
        enabled: this.config.taa?.enabled ?? true,
        sharpness: this.config.taa?.sharpness ?? 0.35,
      });
    }
    return this.sharpenEffect;
  }

  private getAutoExposureEffect(): AutoExposureEffect {
    if (!this.autoExposureEffect) {
      const pp = this.giConfig.postProcessing;
      this.autoExposureEffect = new AutoExposureEffect({
        enabled: pp.autoExposure.enabled,
        minExposure: pp.autoExposure.minExposure,
        maxExposure: pp.autoExposure.maxExposure,
        adaptationSpeed: pp.autoExposure.adaptationSpeed,
        exposureCompensation: pp.autoExposure.exposureCompensation,
      });
    }
    return this.autoExposureEffect;
  }

  private getBloomEffect(): BloomEffect {
    if (!this.bloomEffect) {
      const pp = this.giConfig.postProcessing;
      this.bloomEffect = new BloomEffect(this.width, this.height, {
        enabled: pp.bloom.enabled,
        threshold: pp.bloom.threshold,
        softThreshold: pp.bloom.softThreshold,
        intensity: pp.bloom.intensity,
        levels: Math.min(pp.bloom.levels, 3), // Cap at 3 levels to reduce VRAM
      });
    }
    return this.bloomEffect;
  }

  private getColorGradingEffect(): ColorGradingEffect {
    if (!this.colorGradingEffect) {
      const pp = this.giConfig.postProcessing;
      this.colorGradingEffect = new ColorGradingEffect(this.width, this.height, {
        enabled: pp.colorGrading.enabled,
        contrast: pp.colorGrading.contrast,
        saturation: pp.colorGrading.saturation,
        brightness: pp.colorGrading.brightness,
      });
    }
    return this.colorGradingEffect;
  }

  private getFilmEffectsEffect(): FilmEffectsEffect {
    if (!this.filmEffectsEffect) {
      const pp = this.giConfig.postProcessing;
      this.filmEffectsEffect = new FilmEffectsEffect(this.width, this.height, {
        grainEnabled: pp.filmEffects.grainEnabled,
        grainIntensity: pp.filmEffects.grainIntensity,
        grainSize: pp.filmEffects.grainSize,
        vignetteEnabled: pp.filmEffects.vignetteEnabled,
        vignetteIntensity: pp.filmEffects.vignetteIntensity,
        vignetteSmoothness: pp.filmEffects.vignetteSmoothness,
      });
    }
    return this.filmEffectsEffect;
  }

  // Initialize probes from scene bounds
  initializeProbes() {
    if (!this.probeManager || this.probesInitialized) return;

    // Calculate scene bounds
    const bounds = new THREE.Box3();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.computeBoundingBox();
        if (object.geometry.boundingBox) {
          const worldBounds = object.geometry.boundingBox.clone();
          worldBounds.applyMatrix4(object.matrixWorld);
          bounds.union(worldBounds);
        }
      }
    });

    // Fallback if no geometry
    if (bounds.isEmpty()) {
      bounds.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
    }

    // Initialize probe volume
    const volume = this.probeManager.initialize(bounds);
    
    // Update probe lighting effect
    const probeLighting = this.getProbeLightingEffect();
    if (volume.bounds && volume.resolution) {
      probeLighting.updateProbeVolume(
        volume.bounds.min,
        volume.bounds.max,
        volume.resolution
      );
      probeLighting.setProbeTexture(volume.texture);
    }

    this.probesInitialized = true;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    
    const taaScale = this.config.taa?.renderScale ?? 1.0;
    this.renderWidth = Math.floor(width * taaScale);
    this.renderHeight = Math.floor(height * taaScale);

    // Update core render targets
    this.depthTarget.setSize(this.renderWidth, this.renderHeight);
    this.normalTarget.setSize(this.renderWidth, this.renderHeight);
    this.albedoTarget.setSize(this.renderWidth, this.renderHeight);
    this.directTarget.setSize(this.renderWidth, this.renderHeight);
    this.preComposeTarget.setSize(this.renderWidth, this.renderHeight);
    this.postProcessTarget.setSize(width, height);

    // Update effects only if they exist
    this.ssaoEffect?.setSize(this.renderWidth, this.renderHeight);
    this.ssgiEffect?.setSize(this.renderWidth, this.renderHeight);
    this.probeLightingEffect?.setSize(this.renderWidth, this.renderHeight);
    this.velocityBufferEffect?.setSize(this.renderWidth, this.renderHeight);
    
    // TAA outputs at full resolution
    this.taaEffect?.setSize(width, height);
    this.sharpenEffect?.setSize(width, height);
    
    // Post-processing at full resolution
    this.bloomEffect?.setSize(width, height);
    this.colorGradingEffect?.setSize(width, height);
    this.filmEffectsEffect?.setSize(width, height);
    
    // Update jitter manager
    this.jitterManager.setResolution(this.renderWidth, this.renderHeight);
  }

  updateConfig(config: Partial<RenderPipelineConfig>) {
    this.config = { ...this.config, ...config };

    if (config.ssao && this.ssaoEffect) {
      this.ssaoEffect.updateParams(config.ssao);
      this.compositionEffect?.updateParams({
        useSSAO: config.ssao.enabled,
        ssaoStrength: config.ssao.intensity,
      });
    }

    if (config.ssgi && this.ssgiEffect) {
      this.ssgiEffect.updateParams(config.ssgi);
      this.compositionEffect?.updateParams({
        useSSGI: config.ssgi.enabled,
      });
    }

    if (config.probes) {
      // Enable/disable probe lighting
      if (config.probes.enabled && !this.probeManager) {
        this.probeManager = new ProbeVolumeManager(this.giConfig);
        this.probesInitialized = false;
      }
    }
    
    if (config.taa) {
      this.jitterManager.setEnabled(config.taa.enabled);
      this.taaEffect?.updateParams({
        enabled: config.taa.enabled,
        historyWeight: config.taa.historyWeight,
        varianceClipGamma: config.taa.varianceClipGamma,
        renderScale: config.taa.renderScale,
      });
      this.sharpenEffect?.updateParams({
        enabled: config.taa.enabled,
        sharpness: config.taa.sharpness,
      });
      
      // Resize if render scale changed
      if (config.taa.renderScale !== undefined) {
        this.setSize(this.width, this.height);
      }
    }

    if (config.exposure !== undefined) {
      this.compositionEffect?.updateParams({ exposure: config.exposure });
    }

    if (config.ambientIntensity !== undefined) {
      this.compositionEffect?.updateParams({ ambientIntensity: config.ambientIntensity });
    }

    if (config.ambientColor !== undefined) {
      this.compositionEffect?.updateParams({ ambientColor: config.ambientColor });
    }
  }

  // Backup original materials
  private backupMaterials() {
    this.originalMaterials.clear();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        this.originalMaterials.set(object.uuid, object.material);
      }
    });
  }

  // Restore original materials
  private restoreMaterials() {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const original = this.originalMaterials.get(object.uuid);
        if (original) {
          object.material = original;
        }
      }
    });
  }

  // Apply G-Buffer materials for a specific pass
  private applyGBufferMaterials(passType: 'depth' | 'normal' | 'albedo') {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material) {
        const materials = this.materialCache.getMaterialsForObject(object);
        switch (passType) {
          case 'depth':
            object.material = materials.depth;
            break;
          case 'normal':
            object.material = materials.normalRoughness;
            break;
          case 'albedo':
            object.material = materials.albedoAO;
            break;
        }
      }
    });
  }

  render(): void {
    if (!this.config.enabled) {
      // Direct render without pipeline
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.debugLogging) console.log('[RenderPipeline] Starting render frame');

    // Initialize probes on first render
    if (this.config.probes.enabled && !this.probesInitialized) {
      this.initializeProbes();
    }

    // === TAA: Apply camera jitter ===
    if (this.config.taa?.enabled) {
      this.jitterManager.nextFrame(this.camera);
    }

    // Update velocity buffer camera matrices (before jitter is applied to projection)
    if (this.config.taa?.enabled) {
      this.getVelocityBufferEffect().updateCamera(this.camera);
    }

    // Update camera uniforms
    this.materialCache.setCamera(this.camera.near, this.camera.far);
    if (this.config.ssao.enabled) {
      this.getSSAOEffect().updateCamera(this.camera);
    }
    if (this.config.ssgi.enabled) {
      this.getSSGIEffect().updateCamera(this.camera);
    }
    if (this.config.probes.enabled) {
      this.getProbeLightingEffect().updateCamera(this.camera);
    }

    // Update probes
    if (this.probeManager && this.config.probes.enabled) {
      this.probeManager.update(this.scene, this.camera);
      
      // Update probe texture reference
      const texture = this.probeManager.getTexture();
      if (texture) {
        this.getProbeLightingEffect().setProbeTexture(texture);
      }
    }

    // Backup materials
    this.backupMaterials();

    // === G-Buffer Passes ===
    if (this.debugLogging) console.log('[RenderPipeline] G-Buffer passes starting');

    // Depth pass
    this.applyGBufferMaterials('depth');
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Normal pass
    this.applyGBufferMaterials('normal');
    this.renderer.setRenderTarget(this.normalTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    // Albedo pass
    this.applyGBufferMaterials('albedo');
    this.renderer.setRenderTarget(this.albedoTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    if (this.debugLogging) console.log('[RenderPipeline] G-Buffer complete');

    // === Direct Lighting Pass ===
    this.restoreMaterials();
    this.renderer.setRenderTarget(this.directTarget);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    if (this.debugLogging) console.log('[RenderPipeline] Direct lighting complete');

    // === Velocity Buffer Pass ===
    let velocityTexture: THREE.Texture | undefined;
    if (this.config.taa?.enabled) {
      velocityTexture = this.getVelocityBufferEffect().renderCameraVelocity(
        this.renderer,
        this.depthTarget.depthTexture!
      );
    }

    // === SSAO Pass ===
    let ssaoTexture: THREE.Texture | undefined;
    if (this.config.ssao.enabled) {
      ssaoTexture = this.getSSAOEffect().render(
        this.renderer,
        this.depthTarget.depthTexture!,
        this.normalTarget.texture
      );
      if (this.debugLogging) console.log('[RenderPipeline] SSAO complete');
    }

    // === SSGI Pass ===
    let ssgiTexture: THREE.Texture | undefined;
    if (this.config.ssgi.enabled) {
      ssgiTexture = this.getSSGIEffect().render(
        this.renderer,
        this.camera,
        {
          depthTexture: this.depthTarget.depthTexture!,
          normalTexture: this.normalTarget.texture,
          albedoTexture: this.albedoTarget.texture,
          directTexture: this.directTarget.texture,
        }
      );
      if (this.debugLogging) console.log('[RenderPipeline] SSGI complete');
    }

    // === Probe Lighting Pass ===
    let probeLightTexture: THREE.Texture | undefined;
    if (this.config.probes.enabled && this.probeManager?.getTexture()) {
      probeLightTexture = this.getProbeLightingEffect().render(
        this.renderer,
        {
          depthTexture: this.depthTarget.depthTexture!,
          normalTexture: this.normalTarget.texture,
        }
      );
    }

    // Combine SSGI and probe lighting for final indirect
    const finalIndirectTexture = ssgiTexture || probeLightTexture;

    // === Remove jitter before composition ===
    if (this.config.taa?.enabled) {
      this.jitterManager.reset(this.camera);
    }

    // === Composition Pass (to preComposeTarget for TAA) ===
    const composition = this.getCompositionEffect();
    
    if (this.config.taa?.enabled && velocityTexture) {
      // Render composition to intermediate target
      composition.render(this.renderer, this.preComposeTarget, {
        directTexture: this.directTarget.texture,
        albedoTexture: this.albedoTarget.texture,
        depthTexture: this.depthTarget.depthTexture!,
        ssaoTexture,
        ssgiTexture: finalIndirectTexture,
      });

    // === TAA Resolve ===
      const taaEffect = this.getTAAEffect();
      taaEffect.setJitter(this.jitterManager.getCurrentJitter());
      const taaOutput = taaEffect.render(
        this.renderer,
        this.preComposeTarget.texture,
        velocityTexture,
        this.depthTarget.depthTexture
      );

      if (this.debugLogging) console.log('[RenderPipeline] TAA complete');

      // === Sharpening Pass ===
      const sharpenOutput = this.getSharpenEffect().render(this.renderer, taaOutput, this.postProcessTarget);
      
      // === Post-Processing Stack ===
      this.applyPostProcessing(sharpenOutput || taaOutput);
    } else {
      // No TAA - direct composition to intermediate target
      composition.render(this.renderer, this.postProcessTarget, {
        directTexture: this.directTarget.texture,
        albedoTexture: this.albedoTarget.texture,
        depthTexture: this.depthTarget.depthTexture!,
        ssaoTexture,
        ssgiTexture: finalIndirectTexture,
      });
      
      // === Post-Processing Stack ===
      this.applyPostProcessing(this.postProcessTarget.texture);
    }

    if (this.debugLogging) console.log('[RenderPipeline] Frame complete');
  }
  
  // Apply the full post-processing stack (UE5-style order)
  private applyPostProcessing(inputTexture: THREE.Texture): void {
    const pp = this.giConfig.postProcessing;
    let currentTexture = inputTexture;
    
    // 1. Auto Exposure - calculate exposure before other effects
    if (pp.autoExposure.enabled) {
      const exposure = this.getAutoExposureEffect().calculate(this.renderer, currentTexture);
      // Update composition exposure for next frame
      this.compositionEffect?.updateParams({ exposure });
    }
    
    // 2. Bloom - extract bright areas and blur
    if (pp.bloom.enabled) {
      const bloomTexture = this.getBloomEffect().render(this.renderer, currentTexture);
      // Bloom is additive, we need to combine it
      currentTexture = this.combineBloom(currentTexture, bloomTexture);
    }
    
    // 3. Color Grading - contrast, saturation, LUT
    if (pp.colorGrading.enabled) {
      currentTexture = this.getColorGradingEffect().render(this.renderer, currentTexture, this.postProcessTarget);
    }
    
    // 4. Film Effects - grain, vignette (final pass to screen)
    if (pp.filmEffects.grainEnabled || pp.filmEffects.vignetteEnabled) {
      this.getFilmEffectsEffect().render(this.renderer, currentTexture, null);
    } else {
      // Copy final result to screen
      this.copyToScreen(currentTexture);
    }

    if (this.debugLogging) console.log('[RenderPipeline] Post-processing complete');
  }
  
  // Combine bloom with scene (additive blend) - reuses shared resources
  private combineBloom(sceneTexture: THREE.Texture, bloomTexture: THREE.Texture): THREE.Texture {
    // Create combine material lazily (only once)
    if (!this.bloomCombineMaterial) {
      this.bloomCombineMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D sceneTexture;
          uniform sampler2D bloomTexture;
          uniform float bloomIntensity;
          varying vec2 vUv;
          void main() {
            vec3 scene = texture2D(sceneTexture, vUv).rgb;
            vec3 bloom = texture2D(bloomTexture, vUv).rgb;
            gl_FragColor = vec4(scene + bloom * bloomIntensity, 1.0);
          }
        `,
        uniforms: {
          sceneTexture: { value: null },
          bloomTexture: { value: null },
          bloomIntensity: { value: 0.3 }
        },
        depthWrite: false,
        depthTest: false
      });
    }
    
    // Update uniforms
    this.bloomCombineMaterial.uniforms.sceneTexture.value = sceneTexture;
    this.bloomCombineMaterial.uniforms.bloomTexture.value = bloomTexture;
    this.bloomCombineMaterial.uniforms.bloomIntensity.value = this.giConfig.postProcessing.bloom.intensity;
    
    // Use shared fullscreen quad
    this.fsQuad.material = this.bloomCombineMaterial;
    
    // Render to preComposeTarget (reusing existing target)
    this.renderer.setRenderTarget(this.preComposeTarget);
    this.renderer.render(this.fsScene, this.fsCamera);
    
    return this.preComposeTarget.texture;
  }
  
  // Copy texture to screen - reuses shared resources
  private copyToScreen(texture: THREE.Texture): void {
    // Create copy material lazily (only once)
    if (!this.copyMaterial) {
      this.copyMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        depthWrite: false,
        depthTest: false
      });
    } else {
      this.copyMaterial.map = texture;
    }
    
    // Use shared fullscreen quad
    this.fsQuad.material = this.copyMaterial;
    
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.fsScene, this.fsCamera);
  }

  // Mark a region as dirty for probe updates
  markRegionDirty(bounds: THREE.Box3): number {
    return this.probeManager?.markRegionDirty(bounds) ?? 0;
  }
  
  // Reset TAA history (call on camera cut/teleport)
  resetTAA(): void {
    this.taaEffect?.reset();
    this.velocityBufferEffect?.reset();
  }

  dispose() {
    if (this.debugLogging) console.log('[RenderPipeline] Disposing...');
    
    // Dispose core render targets
    this.depthTarget?.dispose();
    this.normalTarget?.dispose();
    this.albedoTarget?.dispose();
    this.directTarget?.dispose();
    this.preComposeTarget?.dispose();
    this.postProcessTarget?.dispose();
    
    // Dispose effects (check if created)
    this.ssaoEffect?.dispose();
    this.ssgiEffect?.dispose();
    this.probeLightingEffect?.dispose();
    this.compositionEffect?.dispose();
    this.velocityBufferEffect?.dispose();
    this.taaEffect?.dispose();
    this.sharpenEffect?.dispose();
    this.autoExposureEffect?.dispose();
    this.bloomEffect?.dispose();
    this.colorGradingEffect?.dispose();
    this.filmEffectsEffect?.dispose();
    
    // Dispose probe manager
    this.probeManager?.dispose();
    
    // Dispose material cache
    this.materialCache?.dispose();
    
    // Dispose shared fullscreen resources
    this.fsQuadGeometry?.dispose();
    this.bloomCombineMaterial?.dispose();
    this.copyMaterial?.dispose();
    
    // Clear maps
    this.originalMaterials.clear();
    
    // Null out references
    this.ssaoEffect = null;
    this.ssgiEffect = null;
    this.probeLightingEffect = null;
    this.compositionEffect = null;
    this.velocityBufferEffect = null;
    this.taaEffect = null;
    this.sharpenEffect = null;
    this.autoExposureEffect = null;
    this.bloomEffect = null;
    this.colorGradingEffect = null;
    this.filmEffectsEffect = null;
    this.probeManager = null;
    this.bloomCombineMaterial = null;
    this.copyMaterial = null;
    
    console.log('[RenderPipeline] Disposed');
  }
}
