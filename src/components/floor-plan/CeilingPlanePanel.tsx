import React from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, Compass, Info } from 'lucide-react';

import { getDirectionLabel, getDirectionFromCompass, formatCeilingPlaneInfo } from '@/utils/ceilingUtils';

const COMPASS_DIRECTIONS = [
  'North', 'Northeast', 'East', 'Southeast', 
  'South', 'Southwest', 'West', 'Northwest'
];

export const CeilingPlanePanel: React.FC = () => {
  const { 
    ceilingPlane, 
    isCeilingPlaneEnabled,
    updateCeilingPlane,
    floorPlan
  } = useFloorPlanContext();

  const currentDirection = getDirectionLabel(ceilingPlane.direction);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Ceiling Slope</CardTitle>
          </div>
          <Switch
            checked={isCeilingPlaneEnabled}
            onCheckedChange={(checked) => updateCeilingPlane({ enabled: checked })}
          />
        </div>
        {isCeilingPlaneEnabled && (
          <p className="text-xs text-muted-foreground mt-1">
            {formatCeilingPlaneInfo(ceilingPlane)}
          </p>
        )}
      </CardHeader>
      
      {isCeilingPlaneEnabled && (
        <CardContent className="space-y-4">
          {/* Info badge */}
          <div className="bg-primary/5 border border-primary/20 rounded-md p-2">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Wall heights are computed from this ceiling plane. Change height at any wall to adjust the plane.
              </p>
            </div>
          </div>

          {/* Base Height */}
          <div className="space-y-2">
            <Label htmlFor="baseHeight" className="text-xs">Base Height (cm)</Label>
            <Input
              id="baseHeight"
              type="number"
              value={ceilingPlane.baseHeight}
              onChange={(e) => updateCeilingPlane({ baseHeight: Number(e.target.value) })}
              min={100}
              max={500}
            />
            <p className="text-xs text-muted-foreground">
              Height at the highest point of the ceiling
            </p>
          </div>

          {/* Pitch Angle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Pitch Angle</Label>
              <Badge variant="outline" className="text-xs">
                {ceilingPlane.pitch.toFixed(1)}°
              </Badge>
            </div>
            <Slider
              value={[ceilingPlane.pitch]}
              onValueChange={([value]) => updateCeilingPlane({ pitch: value })}
              min={0}
              max={45}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Flat (0°)</span>
              <span>Steep (45°)</span>
            </div>
          </div>

          {/* Direction */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Compass className="h-3 w-3" />
              Slope Direction
            </Label>
            <Select
              value={currentDirection}
              onValueChange={(value) => {
                const direction = getDirectionFromCompass(value);
                updateCeilingPlane({ direction });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPASS_DIRECTIONS.map(dir => (
                  <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Direction the ceiling slopes downward
            </p>
          </div>

          {/* Reference Point */}
          <div className="space-y-2">
            <Label className="text-xs">Reference Point</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">X</Label>
                <Input
                  type="number"
                  value={Math.round(ceilingPlane.referencePoint.x)}
                  onChange={(e) => updateCeilingPlane({ 
                    referencePoint: { 
                      ...ceilingPlane.referencePoint, 
                      x: Number(e.target.value) 
                    }
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Y</Label>
                <Input
                  type="number"
                  value={Math.round(ceilingPlane.referencePoint.y)}
                  onChange={(e) => updateCeilingPlane({ 
                    referencePoint: { 
                      ...ceilingPlane.referencePoint, 
                      y: Number(e.target.value) 
                    }
                  })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Point where base height applies (highest point)
            </p>
          </div>

          {/* Wall count following ceiling */}
          {(() => {
            const roomModeWalls = floorPlan.walls.filter(w => w.heightMode !== 'override');
            const overrideWalls = floorPlan.walls.filter(w => w.heightMode === 'override');
            
            return (
              <div className="flex gap-2 pt-2 border-t">
                <Badge variant="secondary" className="text-xs">
                  {roomModeWalls.length} walls following
                </Badge>
                {overrideWalls.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {overrideWalls.length} overridden
                  </Badge>
                )}
              </div>
            );
          })()}
        </CardContent>
      )}
    </Card>
  );
};
