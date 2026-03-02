import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCw, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface BlueprintNormalizeStepProps {
  imageUrl: string;
  onComplete: (normalizedImage: string, rotation: number) => void;
  onBack: () => void;
}

export const BlueprintNormalizeStep: React.FC<BlueprintNormalizeStepProps> = ({
  imageUrl,
  onComplete,
  onBack,
}) => {
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawRotated(0);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawRotated = useCallback((angle: number) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate rotated dimensions
    const radians = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    const newWidth = img.width * cos + img.height * sin;
    const newHeight = img.width * sin + img.height * cos;

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, newWidth, newHeight);

    ctx.save();
    ctx.translate(newWidth / 2, newHeight / 2);
    ctx.rotate(radians);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }, []);

  const handleRotationChange = useCallback((values: number[]) => {
    const newRotation = values[0];
    setRotation(newRotation);
    drawRotated(newRotation);
  }, [drawRotated]);

  const rotateBy = useCallback((degrees: number) => {
    const newRotation = (rotation + degrees + 360) % 360;
    setRotation(newRotation);
    drawRotated(newRotation);
  }, [rotation, drawRotated]);

  const handleNext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const normalizedImage = canvas.toDataURL('image/png');
    onComplete(normalizedImage, rotation);
  }, [rotation, onComplete]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden p-4 flex items-center justify-center bg-muted/30">
        <div className="relative max-w-full max-h-full overflow-auto">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto border border-border rounded"
            style={{ maxHeight: 'calc(100vh - 320px)' }}
          />
        </div>
      </div>
      
      <div className="p-4 border-t bg-background">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => rotateBy(-90)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <div className="flex-1">
              <Slider
                value={[rotation]}
                onValueChange={handleRotationChange}
                min={0}
                max={360}
                step={1}
              />
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => rotateBy(90)}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            Rotation: {rotation}°
          </div>
        </div>
        
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};
