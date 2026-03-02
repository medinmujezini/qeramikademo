// Global Illumination Configuration System
// Defines quality tiers and all GI-related settings including post-processing

export type GIQualityTier = 'low' | 'medium' | 'high';

export interface SSGIConfig {
  enabled: boolean;
  raysPerPixel: number;        // 4 (low), 8 (med), 16 (high)
  rayLength: number;           // Short: 2-3 meters to prevent light leaks
  raySteps: number;            // Ray march steps
  temporalBlend: number;       // 0.85-0.95 for stability
  denoiseStrength: number;     // Edge-aware bilateral strength
  denoiseRadius: number;       // Kernel radius
  emissiveBoost: number;       // Multiplier for emissive injection
}

export interface ProbeConfig {
  enabled: boolean;
  spacing: number;             // 1.0-1.5 meters
  updateBudget: number;        // 3-6 (low), 6-12 (high) per frame
  shOrder: number;             // 1 (L1 = 4 coeffs) or 2 (L2 = 9 coeffs)
  blendSpeed: number;          // Temporal blend for smooth transitions
  cubemapResolution: number;   // Resolution for probe cubemaps
  wallRelocation: boolean;     // Enable probe relocation away from walls
  minWallDistance: number;     // Minimum distance from walls (meters)
}

export interface SSAOConfig {
  enabled: boolean;
  radius: number;
  intensity: number;
  samples: number;
  bias: number;
}

export interface RoomTintConfig {
  enabled: boolean;
  intensity: number;           // 0.1-0.3 subtle
  sampleRadius: number;        // World space radius for color sampling
}

export interface TAAConfig {
  enabled: boolean;
  renderScale: number;         // 0.7-1.0 for TSR-style upscaling
  historyWeight: number;       // 0.9-0.95 typical
  varianceClipGamma: number;   // 1.0-1.5 (higher = more ghosting, less flicker)
  sharpness: number;           // 0.0-0.5 CAS sharpening after TAA
}

// Post-processing configuration
export interface AutoExposureConfig {
  enabled: boolean;
  minExposure: number;
  maxExposure: number;
  adaptationSpeed: number;
  exposureCompensation: number;
}

export interface BloomConfig {
  enabled: boolean;
  threshold: number;
  softThreshold: number;
  intensity: number;
  levels: number;
}

export interface ColorGradingConfig {
  enabled: boolean;
  contrast: number;
  saturation: number;
  brightness: number;
}

export interface FilmEffectsConfig {
  grainEnabled: boolean;
  grainIntensity: number;
  grainSize: number;
  vignetteEnabled: boolean;
  vignetteIntensity: number;
  vignetteSmoothness: number;
}

export interface PostProcessingConfig {
  autoExposure: AutoExposureConfig;
  bloom: BloomConfig;
  colorGrading: ColorGradingConfig;
  filmEffects: FilmEffectsConfig;
}

export interface GIConfig {
  enabled: boolean;
  qualityTier: GIQualityTier;
  ssgi: SSGIConfig;
  probes: ProbeConfig;
  ssao: SSAOConfig;
  roomTint: RoomTintConfig;
  taa: TAAConfig;
  postProcessing: PostProcessingConfig;
}

// Quality presets optimized for room editors
export const QUALITY_PRESETS: Record<GIQualityTier, GIConfig> = {
  low: {
    enabled: true,
    qualityTier: 'low',
    ssgi: {
      enabled: true,
      raysPerPixel: 4,
      rayLength: 2.0,
      raySteps: 16,
      temporalBlend: 0.9,
      denoiseStrength: 1.0,
      denoiseRadius: 2,
      emissiveBoost: 1.0,
    },
    probes: {
      enabled: true,
      spacing: 1.5,
      updateBudget: 3,
      shOrder: 1,
      blendSpeed: 0.1,
      cubemapResolution: 32,
      wallRelocation: true,
      minWallDistance: 0.3,
    },
    ssao: { 
      enabled: true, 
      radius: 0.8, 
      intensity: 1.8,
      samples: 8,
      bias: 0.025,
    },
    roomTint: { 
      enabled: true, 
      intensity: 0.15, 
      sampleRadius: 3.0 
    },
    taa: {
      enabled: true,
      renderScale: 0.7,
      historyWeight: 0.9,
      varianceClipGamma: 1.25,
      sharpness: 0.4,
    },
    postProcessing: {
      autoExposure: {
        enabled: true,
        minExposure: 0.5,
        maxExposure: 2.0,
        adaptationSpeed: 0.5,
        exposureCompensation: 0.0,
      },
      bloom: {
        enabled: true,
        threshold: 0.9,
        softThreshold: 0.5,
        intensity: 0.2,
        levels: 4,
      },
      colorGrading: {
        enabled: true,
        contrast: 1.1,
        saturation: 1.1,
        brightness: 1.0,
      },
      filmEffects: {
        grainEnabled: false,
        grainIntensity: 0.03,
        grainSize: 1.5,
        vignetteEnabled: true,
        vignetteIntensity: 0.55,
        vignetteSmoothness: 0.65,
      },
    },
  },
  medium: {
    enabled: true,
    qualityTier: 'medium',
    ssgi: {
      enabled: true,
      raysPerPixel: 8,
      rayLength: 2.5,
      raySteps: 24,
      temporalBlend: 0.9,
      denoiseStrength: 0.8,
      denoiseRadius: 3,
      emissiveBoost: 1.5,
    },
    probes: {
      enabled: true,
      spacing: 1.25,
      updateBudget: 6,
      shOrder: 1,
      blendSpeed: 0.15,
      cubemapResolution: 64,
      wallRelocation: true,
      minWallDistance: 0.3,
    },
    ssao: { 
      enabled: true, 
      radius: 1.0, 
      intensity: 2.0,
      samples: 16,
      bias: 0.02,
    },
    roomTint: { 
      enabled: true, 
      intensity: 0.2, 
      sampleRadius: 4.0 
    },
    taa: {
      enabled: true,
      renderScale: 0.85,
      historyWeight: 0.9,
      varianceClipGamma: 1.25,
      sharpness: 0.35,
    },
    postProcessing: {
      autoExposure: {
        enabled: true,
        minExposure: 0.25,
        maxExposure: 4.0,
        adaptationSpeed: 1.0,
        exposureCompensation: 0.0,
      },
      bloom: {
        enabled: true,
        threshold: 0.8,
        softThreshold: 0.5,
        intensity: 0.3,
        levels: 5,
      },
      colorGrading: {
        enabled: true,
        contrast: 1.1,
        saturation: 1.1,
        brightness: 1.0,
      },
      filmEffects: {
        grainEnabled: false,
        grainIntensity: 0.05,
        grainSize: 1.5,
        vignetteEnabled: true,
        vignetteIntensity: 0.55,
        vignetteSmoothness: 0.65,
      },
    },
  },
  high: {
    enabled: true,
    qualityTier: 'high',
    ssgi: {
      enabled: true,
      raysPerPixel: 16,
      rayLength: 3.0,
      raySteps: 32,
      temporalBlend: 0.95,        // Very high temporal stability
      denoiseStrength: 1.5,       // Very high denoising
      denoiseRadius: 6,           // Large denoise kernel
      emissiveBoost: 2.0,
    },
    probes: {
      enabled: true,
      spacing: 1.0,
      updateBudget: 12,
      shOrder: 2,
      blendSpeed: 0.2,
      cubemapResolution: 128,
      wallRelocation: true,
      minWallDistance: 0.25,
    },
    ssao: { 
      enabled: true, 
      radius: 1.2, 
      intensity: 2.5,
      samples: 256,
      bias: 0.015,
    },
    roomTint: { 
      enabled: true, 
      intensity: 0.25, 
      sampleRadius: 5.0 
    },
    taa: {
      enabled: true,
      renderScale: 1.0,
      historyWeight: 0.95,        // High temporal blend for smoothness
      varianceClipGamma: 1.2,     // Slightly higher for less flicker
      sharpness: 0.25,            // Less sharpening for softer look
    },
    postProcessing: {
      autoExposure: {
        enabled: true,
        minExposure: 0.1,
        maxExposure: 8.0,
        adaptationSpeed: 1.5,
        exposureCompensation: 0.0,
      },
      bloom: {
        enabled: true,
        threshold: 0.6,           // Lower threshold for more bloom
        softThreshold: 0.7,       // Softer bloom transition
        intensity: 0.5,           // Stronger bloom
        levels: 6,
      },
      colorGrading: {
        enabled: true,
        contrast: 1.2,            // Enhanced contrast
        saturation: 1.15,         // Slightly more saturation
        brightness: 1.05,         // Slight brightness boost
      },
      filmEffects: {
        grainEnabled: true,
        grainIntensity: 0.02,     // Subtle grain
        grainSize: 1.0,
        vignetteEnabled: true,
        vignetteIntensity: 0.45,  // Softer vignette
        vignetteSmoothness: 0.75, // Smoother falloff
      },
    },
  },
};

// Default configuration
export const DEFAULT_GI_CONFIG: GIConfig = QUALITY_PRESETS.medium;

// Helper to get config for a quality tier
export function getGIConfig(tier: GIQualityTier): GIConfig {
  return QUALITY_PRESETS[tier];
}

// Helper to merge partial config
export function mergeGIConfig(base: GIConfig, partial: Partial<GIConfig>): GIConfig {
  return {
    ...base,
    ...partial,
    ssgi: { ...base.ssgi, ...partial.ssgi },
    probes: { ...base.probes, ...partial.probes },
    ssao: { ...base.ssao, ...partial.ssao },
    roomTint: { ...base.roomTint, ...partial.roomTint },
    taa: { ...base.taa, ...partial.taa },
    postProcessing: {
      autoExposure: { ...base.postProcessing.autoExposure, ...partial.postProcessing?.autoExposure },
      bloom: { ...base.postProcessing.bloom, ...partial.postProcessing?.bloom },
      colorGrading: { ...base.postProcessing.colorGrading, ...partial.postProcessing?.colorGrading },
      filmEffects: { ...base.postProcessing.filmEffects, ...partial.postProcessing?.filmEffects },
    },
  };
}
