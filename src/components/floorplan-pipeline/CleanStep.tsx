import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { binarize, applyMasks, canvasToDataURL, canvasToObjectURL } from '@/lib/floorplan-pipeline/binarize';
import type { CleanMasks } from '@/lib/floorplan-pipeline/types';

interface Props {
  image: HTMLImageElement;
  onComplete: (cleanedCanvas: HTMLCanvasElement, masks: CleanMasks) => void;
  onBack: () => void;
}

export const CleanStep: React.FC<Props> = ({ image, onComplete, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [masks, setMasks] = useState<CleanMasks | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [cleanedCanvas, setCleanedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runClean = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Binarize first
      const binary = binarize(image);

      // Compress for upload (max edge 1200px)
      const MAX = 1200;
      const w = image.naturalWidth;
      const h = image.naturalHeight;
      let sendCanvas: HTMLCanvasElement;
      if (Math.max(w, h) > MAX) {
        const s = MAX / Math.max(w, h);
        sendCanvas = document.createElement('canvas');
        sendCanvas.width = Math.round(w * s);
        sendCanvas.height = Math.round(h * s);
        sendCanvas.getContext('2d')!.drawImage(image, 0, 0, sendCanvas.width, sendCanvas.height);
      } else {
        sendCanvas = document.createElement('canvas');
        sendCanvas.width = w;
        sendCanvas.height = h;
        sendCanvas.getContext('2d')!.drawImage(image, 0, 0);
      }

      const imageBase64 = canvasToDataURL(sendCanvas, 0.85);

      const { data, error: invokeErr } = await supabase.functions.invoke('clean-floorplan', {
        body: { imageBase64, mimeType: 'image/jpeg' },
      });
      if (invokeErr) throw new Error(invokeErr.message || 'Edge function failed');
      if (data?.error) throw new Error(data.error);

      // Scale masks back up to original image resolution
      const scale = sendCanvas.width / w;
      const scaleBox = (b: any) => ({
        x: Math.round(b.x / scale),
        y: Math.round(b.y / scale),
        width: Math.round(b.width / scale),
        height: Math.round(b.height / scale),
      });
      const fullMasks: CleanMasks = {
        regionsToErase: (data.regionsToErase || []).map((b: any) => ({ ...scaleBox(b), kind: b.kind })),
        windowsToFill: (data.windowsToFill || []).map(scaleBox),
      };

      const cleaned = applyMasks(binary, fullMasks);
      const url = await canvasToObjectURL(cleaned);
      setMasks(fullMasks);
      setCleanedCanvas(cleaned);
      setCleanedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error('Cleanup failed', { description: msg });
    } finally {
      setLoading(false);
    }
  }, [image]);

  useEffect(() => { runClean(); /* eslint-disable-line */ }, []);

  useEffect(() => () => { if (cleanedUrl) URL.revokeObjectURL(cleanedUrl); }, [cleanedUrl]);

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          AI removed text, doors, furniture, and fixtures. Windows were filled to solid wall.
          Walls = black, everything else = white.
        </div>
        <Button variant="outline" size="sm" onClick={runClean} disabled={loading}>
          <RotateCw className="h-4 w-4 mr-2" />
          Re-run cleanup
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
          <img src={image.src} alt="Original" className="max-w-full max-h-full object-contain" />
        </div>
        <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <span className="text-sm">Cleaning floor plan…</span>
            </div>
          )}
          {cleanedUrl && (
            <img src={cleanedUrl} alt="Cleaned" className="max-w-full max-h-full object-contain" />
          )}
          {!loading && !cleanedUrl && error && (
            <div className="text-sm text-destructive p-4 text-center">{error}</div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button
          onClick={() => masks && cleanedCanvas && onComplete(cleanedCanvas, masks)}
          disabled={!cleanedCanvas || loading}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
