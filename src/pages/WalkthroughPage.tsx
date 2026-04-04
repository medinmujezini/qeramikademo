import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { sendToUnreal, onExitWalkthrough } from '@/utils/unrealBridge';

const WalkthroughPage = () => {
  const navigate = useNavigate();

  // Apply full transparency on mount
  useEffect(() => {
    document.documentElement.classList.add('unreal-transparent');
    document.body.classList.add('unreal-transparent');
    return () => {
      document.documentElement.classList.remove('unreal-transparent');
      document.body.classList.remove('unreal-transparent');
    };
  }, []);

  // Listen for Unreal exit signal
  useEffect(() => {
    return onExitWalkthrough(() => {
      navigate('/design');
    });
  }, [navigate]);

  const handleExit = () => {
    sendToUnreal('exitWalkthrough');
    navigate('/design');
  };

  return (
    <div className="fixed inset-0 bg-transparent">
      {/* Minimal header — transparent, only brand + exit */}
      <div className="absolute top-0 left-0 right-0 h-11 flex items-center justify-between px-4 bg-transparent z-10">
        <span className="text-xs font-display uppercase tracking-[0.2em] text-foreground/40">
          qeramika
        </span>
      </div>

      {/* Unreal status badge — above 0.333 alpha threshold for interactivity */}
      <div className="absolute top-4 right-4 z-50">
        <div data-unreal-opaque className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-display text-foreground/80 uppercase tracking-wider">
            Running in Unreal Engine
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleExit}>
            <X className="h-3 w-3 mr-1" />
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalkthroughPage;
