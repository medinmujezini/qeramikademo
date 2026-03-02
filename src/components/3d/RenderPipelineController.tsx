// RenderPipelineController - Integrates HDRP-style pipeline with React Three Fiber
// This component hooks into R3F's render loop for Unity HDRP-level graphics

import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { HDRPPipeline, HDRPPipelineConfig } from '@/webgpu/HDRPPipeline';
import { GIQualityTier, QUALITY_PRESETS } from '@/gi/GIConfig';

export interface RuntimeQualitySettings {
  // SSAO
  ssaoEnabled?: boolean;
  ssaoRadius?: number;
  ssaoIntensity?: number;
  ssaoSamples?: number;
  ssaoBias?: number;
  ssaoBlurSharpness?: number;
  // Shadows
  shadowSoftness?: number;
  shadowIntensity?: number;
  shadowDarkness?: number;
  contactShadowsEnabled?: boolean;
  contactShadowsIntensity?: number;
  // Lighting
  skyLightIntensity?: number;
  // SSR
  ssrEnabled?: boolean;
  // Bloom
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  // Fake Mobile Bloom
  fakeMobileBloomEnabled?: boolean;
  fakeMobileBloomIntensity?: number;
  // Color Grading
  colorGradingEnabled?: boolean;
  contrast?: number;
  saturation?: number;
  brightness?: number;
  // Film Effects
  vignetteEnabled?: boolean;
  vignetteIntensity?: number;
  grainEnabled?: boolean;
  grainIntensity?: number;
}

interface RenderPipelineControllerProps {
  enabled: boolean;
  quality: GIQualityTier;
  debugMode?: number;
  runtimeSettings?: RuntimeQualitySettings;
  onError?: (error: Error) => void;
}

// Initialization stages for progressive resource creation
type InitStage = 0 | 1 | 2 | 3;
const INIT_STAGES = {
  WAITING: 0 as InitStage,
  READY_TO_CREATE: 1 as InitStage,
  PIPELINE_CREATED: 2 as InitStage,
  FULLY_INITIALIZED: 3 as InitStage,
};

/**
 * Map GI quality tier to HDRP pipeline config
 */
function configFromQuality(quality: GIQualityTier): Partial<HDRPPipelineConfig> {
  const preset = QUALITY_PRESETS[quality];
  
  // CRITICAL: Cap SSAO intensity to prevent higher quality = darker scene
  // Higher quality should improve detail via samples/blur, not by crushing blacks
  const ssaoIntensity = Math.min(preset.ssao.intensity, 1.0);
  
  // Scale samples with quality for better detail without darkening
  const ssaoSamples = quality === 'high' ? 32 : quality === 'medium' ? 16 : 8;
  const ssaoBias = quality === 'high' ? 0.015 : 0.025;
  // Very high blur sharpness for smooth denoising
  const ssaoBlurSharpness = quality === 'high' ? 12.0 : quality === 'medium' ? 6.0 : 4.0;
  
  return {
    ssaoEnabled: preset.ssao.enabled,
    ssaoRadius: preset.ssao.radius,
    ssaoIntensity: ssaoIntensity,
    ssaoSamples: ssaoSamples,
    ssaoBias: ssaoBias,
    ssaoBlurSharpness: ssaoBlurSharpness,
    ssrEnabled: quality !== 'low', // SSR only on medium+
    ssrMaxDistance: quality === 'high' ? 15.0 : 8.0,
    ssrMaxSteps: quality === 'high' ? 96 : 32,
    contactShadowsEnabled: true, // Always on for soft shadows
    contactShadowsIntensity: quality === 'high' ? 0.25 : 0.35, // Softer at high quality
    bloomEnabled: preset.postProcessing.bloom.enabled,
    bloomIntensity: preset.postProcessing.bloom.intensity,
    // Soft shadow settings
    shadowSoftness: quality === 'high' ? 2.0 : quality === 'medium' ? 1.5 : 1.0,
  };
}

/**
 * RenderPipelineController
 * 
 * Properly integrates the HDRP-style deferred rendering pipeline with React Three Fiber.
 * Handles initialization, resize, and render loop integration.
 * 
 * Features when enabled:
 * - Deferred G-Buffer rendering
 * - SSAO (Screen Space Ambient Occlusion)
 * - SSR (Screen Space Reflections)
 * - Contact Shadows
 * - IBL (Image-Based Lighting)
 * - Forward+ for transparents
 * - Tone mapping and gamma correction
 * - Debug visualization modes
 */
export function RenderPipelineController({ 
  enabled, 
  quality,
  debugMode = 0,
  runtimeSettings,
  onError 
}: RenderPipelineControllerProps) {
  const { gl, scene, camera, size } = useThree();
  const pipelineRef = useRef<HDRPPipeline | null>(null);
  const [initStage, setInitStage] = useState<InitStage>(INIT_STAGES.WAITING);
  const lastQualityRef = useRef<GIQualityTier>(quality);
  const lastEnabledRef = useRef(enabled);
  const contextLostRef = useRef(false);
  const defaultLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Add default directional light if scene has none
  useEffect(() => {
    if (!scene) return;
    
    let hasDirectional = false;
    scene.traverse((obj) => {
      if (obj instanceof THREE.DirectionalLight && obj.name !== '__hdrp_default_sun__') {
        hasDirectional = true;
      }
    });
    
    if (!hasDirectional && !defaultLightRef.current) {
      const sun = new THREE.DirectionalLight(0xffffff, 3);
      sun.position.set(5, 10, 7);
      sun.name = '__hdrp_default_sun__';
      scene.add(sun);
      defaultLightRef.current = sun;
      console.log('[HDRPPipeline] Added default directional light');
    }
    
    return () => {
      if (defaultLightRef.current) {
        scene.remove(defaultLightRef.current);
        defaultLightRef.current = null;
      }
    };
  }, [scene]);

  // Handle WebGL context loss/restore
  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.error('[HDRPPipeline] WebGL context lost - disposing pipeline');
      contextLostRef.current = true;
      
      // Dispose pipeline safely
      if (pipelineRef.current) {
        try {
          pipelineRef.current.dispose();
        } catch (e) {
          console.warn('[HDRPPipeline] Error during context loss cleanup:', e);
        }
        pipelineRef.current = null;
      }
      
      // Reset initialization
      setInitStage(INIT_STAGES.WAITING);
      onError?.(new Error('WebGL context lost'));
    };
    
    const handleContextRestored = () => {
      console.log('[HDRPPipeline] WebGL context restored - will reinitialize');
      contextLostRef.current = false;
      // Reset to trigger re-initialization
      setInitStage(INIT_STAGES.WAITING);
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [gl, onError]);

  // Progressive initialization - stage 1: wait a frame to let scene settle
  useEffect(() => {
    if (!enabled || contextLostRef.current) {
      return;
    }

    if (initStage === INIT_STAGES.WAITING) {
      // Wait 100ms before starting initialization to let scene settle
      const timer = setTimeout(() => {
        setInitStage(INIT_STAGES.READY_TO_CREATE);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enabled, initStage]);

  // Progressive initialization - stage 2: create pipeline
  useEffect(() => {
    if (!enabled || contextLostRef.current) {
      return;
    }

    if (initStage !== INIT_STAGES.READY_TO_CREATE) {
      return;
    }

    if (!(camera instanceof THREE.PerspectiveCamera)) {
      console.warn('[HDRPPipeline] Camera is not a PerspectiveCamera');
      return;
    }

    // Dispose existing pipeline if quality changed
    if (pipelineRef.current && lastQualityRef.current !== quality) {
      console.log('[HDRPPipeline] Quality changed, disposing old pipeline');
      pipelineRef.current.dispose();
      pipelineRef.current = null;
    }

    lastQualityRef.current = quality;

    // Skip if already have pipeline
    if (pipelineRef.current) {
      setInitStage(INIT_STAGES.FULLY_INITIALIZED);
      return;
    }

    // Get config from quality preset
    const config = configFromQuality(quality);

    try {
      console.log(`[HDRPPipeline] Creating pipeline at ${quality} quality`);
      
      // Create new HDRP pipeline
      pipelineRef.current = new HDRPPipeline(
        gl as THREE.WebGLRenderer,
        scene,
        camera,
        config
      );

      // Set initial size
      if (size.width > 0 && size.height > 0) {
        pipelineRef.current.setSize(size.width, size.height);
      }

      // Apply initial debug mode
      if (debugMode !== 0) {
        pipelineRef.current.setDebugMode(debugMode);
        console.log('[HDRPPipeline] Applied initial debug mode:', debugMode);
      }

      console.log(`[HDRPPipeline] Initialized successfully`);
      setInitStage(INIT_STAGES.PIPELINE_CREATED);
      
      // Wait another frame before marking fully initialized
      setTimeout(() => {
        setInitStage(INIT_STAGES.FULLY_INITIALIZED);
      }, 50);
      
    } catch (error) {
      console.error('[HDRPPipeline] Failed to initialize:', error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
      pipelineRef.current = null;
      setInitStage(INIT_STAGES.WAITING);
    }
  }, [gl, scene, camera, quality, enabled, size, onError, initStage]);

  // Handle enable/disable changes
  useEffect(() => {
    if (lastEnabledRef.current !== enabled) {
      lastEnabledRef.current = enabled;
      
      if (!enabled && pipelineRef.current) {
        // Dispose when disabled
        console.log('[HDRPPipeline] Disabled, disposing pipeline');
        pipelineRef.current.dispose();
        pipelineRef.current = null;
        setInitStage(INIT_STAGES.WAITING);
      } else if (enabled && !pipelineRef.current) {
        // Re-enable - trigger initialization
        setInitStage(INIT_STAGES.WAITING);
      }
    }
  }, [enabled]);

  // Handle resize
  useEffect(() => {
    if (pipelineRef.current && size.width > 0 && size.height > 0) {
      pipelineRef.current.setSize(size.width, size.height);
    }
  }, [size.width, size.height]);

  // Handle quality changes at runtime
  useEffect(() => {
    if (pipelineRef.current && lastQualityRef.current !== quality) {
      const config = configFromQuality(quality);
      pipelineRef.current.updateConfig(config);
      lastQualityRef.current = quality;
    }
  }, [quality]);

  // Handle debug mode changes - also re-apply after pipeline init/recreation
  useEffect(() => {
    if (pipelineRef.current && initStage >= INIT_STAGES.PIPELINE_CREATED) {
      pipelineRef.current.setDebugMode(debugMode);
    }
  }, [debugMode, initStage]);

  // Handle runtime settings changes
  useEffect(() => {
    if (pipelineRef.current && runtimeSettings && initStage >= INIT_STAGES.PIPELINE_CREATED) {
      pipelineRef.current.updateConfig(runtimeSettings as Partial<HDRPPipelineConfig>);
    }
  }, [runtimeSettings, initStage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipelineRef.current) {
        console.log('[HDRPPipeline] Unmounting, disposing pipeline');
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
    };
  }, []);

  // Custom render loop - replaces default R3F render
  useFrame(() => {
    // Skip if context lost
    if (contextLostRef.current) {
      return;
    }

    // Skip if not enabled or not fully initialized
    if (!enabled || initStage < INIT_STAGES.PIPELINE_CREATED || !pipelineRef.current) {
      // Fallback to default Three.js rendering
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }

    try {
      // Use HDRP pipeline
      pipelineRef.current.render();
    } catch (error) {
      console.error('[HDRPPipeline] Render error:', error);
      // Fallback to basic rendering on error
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      
      // If we get repeated errors, disable the pipeline
      if (error instanceof Error && error.message.includes('context')) {
        onError?.(error);
      }
    }
  }, 100); // High priority = runs after scene updates but handles rendering

  return null; // This is a controller component, renders nothing
}

/**
 * BasicLighting - Fallback component that does nothing
 * Lights are now always included in the scene - this is kept for backward compatibility
 */
export function BasicLighting() {
  return null;
}
