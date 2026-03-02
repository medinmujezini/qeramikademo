import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Cornell page component.
 *
 * This page renders a canvas element and lazily imports the Cornell Box
 * renderer from the `cornell` directory when the component mounts. A
 * settings toggle is provided on smaller screens to show or hide the GUI
 * controls provided by dat.gui. The majority of the implementation is
 * borrowed from the standalone Cornell Box project and integrated here
 * as a page of the main application.
 */
const Cornell = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  // Initialize Cornell Box renderer and cleanup on unmount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cleanup: (() => void) | null = null;
    let isMounted = true;

    const init = async () => {
      try {
        const { initCornell } = await import('@/cornell/main');
        if (isMounted) {
          cleanup = await initCornell(canvas);
          
          // Wait 2 seconds before starting fade-in
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (isMounted) {
            setIsLoading(false);
            // Small delay before triggering fade-in
            requestAnimationFrame(() => {
              if (isMounted) {
                setIsReady(true);
              }
            });
          }
        }
      } catch (err) {
        console.error('Failed to initialize Cornell Box:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, []);

  // Synchronize dat.gui visibility with the toggle state
  useEffect(() => {
    const syncVisibility = () => {
      const guiContainer = document.querySelector('.dg.ac') as HTMLElement | null;
      if (guiContainer) {
        guiContainer.style.display = showControls ? 'block' : 'none';
        return true;
      }
      return false;
    };

    // Try immediately, then poll until the gui container is found
    if (!syncVisibility()) {
      const checkGui = setInterval(() => {
        if (syncVisibility()) {
          clearInterval(checkGui);
        }
      }, 100);
      return () => clearInterval(checkGui);
    }
  }, [showControls]);

  // Hide the GUI initially on mobile devices
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      const hideInitially = setInterval(() => {
        const guiContainer = document.querySelector('.dg.ac') as HTMLElement | null;
        if (guiContainer) {
          guiContainer.style.display = 'none';
          clearInterval(hideInitially);
        }
      }, 50);

      // Fallback cleanup after 2 seconds
      const timeout = setTimeout(() => clearInterval(hideInitially), 2000);
      return () => {
        clearInterval(hideInitially);
        clearTimeout(timeout);
      };
    }
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black flex flex-col items-center justify-center p-4 lg:p-0 landscape:p-2 landscape:flex-row relative">
      {/* Back button */}
      <Button asChild variant="ghost" size="sm" className="absolute top-4 left-4 text-white hover:bg-white/10 z-[150]">
        <Link to="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>
      
      <h1 className="text-white text-lg font-medium mb-4 md:hidden landscape:hidden">Cornell Box WebGPU</h1>
      
      <div className="w-full max-w-[90vw] md:max-w-[70vw] lg:max-w-none lg:w-full lg:h-screen landscape:max-w-none landscape:h-[90vh] landscape:w-auto flex items-center justify-center relative">
        {/* Loading spinner overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
            <Loader2 className="h-10 w-10 text-white animate-spin mb-4" />
            <p className="text-white/70 text-sm">Initializing WebGPU...</p>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          id="cornell-canvas"
          className={`w-full aspect-square md:aspect-video lg:w-full lg:h-full landscape:h-full landscape:w-auto landscape:aspect-video block rounded-lg lg:rounded-none shadow-2xl lg:shadow-none transition-opacity duration-1000 ease-out ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Mobile controls toggle button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="lg:hidden fixed bottom-4 right-4 landscape:bottom-2 landscape:right-2 z-[150] bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white p-3 rounded-full shadow-lg transition-all duration-200 active:scale-95"
        aria-label={showControls ? 'Hide controls' : 'Show controls'}
      >
        {showControls ? <X size={24} /> : <Settings size={24} />}
      </button>
    </div>
  );
};

export default Cornell;
