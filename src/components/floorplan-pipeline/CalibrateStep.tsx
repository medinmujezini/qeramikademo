import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Calibration } from '@/lib/floorplan-pipeline/types';

interface Props {
  image: HTMLImageElement;
  onComplete: (cal: Calibration) => void;
  onBack: () => void;
}

export const CalibrateStep: React.FC<Props> = ({ image, onComplete, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [meters, setMeters] = useState('1');
  const [scale, setScale] = useState(1);

  // Fit image into available area
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const maxW = parent.clientWidth;
    const maxH = parent.clientHeight;
    const s = Math.min(maxW / image.naturalWidth, maxH / image.naturalHeight, 1);
    setScale(s);
    canvas.width = image.naturalWidth * s;
    canvas.height = image.naturalHeight * s;
    redraw(s, pts);
  }, [image]);

  useEffect(() => { redraw(scale, pts); }, [pts, scale]);

  const redraw = (s: number, ps: { x: number; y: number }[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'hsl(38 90% 60%)';
    ctx.fillStyle = 'hsl(38 90% 60%)';
    if (ps.length >= 1) {
      const a = { x: ps[0].x * s, y: ps[0].y * s };
      ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (ps.length >= 2) {
      const a = { x: ps[0].x * s, y: ps[0].y * s };
      const b = { x: ps[1].x * s, y: ps[1].y * s };
      ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  };

  const handleClick: React.MouseEventHandler<HTMLCanvasElement> = (e) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setPts((prev) => (prev.length >= 2 ? [{ x, y }] : [...prev, { x, y }]));
  };

  const ready = pts.length === 2 && parseFloat(meters) > 0;

  const handleConfirm = () => {
    if (!ready) return;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const pixelDist = Math.hypot(dx, dy);
    const pixelsPerMeter = pixelDist / parseFloat(meters);
    onComplete({
      pointA: pts[0],
      pointB: pts[1],
      realMeters: parseFloat(meters),
      pixelsPerMeter,
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="text-sm text-muted-foreground">
        Click two points on the image with a known real distance between them, then enter that distance in meters.
        {pts.length === 0 && ' Click point A.'}
        {pts.length === 1 && ' Click point B.'}
        {pts.length === 2 && ' Adjust distance and confirm — or click again to restart.'}
      </div>
      <div className="flex-1 min-h-0 bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} onClick={handleClick} className="cursor-crosshair" />
      </div>
      <div className="flex items-end gap-3">
        <div className="w-40">
          <Label className="text-xs">Real distance (m)</Label>
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={meters}
            onChange={(e) => setMeters(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleConfirm} disabled={!ready} className="ml-auto">
          Continue
        </Button>
      </div>
    </div>
  );
};
