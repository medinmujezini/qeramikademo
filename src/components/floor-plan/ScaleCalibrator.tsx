import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Ruler, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScaleCalibration } from '@/types/floorPlanDigitizer';
import { createScaleCalibration, calculatePixelDistance, validateCalibration } from '@/utils/scaleCalibration';

interface ScaleCalibratorProps {
  imageDataUrl: string;
  onCalibrationComplete: (calibration: ScaleCalibration) => void;
  existingCalibration?: ScaleCalibration;
}

type CalibrationStep = 'point1' | 'point2' | 'distance' | 'complete';

export const ScaleCalibrator: React.FC<ScaleCalibratorProps> = ({
  imageDataUrl,
  onCalibrationComplete,
  existingCalibration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const [step, setStep] = useState<CalibrationStep>('point1');
  const [point1, setPoint1] = useState<{ x: number; y: number } | null>(
    existingCalibration?.point1 || null
  );
  const [point2, setPoint2] = useState<{ x: number; y: number } | null>(
    existingCalibration?.point2 || null
  );
  const [distance, setDistance] = useState(
    existingCalibration?.realWorldDistance.toString() || ''
  );
  const [unit, setUnit] = useState<ScaleCalibration['unit']>(
    existingCalibration?.unit || 'cm'
  );
  const [error, setError] = useState<string | null>(null);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageSize({ width: img.width, height: img.height });
      setImageLoaded(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Calculate canvas size based on container
  useEffect(() => {
    if (!containerRef.current || !imageLoaded) return;

    const updateSize = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = Math.min(500, window.innerHeight * 0.5);

      // Calculate scale to fit image in container
      const scaleX = containerWidth / imageSize.width;
      const scaleY = containerHeight / imageSize.height;
      const fitScale = Math.min(scaleX, scaleY, 1);

      setCanvasSize({
        width: containerWidth,
        height: containerHeight,
      });
      setScale(fitScale);
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageLoaded, imageSize]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageLoaded || !imageRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image with scale and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);
    ctx.drawImage(imageRef.current, 0, 0);
    ctx.restore();

    // Draw calibration line and points
    ctx.save();
    
    if (point1) {
      const screenP1 = {
        x: point1.x * scale + pan.x,
        y: point1.y * scale + pan.y,
      };
      
      // Draw point 1
      ctx.beginPath();
      ctx.arc(screenP1.x, screenP1.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('A', screenP1.x - 4, screenP1.y - 12);
    }

    if (point2) {
      const screenP2 = {
        x: point2.x * scale + pan.x,
        y: point2.y * scale + pan.y,
      };
      
      // Draw point 2
      ctx.beginPath();
      ctx.arc(screenP2.x, screenP2.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(var(--destructive))';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = 'hsl(var(--destructive))';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('B', screenP2.x - 4, screenP2.y - 12);
    }

    // Draw line between points
    if (point1 && point2) {
      const screenP1 = {
        x: point1.x * scale + pan.x,
        y: point1.y * scale + pan.y,
      };
      const screenP2 = {
        x: point2.x * scale + pan.x,
        y: point2.y * scale + pan.y,
      };
      
      ctx.beginPath();
      ctx.moveTo(screenP1.x, screenP1.y);
      ctx.lineTo(screenP2.x, screenP2.y);
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw distance label
      const midX = (screenP1.x + screenP2.x) / 2;
      const midY = (screenP1.y + screenP2.y) / 2;
      const pixelDist = calculatePixelDistance(point1, point2);
      
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(midX - 40, midY - 12, 80, 24);
      ctx.strokeStyle = 'hsl(var(--border))';
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - 40, midY - 12, 80, 24);
      
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(pixelDist)} px`, midX, midY + 4);
    }

    ctx.restore();
  }, [imageLoaded, scale, pan, point1, point2]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen coordinates to image coordinates
    const imageX = (screenX - pan.x) / scale;
    const imageY = (screenY - pan.y) / scale;

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(imageSize.width, imageX));
    const clampedY = Math.max(0, Math.min(imageSize.height, imageY));

    if (step === 'point1') {
      setPoint1({ x: clampedX, y: clampedY });
      setStep('point2');
    } else if (step === 'point2') {
      setPoint2({ x: clampedX, y: clampedY });
      setStep('distance');
    }
  }, [scale, pan, imageSize, step]);

  // Handle zoom
  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
  };

  // Handle reset
  const handleReset = () => {
    setPoint1(null);
    setPoint2(null);
    setDistance('');
    setStep('point1');
    setError(null);
  };

  // Handle confirm
  const handleConfirm = () => {
    if (!point1 || !point2 || !distance) {
      setError('Please complete all calibration steps');
      return;
    }

    const distanceNum = parseFloat(distance);
    if (isNaN(distanceNum) || distanceNum <= 0) {
      setError('Please enter a valid distance');
      return;
    }

    try {
      const calibration = createScaleCalibration(point1, point2, distanceNum, unit);
      const validation = validateCalibration(calibration);

      if (!validation.isValid) {
        setError(validation.errors.join('. '));
        return;
      }

      if (validation.errors.length > 0) {
        // Show warnings but allow proceeding
        console.warn('Calibration warnings:', validation.errors);
      }

      onCalibrationComplete(calibration);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed');
    }
  };

  const getStepInstructions = () => {
    switch (step) {
      case 'point1':
        return 'Click on the START of a wall with a known length (Point A)';
      case 'point2':
        return 'Click on the END of the same wall (Point B)';
      case 'distance':
        return 'Enter the real-world length of this wall';
      case 'complete':
        return 'Scale calibration complete!';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="h-4 w-4" />
            Scale Calibration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          <div className="p-3 rounded-md bg-muted text-sm">
            <strong>Step {step === 'point1' ? 1 : step === 'point2' ? 2 : 3}:</strong>{' '}
            {getStepInstructions()}
          </div>

          {/* Canvas */}
          <div 
            ref={containerRef} 
            className="relative border rounded-md overflow-hidden bg-muted/50"
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onClick={handleCanvasClick}
              className="cursor-crosshair"
            />
            
            {/* Zoom controls */}
            <div className="absolute bottom-2 right-2 flex gap-1">
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-8 w-8"
                onClick={() => handleZoom(0.2)}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-8 w-8"
                onClick={() => handleZoom(-0.2)}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Distance input */}
          {step === 'distance' && point1 && point2 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="distance">Wall Length</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Enter length..."
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as ScaleCalibration['unit'])}>
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cm">Centimeters (cm)</SelectItem>
                    <SelectItem value="m">Meters (m)</SelectItem>
                    <SelectItem value="mm">Millimeters (mm)</SelectItem>
                    <SelectItem value="in">Inches (in)</SelectItem>
                    <SelectItem value="ft">Feet (ft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            {step === 'distance' && (
              <Button onClick={handleConfirm}>
                <Check className="h-4 w-4 mr-2" />
                Confirm Scale
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calibration summary */}
      {step === 'complete' && point1 && point2 && distance && (
        <div className="p-4 rounded-md bg-primary/10 border border-primary/20 text-sm">
          <strong>Calibration Set:</strong> {distance} {unit} = {Math.round(calculatePixelDistance(point1, point2))} pixels
          <br />
          <span className="text-muted-foreground">
            Scale: ~{(calculatePixelDistance(point1, point2) / parseFloat(distance)).toFixed(2)} pixels per {unit}
          </span>
        </div>
      )}
    </div>
  );
};
