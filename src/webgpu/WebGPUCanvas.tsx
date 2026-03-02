// WebGPU Canvas Component
// Wraps React Three Fiber Canvas with WebGPU renderer initialization
// Falls back to WebGL2 if WebGPU is not supported

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { Canvas, CanvasProps, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WebGPUProvider, useWebGPU } from './WebGPUContext';
import { getRendererCapabilities, RendererCapabilities, recommendQualityTier } from './capabilities';
import { GIQualityTier } from '@/gi/GIConfig';

// Internal component to set renderer in context
const RendererBridge: React.FC<{ onReady?: (renderer: THREE.WebGLRenderer) => void }> = ({ onReady }) => {
  const { gl } = useThree();
  const webgpuContext = useWebGPU();

  useEffect(() => {
    webgpuContext.setRenderer(gl);
    onReady?.(gl);
    
    return () => {
      webgpuContext.setRenderer(null);
    };
  }, [gl, webgpuContext, onReady]);

  return null;
};

// Resize handler component
const ResizeHandler: React.FC = () => {
  const { size } = useThree();
  const { initializeRenderTargets, isInitialized } = useWebGPU();

  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      initializeRenderTargets(size.width, size.height);
    }
  }, [size.width, size.height, initializeRenderTargets]);

  return null;
};

// Loading fallback
const LoadingFallback: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
    <div className="text-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Initializing 3D renderer...</p>
    </div>
  </div>
);

// WebGL fallback notice
const WebGLFallbackNotice: React.FC<{ reason?: string }> = ({ reason }) => (
  <div className="absolute top-2 left-2 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1 text-xs text-yellow-600 dark:text-yellow-400">
    WebGL mode{reason ? `: ${reason}` : ''} - Some effects limited
  </div>
);

export interface WebGPUCanvasProps extends Omit<CanvasProps, 'gl'> {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showFallbackNotice?: boolean;
  onCapabilitiesReady?: (caps: RendererCapabilities, recommendedQuality: GIQualityTier) => void;
  onRendererReady?: (renderer: THREE.WebGLRenderer) => void;
}

export const WebGPUCanvas: React.FC<WebGPUCanvasProps> = ({
  children,
  fallback,
  showFallbackNotice = true,
  onCapabilitiesReady,
  onRendererReady,
  ...canvasProps
}) => {
  const [capabilities, setCapabilities] = useState<RendererCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check capabilities on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const caps = await getRendererCapabilities();
        
        if (!mounted) return;
        
        setCapabilities(caps);
        
        const recommendedQuality = recommendQualityTier(caps);
        onCapabilitiesReady?.(caps, recommendedQuality);
        
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to initialize renderer');
        setIsLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [onCapabilitiesReady]);

  const handleRendererReady = useCallback((renderer: THREE.WebGLRenderer) => {
    // Configure renderer for quality
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    onRendererReady?.(renderer);
  }, [onRendererReady]);

  if (isLoading) {
    return (
      <div className="relative w-full h-full">
        <LoadingFallback />
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-background">
        <div className="text-center text-destructive">
          <p className="font-medium">Failed to initialize 3D renderer</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // No GPU support at all
  if (!capabilities?.webgpu && !capabilities?.webgl2) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <p className="font-medium">3D rendering not supported</p>
          <p className="text-sm mt-1">Your browser does not support WebGPU or WebGL2</p>
        </div>
      </div>
    );
  }

  return (
    <WebGPUProvider capabilities={capabilities}>
      <div className="relative w-full h-full">
        {/* Show WebGL fallback notice */}
        {showFallbackNotice && !capabilities.webgpu && capabilities.webgl2 && (
          <WebGLFallbackNotice reason="WebGPU not available" />
        )}
        
        <Canvas
          {...canvasProps}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
        >
          <Suspense fallback={null}>
            <RendererBridge onReady={handleRendererReady} />
            <ResizeHandler />
            {children}
          </Suspense>
        </Canvas>
      </div>
    </WebGPUProvider>
  );
};

export default WebGPUCanvas;
