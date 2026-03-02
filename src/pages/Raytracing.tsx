import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, X, Loader2, AlertTriangle, MousePointer, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { useMaterialContext } from '@/contexts/MaterialContext';

const Raytracing = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { floorPlan } = useFloorPlanContext();
  const { getPreviewMaterial, previewMaterialId } = useMaterialContext();
  const [showControls, setShowControls] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [hasNoWalls, setHasNoWalls] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  const previewMaterial = getPreviewMaterial();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for empty floor plan
    const walls = floorPlan.walls.map(wall => {
      const start = floorPlan.points.find(p => p.id === wall.startPointId);
      const end = floorPlan.points.find(p => p.id === wall.endPointId);
      return {
        startX: start?.x ?? 0,
        startY: start?.y ?? 0,
        endX: end?.x ?? 0,
        endY: end?.y ?? 0,
        height: wall.height,
        thickness: wall.thickness,
      };
    }).filter(w => w.startX !== w.endX || w.startY !== w.endY);

    if (walls.length === 0) {
      setIsLoading(false);
      setHasNoWalls(true);
      return;
    }

    let cleanup: (() => void) | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const { initRaytracing } = await import('@/raytracing/main');
        
        // Prepare material data if a preview material is selected
        const materialData = previewMaterial ? {
          albedo: previewMaterial.albedo,
          normal: previewMaterial.normal,
          roughness: previewMaterial.roughness,
          metallic: previewMaterial.metallic,
          ao: previewMaterial.ao,
          arm: previewMaterial.arm,
          height: previewMaterial.height,
        } : undefined;
        
        if (isMounted) {
          cleanup = await initRaytracing(canvas, {
            walls,
            roomWidth: floorPlan.roomWidth,
            roomHeight: floorPlan.roomHeight,
          }, materialData);
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (isMounted) {
            setIsLoading(false);
            requestAnimationFrame(() => {
              if (isMounted) setIsReady(true);
            });
          }
        }
      } catch (err) {
        console.error('Failed to initialize Raytracing:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    init();
    return () => { isMounted = false; cleanup?.(); };
  }, [floorPlan, previewMaterial]);

  // Track pointer lock state for UI feedback
  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === canvasRef.current);
    };
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, []);

  useEffect(() => {
    const syncVisibility = () => {
      const guiContainer = document.querySelector('.dg.ac') as HTMLElement | null;
      if (guiContainer) { guiContainer.style.display = showControls ? 'block' : 'none'; return true; }
      return false;
    };
    if (!syncVisibility()) {
      const checkGui = setInterval(() => { if (syncVisibility()) clearInterval(checkGui); }, 100);
      return () => clearInterval(checkGui);
    }
  }, [showControls]);

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      const hideInitially = setInterval(() => {
        const guiContainer = document.querySelector('.dg.ac') as HTMLElement | null;
        if (guiContainer) { guiContainer.style.display = 'none'; clearInterval(hideInitially); }
      }, 50);
      const timeout = setTimeout(() => clearInterval(hideInitially), 2000);
      return () => { clearInterval(hideInitially); clearTimeout(timeout); };
    }
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black flex flex-col items-center justify-center p-4 lg:p-0 relative">
      <Button asChild variant="ghost" size="sm" className="absolute top-4 left-4 text-white hover:bg-white/10 z-[150]">
        <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
      </Button>

      {/* Material Preview Indicator */}
      {previewMaterial && isReady && (
        <div className="absolute top-4 right-4 z-[150] flex items-center gap-2">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
            {previewMaterial.albedo ? (
              <img 
                src={previewMaterial.albedo} 
                alt={previewMaterial.name}
                className="w-8 h-8 rounded object-cover border border-white/20"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                <Palette className="h-4 w-4 text-white/60" />
              </div>
            )}
            <div className="text-white">
              <p className="text-xs text-white/60">Previewing</p>
              <p className="text-sm font-medium">{previewMaterial.name}</p>
            </div>
            {previewMaterial.arm && (
              <Badge variant="secondary" className="text-xs ml-1">ARM</Badge>
            )}
          </div>
          <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10">
            <Link to="/admin">
              <Palette className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
      
      {/* FPS Controls hint */}
      {isReady && !isPointerLocked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-sm text-white px-6 py-4 rounded-lg text-center">
            <MousePointer className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <p className="text-lg font-medium mb-1">Click to Enter</p>
            <p className="text-sm text-white/60">WASD to move • Mouse to look • ESC to exit</p>
          </div>
        </div>
      )}
      
      <h1 className="text-white text-lg font-medium mb-4 md:hidden">Floor Plan Raytracing</h1>
      
      <div className="w-full max-w-[90vw] md:max-w-[70vw] lg:max-w-none lg:w-full lg:h-screen flex items-center justify-center relative">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
            <Loader2 className="h-10 w-10 text-white animate-spin mb-4" />
            <p className="text-white/70 text-sm">Initializing WebGPU...</p>
          </div>
        )}

        {hasNoWalls && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-white text-lg font-medium mb-2">No floor plan geometry</p>
            <p className="text-white/60 text-sm mb-6">Create walls in the floor plan editor first</p>
            <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Link to="/">Go to Floor Plan Editor</Link>
            </Button>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className={`w-full aspect-square md:aspect-video lg:w-full lg:h-full block rounded-lg lg:rounded-none shadow-2xl lg:shadow-none transition-opacity duration-1000 ease-out ${isReady ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      <button
        onClick={() => setShowControls(!showControls)}
        className="lg:hidden fixed bottom-4 right-4 z-[150] bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white p-3 rounded-full shadow-lg transition-all duration-200 active:scale-95"
      >
        {showControls ? <X size={24} /> : <Settings size={24} />}
      </button>
    </div>
  );
};

export default Raytracing;
