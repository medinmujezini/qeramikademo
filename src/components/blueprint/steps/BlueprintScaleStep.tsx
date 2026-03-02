import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Ruler, MousePointer } from 'lucide-react';

interface BlueprintScaleStepProps {
  imageUrl: string;
  onComplete: (pixelsPerCm: number, knownDistance: number) => void;
  onBack: () => void;
}

export const BlueprintScaleStep: React.FC<BlueprintScaleStepProps> = ({
  imageUrl,
  onComplete,
  onBack,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [knownDistance, setKnownDistance] = useState<string>('100');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pixelDistance, setPixelDistance] = useState<number | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate fit scale
    const fitScale = Math.min(
      (canvas.width - 40) / img.width,
      (canvas.height - 40) / img.height
    );
    const displayScale = fitScale * scale;

    const drawWidth = img.width * displayScale;
    const drawHeight = img.height * displayScale;
    const drawX = (canvas.width - drawWidth) / 2 + offset.x;
    const drawY = (canvas.height - drawHeight) / 2 + offset.y;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Draw calibration line
    if (startPoint && endPoint) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw endpoints
      [startPoint, endPoint].forEach((point, i) => {
        ctx.fillStyle = '#22c55e';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i === 0 ? 'A' : 'B', point.x, point.y);
      });

      // Draw distance label
      const midX = (startPoint.x + endPoint.x) / 2;
      const midY = (startPoint.y + endPoint.y) / 2;
      const dist = Math.sqrt(
        (endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2
      );

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(midX - 50, midY - 15, 100, 30);
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${dist.toFixed(0)} px`, midX, midY);

      // Calculate actual pixel distance in image coordinates
      const actualDist = dist / displayScale;
      setPixelDistance(actualDist);
    } else if (startPoint) {
      // Draw single point
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', startPoint.x, startPoint.y);
    }

    // Instructions overlay
    if (!startPoint) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(canvas.width / 2 - 150, 20, 300, 40);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click to set first point (A)', canvas.width / 2, 40);
    } else if (!endPoint) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(canvas.width / 2 - 150, 20, 300, 40);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click to set second point (B)', canvas.width / 2, 40);
    }
  }, [startPoint, endPoint, scale, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!startPoint) {
      setStartPoint({ x, y });
      setEndPoint(null);
    } else if (!endPoint) {
      setEndPoint({ x, y });
    } else {
      // Reset and start over
      setStartPoint({ x, y });
      setEndPoint(null);
    }
  }, [startPoint, endPoint]);

  const handleNext = useCallback(() => {
    if (pixelDistance === null) return;
    
    const distance = parseFloat(knownDistance);
    if (isNaN(distance) || distance <= 0) return;

    const pixelsPerCm = pixelDistance / distance;
    onComplete(pixelsPerCm, distance);
  }, [pixelDistance, knownDistance, onComplete]);

  const handleReset = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setPixelDistance(null);
  }, []);

  const isValid = startPoint && endPoint && pixelDistance !== null && parseFloat(knownDistance) > 0;

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-muted/30"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
        />
      </div>
      
      <div className="p-4 border-t bg-background">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="distance">Known distance (cm):</Label>
            </div>
            <Input
              id="distance"
              type="number"
              value={knownDistance}
              onChange={(e) => setKnownDistance(e.target.value)}
              className="w-24"
              min={1}
            />
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {!startPoint ? (
              <span className="flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Click on the image to mark the start of a known measurement
              </span>
            ) : !endPoint ? (
              <span className="flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Click to mark the end of the measurement
              </span>
            ) : (
              <span className="text-primary">
                ✓ Measurement set: {pixelDistance?.toFixed(0)} pixels = {knownDistance} cm
              </span>
            )}
          </div>
        </div>
        
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleNext} disabled={!isValid}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
