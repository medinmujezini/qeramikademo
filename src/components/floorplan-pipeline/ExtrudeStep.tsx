import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { TracedPath, Calibration } from '@/lib/floorplan-pipeline/types';

interface Props {
  paths: TracedPath[];
  calibration: Calibration;
  onFinalize: (wallHeightMeters: number) => void;
  onBack: () => void;
}

export const ExtrudeStep: React.FC<Props> = ({ paths, calibration, onFinalize, onBack }) => {
  const [height, setHeight] = useState('2.7');
  const enabled = paths.filter((p) => p.enabled);
  const totalArea = enabled.reduce((s, p) => s + p.bboxArea, 0);

  return (
    <div className="flex-1 flex flex-col p-6 gap-4 items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h3 className="text-xl font-medium">Ready to import</h3>
        <p className="text-sm text-muted-foreground">
          {enabled.length} wall polygon{enabled.length === 1 ? '' : 's'} will be extruded into your floor plan.
        </p>

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div className="border rounded-lg p-3">
            <div className="text-foreground font-medium text-sm">{calibration.pixelsPerMeter.toFixed(1)}</div>
            <div>pixels / meter</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-foreground font-medium text-sm">{Math.round(totalArea)}</div>
            <div>covered bbox (px²)</div>
          </div>
        </div>

        <div className="text-left space-y-1">
          <Label className="text-xs">Wall height (meters)</Label>
          <Input
            type="number"
            min={1.5}
            max={6}
            step={0.05}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={() => onFinalize(parseFloat(height) || 2.7)}>
          Import to project
        </Button>
      </div>
    </div>
  );
};
