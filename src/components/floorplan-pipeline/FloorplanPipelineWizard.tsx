/**
 * Floorplan → Geometry pipeline wizard.
 *
 * Stages:
 *   01 Upload    → ImageBitmap
 *   02 Calibrate → pixelsPerMeter (click A, click B, enter meters)
 *   03 Clean     → AI masks + client-side binarize → cleaned 1-bit canvas
 *   04 Trace     → Potrace + orthogonalize → closed polygons
 *   05 Extrude   → Polygons → walls in the FloorPlan
 *
 * AI is a raster preprocessor only. Stages 02/04/05 are deterministic.
 */
import React, { useCallback, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Ruler, Sparkles, Spline, Box, Check } from 'lucide-react';
import { toast } from 'sonner';
import { UploadStep } from './UploadStep';
import { CalibrateStep } from './CalibrateStep';
import { CleanStep } from './CleanStep';
import { TraceStep } from './TraceStep';
import { ExtrudeStep } from './ExtrudeStep';
import { buildFloorPlanFromPaths } from '@/lib/floorplan-pipeline/toFloorPlan';
import type { Calibration, CleanMasks, TracedPath } from '@/lib/floorplan-pipeline/types';
import type { Point, Wall } from '@/types/floorPlan';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: { points: Point[]; walls: Wall[]; pixelsPerMeter: number }) => void;
}

const STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'calibrate', label: 'Calibrate', icon: Ruler },
  { id: 'clean', label: 'AI Clean', icon: Sparkles },
  { id: 'trace', label: 'Trace', icon: Spline },
  { id: 'extrude', label: 'Extrude', icon: Box },
];

export const FloorplanPipelineWizard: React.FC<Props> = ({ open, onOpenChange, onComplete }) => {
  const [step, setStep] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [cleaned, setCleaned] = useState<HTMLCanvasElement | null>(null);
  const [paths, setPaths] = useState<TracedPath[]>([]);

  const reset = useCallback(() => {
    setStep(0);
    setImage(null);
    setCalibration(null);
    setCleaned(null);
    setPaths([]);
  }, []);

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const finalize = (wallHeightMeters: number) => {
    if (!calibration) return;
    const { points, walls } = buildFloorPlanFromPaths(paths, {
      pixelsPerMeter: calibration.pixelsPerMeter,
      wallHeightMeters,
    });
    onComplete({ points, walls, pixelsPerMeter: calibration.pixelsPerMeter });
    toast.success('Floor plan imported', {
      description: `${walls.length} walls from ${paths.filter((p) => p.enabled).length} polygons.`,
    });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Import Floor Plan from Image</DialogTitle>
          <div className="flex items-center justify-between mt-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <div className={`flex items-center gap-2 ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center border ${active ? 'border-primary bg-primary/10' : done ? 'border-foreground' : 'border-muted-foreground/30'}`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-xs font-medium">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${done ? 'bg-foreground/40' : 'bg-border'}`} />}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {step === 0 && (
            <UploadStep onUpload={(_, img) => { setImage(img); setStep(1); }} />
          )}
          {step === 1 && image && (
            <CalibrateStep
              image={image}
              onBack={() => setStep(0)}
              onComplete={(cal) => { setCalibration(cal); setStep(2); }}
            />
          )}
          {step === 2 && image && (
            <CleanStep
              image={image}
              onBack={() => setStep(1)}
              onComplete={(canvas, _masks) => { setCleaned(canvas); setStep(3); }}
            />
          )}
          {step === 3 && cleaned && (
            <TraceStep
              cleanedCanvas={cleaned}
              onBack={() => setStep(2)}
              onComplete={(p) => { setPaths(p); setStep(4); }}
            />
          )}
          {step === 4 && calibration && (
            <ExtrudeStep
              paths={paths}
              calibration={calibration}
              onBack={() => setStep(3)}
              onFinalize={finalize}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
