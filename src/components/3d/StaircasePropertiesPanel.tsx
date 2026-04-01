/**
 * StaircasePropertiesPanel — Step 4: Edit staircase properties when selected
 */

import React, { useRef } from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Trash2, Upload, X } from 'lucide-react';
import { calculateStaircaseGeometry } from '@/types/multiFloor';
import type { StaircaseType, RailingStyle } from '@/types/multiFloor';

export const StaircasePropertiesPanel: React.FC = () => {
  const { selectedStaircaseId, setSelectedStaircaseId, staircases, updateStaircase, removeStaircase, building } = useFloorPlanContext();

  const stair = staircases.find(s => s.id === selectedStaircaseId);
  if (!stair) return null;

  const fromFloor = building.floors.find(f => f.level === stair.fromLevel);
  const floorHeight = fromFloor?.floorToFloorHeight || 300;

  const handleTypeChange = (type: StaircaseType) => {
    const geo = calculateStaircaseGeometry(floorHeight, type, stair.stairWidth, stair.treadDepth);
    updateStaircase(stair.id, { type, ...geo });
  };

  const handleWidthChange = (stairWidth: number) => {
    const geo = calculateStaircaseGeometry(floorHeight, stair.type, stairWidth, stair.treadDepth);
    updateStaircase(stair.id, { stairWidth, ...geo });
  };

  const handleTreadDepthChange = (treadDepth: number) => {
    const geo = calculateStaircaseGeometry(floorHeight, stair.type, stair.stairWidth, treadDepth);
    updateStaircase(stair.id, { treadDepth, ...geo });
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">Staircase</span>
        <Button
          variant="ghost" size="icon" className="h-6 w-6 text-destructive"
          onClick={() => { removeStaircase(stair.id); setSelectedStaircaseId(null); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Type */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">Type</Label>
        <Select value={stair.type} onValueChange={(v) => handleTypeChange(v as StaircaseType)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="straight" className="text-xs">Straight</SelectItem>
            <SelectItem value="l-shaped" className="text-xs">L-Shaped</SelectItem>
            <SelectItem value="u-shaped" className="text-xs">U-Shaped</SelectItem>
            <SelectItem value="spiral" className="text-xs">Spiral</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stair Width */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">Stair Width: {stair.stairWidth} cm</Label>
        <Slider
          value={[stair.stairWidth]}
          onValueChange={([v]) => handleWidthChange(v)}
          min={60} max={150} step={5}
          className="py-1"
        />
      </div>

      {/* Tread Depth */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">Tread Depth: {stair.treadDepth} cm</Label>
        <Slider
          value={[stair.treadDepth]}
          onValueChange={([v]) => handleTreadDepthChange(v)}
          min={20} max={35} step={1}
          className="py-1"
        />
      </div>

      {/* Material */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">Tread Material</Label>
        <Select value={stair.treadMaterial} onValueChange={(v) => updateStaircase(stair.id, { treadMaterial: v as any })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="wood" className="text-xs">Wood</SelectItem>
            <SelectItem value="concrete" className="text-xs">Concrete</SelectItem>
            <SelectItem value="metal" className="text-xs">Metal</SelectItem>
            <SelectItem value="marble" className="text-xs">Marble</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Railing */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">Railing</Label>
        <Select value={stair.railing} onValueChange={(v) => updateStaircase(stair.id, { railing: v as RailingStyle })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs">None</SelectItem>
            <SelectItem value="simple" className="text-xs">Simple</SelectItem>
            <SelectItem value="glass" className="text-xs">Glass</SelectItem>
            <SelectItem value="metal" className="text-xs">Metal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rotation */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider">Rotation: {stair.rotation}°</Label>
        <Slider
          value={[stair.rotation]}
          onValueChange={([v]) => updateStaircase(stair.id, { rotation: v })}
          min={0} max={360} step={15}
          className="py-1"
        />
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider">X (cm)</Label>
          <Input
            type="number"
            value={stair.x}
            onChange={e => updateStaircase(stair.id, { x: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider">Y (cm)</Label>
          <Input
            type="number"
            value={stair.y}
            onChange={e => updateStaircase(stair.id, { y: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
      </div>

      {/* Info */}
      <div className="text-[10px] text-muted-foreground space-y-0.5 border-t border-primary/10 pt-2">
        <p>Treads: {stair.numTreads} × Riser: {stair.riserHeight.toFixed(1)} cm</p>
        <p>Footprint: {stair.width} × {stair.depth} cm</p>
        <p>Connects: Level {stair.fromLevel} → Level {stair.toLevel}</p>
      </div>
    </div>
  );
};
