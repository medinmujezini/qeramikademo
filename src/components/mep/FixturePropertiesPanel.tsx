/**
 * Fixture Properties Panel
 * 
 * Displays detailed information about the selected fixture
 * and allows editing of properties.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Trash2, 
  RotateCw, 
  Move,
  Droplets,
  Zap,
  Wind
} from 'lucide-react';
import type { MEPFixture } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';

interface FixturePropertiesPanelProps {
  fixture: MEPFixture | null;
  onRotate: () => void;
  onDelete: () => void;
  onUpdatePosition: (x: number, y: number) => void;
}

export const FixturePropertiesPanel: React.FC<FixturePropertiesPanelProps> = ({
  fixture,
  onRotate,
  onDelete,
  onUpdatePosition,
}) => {
  if (!fixture) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a fixture to view its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{fixture.name}</span>
          <Badge variant="outline" className="text-xs capitalize">
            {fixture.category}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Actions */}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRotate} className="flex-1">
            <RotateCw className="h-3 w-3 mr-1" />
            Rotate
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        <Separator />
        
        {/* Position */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Position</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">X</Label>
              <Input 
                type="number" 
                value={Math.round(fixture.position.x)}
                onChange={(e) => onUpdatePosition(Number(e.target.value), fixture.position.y)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Y</Label>
              <Input 
                type="number" 
                value={Math.round(fixture.position.y)}
                onChange={(e) => onUpdatePosition(fixture.position.x, Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Rotation: {fixture.rotation}°
          </div>
        </div>
        
        <Separator />
        
        {/* Dimensions */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Dimensions</Label>
          <div className="text-sm">
            {fixture.dimensions.width} × {fixture.dimensions.depth} × {fixture.dimensions.height} cm
          </div>
        </div>
        
        <Separator />
        
        {/* Code Values */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Code Values</Label>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {fixture.dfu > 0 && (
              <div className="flex items-center gap-1">
                <Droplets className="h-3 w-3" style={{ color: SYSTEM_COLORS['drainage'] }} />
                <span>{fixture.dfu} DFU</span>
              </div>
            )}
            {fixture.gpm > 0 && (
              <div className="flex items-center gap-1">
                <Droplets className="h-3 w-3" style={{ color: SYSTEM_COLORS['cold-water'] }} />
                <span>{fixture.gpm} GPM</span>
              </div>
            )}
            {fixture.wattage > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" style={{ color: SYSTEM_COLORS['power'] }} />
                <span>{fixture.wattage}W</span>
              </div>
            )}
          </div>
        </div>
        
        <Separator />
        
        {/* Connections */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Connections ({fixture.connections.length})
          </Label>
          <div className="space-y-1">
            {fixture.connections.map((conn, i) => (
              <div 
                key={conn.id || i} 
                className="flex items-center justify-between text-xs p-1 rounded"
                style={{ backgroundColor: `${SYSTEM_COLORS[conn.systemType]}20` }}
              >
                <span className="capitalize">{conn.systemType.replace('-', ' ')}</span>
                <Badge variant={conn.isRequired ? 'default' : 'outline'} className="text-[10px] h-4">
                  {conn.isRequired ? 'Required' : 'Optional'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        
        {/* Clearance Requirements */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Required Clearances</Label>
          <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1">
            <div>Front: {fixture.clearance.front}cm</div>
            <div>Sides: {fixture.clearance.sides}cm</div>
            <div>Rear: {fixture.clearance.rear}cm</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
