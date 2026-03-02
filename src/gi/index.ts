// GI System Exports
export { GIProvider, useGI, useGIOptional } from './GIContext';
export { GIQualitySelector } from './components/GIQualitySelector';
export { 
  type GIConfig, 
  type GIQualityTier, 
  QUALITY_PRESETS, 
  DEFAULT_GI_CONFIG,
  getGIConfig 
} from './GIConfig';
export { 
  type ProbeVolume, 
  type IrradianceProbe,
  generateProbeVolume,
  createProbeTexture,
  sampleIrradiance,
  markProbesDirty 
} from './ProbeVolume';
export { DirtyRegionTracker } from './DirtyRegionTracker';

// Shaders
export { createGBufferMaterial, createGBufferMaterialMRT } from './shaders/GBufferMaterial';
export { createSSGIMaterial, createSSGIUniforms } from './shaders/SSGIShader';
export { createBilateralDenoiseMaterial, createBilateralDenoiseUniforms } from './shaders/BilateralDenoiseShader';
export { createProbeSampleMaterial, createProbeSampleUniforms } from './shaders/ProbeSampleShader';
export { createCompositionMaterial, createCompositionUniforms } from './shaders/CompositionShader';
export { createSSAOMaterial, createSSAOUniforms, createSSAOBlurMaterial } from './shaders/SSAOShader';
