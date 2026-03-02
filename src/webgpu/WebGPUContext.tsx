// WebGPU Renderer Context
// Provides access to WebGPU renderer, render targets, and capabilities

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RendererCapabilities } from './capabilities';

// Render target configuration for G-Buffer
export interface GBufferTargets {
  // Separate render targets (MRT not available in Three.js 0.160)
  depth: THREE.WebGLRenderTarget | null;
  normal: THREE.WebGLRenderTarget | null;
  albedo: THREE.WebGLRenderTarget | null;
}

// SSGI ping-pong buffers
export interface SSGIBuffers {
  current: THREE.WebGLRenderTarget | null;
  history: THREE.WebGLRenderTarget | null;
}

export interface WebGPUContextValue {
  // Renderer state
  isWebGPU: boolean;
  isInitialized: boolean;
  capabilities: RendererCapabilities | null;
  
  // Renderer reference (set by WebGPUCanvas)
  renderer: THREE.WebGLRenderer | null;
  setRenderer: (renderer: THREE.WebGLRenderer | null) => void;
  
  // Render targets
  gBuffer: GBufferTargets;
  ssgiBuffers: SSGIBuffers;
  
  // Resolution management
  resolution: THREE.Vector2;
  setResolution: (width: number, height: number) => void;
  
  // Frame state
  frameIndex: number;
  incrementFrame: () => void;
  
  // Render target management
  initializeRenderTargets: (width: number, height: number) => void;
  disposeRenderTargets: () => void;
  swapSSGIBuffers: () => void;
}

const WebGPUContext = createContext<WebGPUContextValue | null>(null);

export const useWebGPU = (): WebGPUContextValue => {
  const context = useContext(WebGPUContext);
  if (!context) {
    throw new Error('useWebGPU must be used within a WebGPUProvider');
  }
  return context;
};

export const useWebGPUOptional = (): WebGPUContextValue | null => {
  return useContext(WebGPUContext);
};

interface WebGPUProviderProps {
  children: React.ReactNode;
  capabilities?: RendererCapabilities | null;
}

export const WebGPUProvider: React.FC<WebGPUProviderProps> = ({
  children,
  capabilities = null,
}) => {
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [resolution, setResolutionState] = useState(new THREE.Vector2(1, 1));
  const [frameIndex, setFrameIndex] = useState(0);
  
  // Render targets refs
  const gBufferRef = useRef<GBufferTargets>({
    depth: null,
    normal: null,
    albedo: null,
  });
  
  const ssgiBuffersRef = useRef<SSGIBuffers>({
    current: null,
    history: null,
  });

  const setResolution = useCallback((width: number, height: number) => {
    setResolutionState(new THREE.Vector2(width, height));
  }, []);

  const incrementFrame = useCallback(() => {
    setFrameIndex(prev => prev + 1);
  }, []);

  // Dispose render targets helper
  const disposeRenderTargets = useCallback(() => {
    // Dispose G-Buffer
    gBufferRef.current.depth?.dispose();
    gBufferRef.current.normal?.dispose();
    gBufferRef.current.albedo?.dispose();
    
    // Dispose SSGI buffers
    ssgiBuffersRef.current.current?.dispose();
    ssgiBuffersRef.current.history?.dispose();

    // Reset refs
    gBufferRef.current = {
      depth: null,
      normal: null,
      albedo: null,
    };
    ssgiBuffersRef.current = {
      current: null,
      history: null,
    };

    setIsInitialized(false);
  }, []);

  // Initialize G-Buffer and render targets
  const initializeRenderTargets = useCallback((width: number, height: number) => {
    // Dispose existing targets
    disposeRenderTargets();

    // G-Buffer render targets (separate targets since MRT not available in Three.js 0.160)
    const gBufferOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    };

    // Depth buffer
    gBufferRef.current.depth = new THREE.WebGLRenderTarget(width, height, {
      ...gBufferOptions,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(width, height, THREE.FloatType),
    });
    gBufferRef.current.depth.texture.name = 'gBuffer-depth';

    // Normal + Roughness buffer
    gBufferRef.current.normal = new THREE.WebGLRenderTarget(width, height, gBufferOptions);
    gBufferRef.current.normal.texture.name = 'gBuffer-normal-roughness';

    // Albedo + AO buffer
    gBufferRef.current.albedo = new THREE.WebGLRenderTarget(width, height, gBufferOptions);
    gBufferRef.current.albedo.texture.name = 'gBuffer-albedo-ao';

    // SSGI ping-pong buffers for temporal reprojection
    const ssgiOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    };

    ssgiBuffersRef.current.current = new THREE.WebGLRenderTarget(width, height, ssgiOptions);
    ssgiBuffersRef.current.current.texture.name = 'ssgi-current';

    ssgiBuffersRef.current.history = new THREE.WebGLRenderTarget(width, height, ssgiOptions);
    ssgiBuffersRef.current.history.texture.name = 'ssgi-history';

    setResolutionState(new THREE.Vector2(width, height));
    setIsInitialized(true);
  }, [disposeRenderTargets]);

  // Swap SSGI buffers for temporal accumulation
  const swapSSGIBuffers = useCallback(() => {
    const temp = ssgiBuffersRef.current.current;
    ssgiBuffersRef.current.current = ssgiBuffersRef.current.history;
    ssgiBuffersRef.current.history = temp;
  }, []);

  const value = useMemo<WebGPUContextValue>(() => ({
    isWebGPU: capabilities?.webgpu ?? false,
    isInitialized,
    capabilities,
    renderer,
    setRenderer,
    gBuffer: gBufferRef.current,
    ssgiBuffers: ssgiBuffersRef.current,
    resolution,
    setResolution,
    frameIndex,
    incrementFrame,
    initializeRenderTargets,
    disposeRenderTargets,
    swapSSGIBuffers,
  }), [
    capabilities,
    isInitialized,
    renderer,
    resolution,
    frameIndex,
    initializeRenderTargets,
    disposeRenderTargets,
    swapSSGIBuffers,
  ]);

  return (
    <WebGPUContext.Provider value={value}>
      {children}
    </WebGPUContext.Provider>
  );
};

export default WebGPUContext;
