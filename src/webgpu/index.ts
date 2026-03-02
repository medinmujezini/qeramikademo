// WebGPU System Exports

// Capabilities detection
export {
  type WebGPUCapabilities,
  type RendererCapabilities,
  checkWebGPUSupport,
  getRendererCapabilities,
  recommendQualityTier,
} from './capabilities';

// Context and provider
export {
  WebGPUProvider,
  useWebGPU,
  useWebGPUOptional,
  type WebGPUContextValue,
  type GBufferTargets,
  type SSGIBuffers,
} from './WebGPUContext';

// Canvas component
export {
  WebGPUCanvas,
  type WebGPUCanvasProps,
} from './WebGPUCanvas';

// Render pipeline
export {
  RenderPipeline,
  configFromGI,
  type RenderPipelineConfig,
} from './RenderPipeline';

// Probe volume manager
export {
  ProbeVolumeManager,
  type ProbeData,
  type ProbeVolumeData,
} from './ProbeVolumeManager';

// Materials
export {
  createNormalRoughnessMaterial,
  createAlbedoAOMaterial,
  createDepthMaterial,
  GBufferMaterialCache,
  type GBufferMaterialParams,
} from './materials';

// Effects
export {
  SSAOEffect,
  SSGIEffect,
  CompositionEffect,
  VelocityBufferEffect,
  TAAEffect,
  SharpenEffect,
  AutoExposureEffect,
  BloomEffect,
  ColorGradingEffect,
  FilmEffectsEffect,
  type SSAOEffectParams,
  type SSGIEffectParams,
  type CompositionEffectParams,
  type VelocityBufferParams,
  type TAAEffectParams,
  type SharpenEffectParams,
  type AutoExposureParams,
  type BloomEffectParams,
  type ColorGradingParams,
  type FilmEffectsParams,
} from './effects';

// Culling system
export {
  HiZPyramid,
  OcclusionCuller,
  FrustumCuller,
  type HiZPyramidConfig,
  type CullableObject,
  type OcclusionCullerConfig,
} from './culling';

// Shadow system
export {
  CascadedShadowMap,
  type CSMConfig,
} from './shadows';

// Utils
export {
  JitterManager,
  getJitterOffset,
  halton,
  applyJitter,
  removeJitter,
  HALTON_SEQUENCE_16,
} from './utils/JitterSequence';
