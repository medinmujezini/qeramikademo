import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { initProductView } from '@/product-view/main';

interface ProductViewState {
  id?: string;
  name?: string;
  dimensions?: { width: number; depth: number; height: number };
  color?: string;
  modelUrl?: string;
}

const ProductView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const furnitureData = location.state as ProductViewState | null;
  
  const dimensions = furnitureData?.dimensions || { width: 150, depth: 85, height: 80 };
  const color = furnitureData?.color || '#8B7355';
  const name = furnitureData?.name || 'Product 3D View';
  const modelUrl = furnitureData?.modelUrl;

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const init = async () => {
      try {
        cleanupRef.current = await initProductView(canvasRef.current!, {
          name,
          dimensions,
          color,
          modelUrl,
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize product view:', error);
        setIsLoading(false);
      }
    };
    
    init();
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [name, dimensions, color, modelUrl]);

  return (
    <div className="relative w-full h-screen bg-background overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="bg-background/80 backdrop-blur-sm">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-md">
          <Box className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{name}</h1>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{modelUrl ? 'Loading 3D Model...' : 'Initializing Raytracer...'}</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur-sm rounded-lg p-4 max-w-xs">
        <h2 className="font-medium text-foreground mb-2">{name}</h2>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Width: {dimensions.width} cm</p>
          <p>Depth: {dimensions.depth} cm</p>
          <p>Height: {dimensions.height} cm</p>
        </div>
        {modelUrl && (
          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
            <Box className="h-3 w-3" />
            <span>Raytraced GLB Model</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default ProductView;
