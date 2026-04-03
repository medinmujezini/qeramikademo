import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CURTAIN_FABRIC_PRESETS } from '@/types/floorPlan';
import type { CurtainType, CurtainFabric, Wall, Window as FloorWindow } from '@/types/floorPlan';
import { Blinds, Layers, SquareStack, ScrollText, ChevronDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WallWithWindows {
  wall: Wall;
  windows: FloorWindow[];
}

interface CurtainModel {
  id: string;
  name: string;
  type: string;
  model_url: string;
  thumbnail_url: string | null;
}

interface CurtainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallsWithWindows: WallWithWindows[];
  wallHeight: number; // fallback only
  onConfirm: (config: {
    wallId: string;
    type: CurtainType;
    fabricColor: string;
    fabricMaterial: CurtainFabric;
    width: number;
    height: number;
    opacity: number;
    mountHeight: number;
    rodVisible: boolean;
    modelUrl?: string;
  }) => void;
}

const CURTAIN_TYPES: { value: CurtainType; label: string; icon: React.ReactNode }[] = [
  { value: 'panel', label: 'Panel', icon: <Blinds className="h-4 w-4" /> },
  { value: 'sheer', label: 'Sheer', icon: <Layers className="h-4 w-4" /> },
  { value: 'roman', label: 'Roman', icon: <SquareStack className="h-4 w-4" /> },
  { value: 'roller', label: 'Roller', icon: <ScrollText className="h-4 w-4" /> },
  { value: 'pleated', label: 'Pleated', icon: <ChevronDown className="h-4 w-4" /> },
];

const FABRIC_MATERIALS: { value: CurtainFabric; label: string }[] = [
  { value: 'linen', label: 'Linen' },
  { value: 'velvet', label: 'Velvet' },
  { value: 'cotton', label: 'Cotton' },
  { value: 'silk', label: 'Silk' },
  { value: 'blackout', label: 'Blackout' },
];

type HangStyle = 'floor' | 'sill' | 'custom';

const isDrapeType = (t: CurtainType) => t === 'panel' || t === 'sheer';

function computeDefaults(
  type: CurtainType,
  hangStyle: HangStyle,
  wallH: number,
  avgWinWidth: number,
  avgWinHeight: number,
  avgSillHeight: number,
) {
  const drape = isDrapeType(type);

  // Width: drapes extend 30cm each side, blinds 10cm each side
  const w = drape ? avgWinWidth + 60 : avgWinWidth + 20;

  // Mount height
  const mount = drape ? wallH : Math.min(avgSillHeight + avgWinHeight + 10, wallH);

  // Height based on hang style
  let h: number;
  if (hangStyle === 'floor') {
    h = mount - 5; // 5cm off the floor
  } else if (hangStyle === 'sill') {
    h = drape
      ? mount - avgSillHeight + 10 // 10cm below sill
      : avgWinHeight + 20;
  } else {
    // custom — don't override
    return { width: w, mountHeight: mount, height: undefined };
  }

  return { width: Math.round(w), height: Math.round(h), mountHeight: Math.round(mount) };
}

export const CurtainDialog: React.FC<CurtainDialogProps> = ({
  open,
  onOpenChange,
  wallsWithWindows,
  wallHeight: fallbackWallHeight,
  onConfirm,
}) => {
  const [selectedWallId, setSelectedWallId] = useState<string>('');
  const [type, setType] = useState<CurtainType>('panel');
  const [fabricColor, setFabricColor] = useState('#f5f0e1');
  const [fabricMaterial, setFabricMaterial] = useState<CurtainFabric>('linen');
  const [width, setWidth] = useState(160);
  const [height, setHeight] = useState(270);
  const [opacity, setOpacity] = useState(1);
  const [mountHeight, setMountHeight] = useState(280);
  const [rodVisible, setRodVisible] = useState(true);
  const [hangStyle, setHangStyle] = useState<HangStyle>('floor');

  // Compute averages for current wall
  const selectedEntry = wallsWithWindows.find(e => e.wall.id === selectedWallId);
  const windowCount = selectedEntry?.windows.length ?? 0;

  const getWallWindowAverages = (entry: WallWithWindows | undefined) => {
    if (!entry || entry.windows.length === 0) return { avgW: 100, avgH: 120, avgSill: 90 };
    const wins = entry.windows;
    const avgW = wins.reduce((s, w) => s + w.width, 0) / wins.length;
    const avgH = wins.reduce((s, w) => s + w.height, 0) / wins.length;
    const avgSill = wins.reduce((s, w) => s + w.sillHeight, 0) / wins.length;
    return { avgW, avgH, avgSill };
  };

  const getEffectiveWallHeight = (entry: WallWithWindows | undefined) =>
    entry?.wall.height ?? (fallbackWallHeight || 280);

  // Apply smart defaults
  const applyDefaults = (
    curtainType: CurtainType,
    style: HangStyle,
    entry: WallWithWindows | undefined,
  ) => {
    const { avgW, avgH, avgSill } = getWallWindowAverages(entry);
    const wh = getEffectiveWallHeight(entry);
    const defaults = computeDefaults(curtainType, style, wh, avgW, avgH, avgSill);
    setWidth(defaults.width);
    setMountHeight(defaults.mountHeight);
    if (defaults.height !== undefined) setHeight(defaults.height);
  };

  // Init on open
  useEffect(() => {
    if (open && wallsWithWindows.length > 0) {
      const first = wallsWithWindows[0];
      setSelectedWallId(first.wall.id);
      const defaultStyle: HangStyle = isDrapeType(type) ? 'floor' : 'sill';
      setHangStyle(defaultStyle);
      applyDefaults(type, defaultStyle, first);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-compute when wall changes
  useEffect(() => {
    const entry = wallsWithWindows.find(e => e.wall.id === selectedWallId);
    if (entry) applyDefaults(type, hangStyle, entry);
  }, [selectedWallId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-compute when type changes (also update default hang style)
  useEffect(() => {
    const entry = wallsWithWindows.find(e => e.wall.id === selectedWallId);
    const defaultStyle: HangStyle = isDrapeType(type) ? 'floor' : 'sill';
    setHangStyle(defaultStyle);
    applyDefaults(type, defaultStyle, entry);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-compute when hang style changes
  useEffect(() => {
    const entry = wallsWithWindows.find(e => e.wall.id === selectedWallId);
    applyDefaults(type, hangStyle, entry);
  }, [hangStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-sm">Add Curtain</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Wall picker */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Wall</Label>
              <Select value={selectedWallId} onValueChange={setSelectedWallId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {wallsWithWindows.map((entry, i) => (
                    <SelectItem key={entry.wall.id} value={entry.wall.id}>
                      Wall {i + 1} — {entry.windows.length} window{entry.windows.length !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {windowCount > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Curtains will be placed on all {windowCount} window{windowCount !== 1 ? 's' : ''} on this wall
                </p>
              )}
            </div>

            {/* Type selector */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Curtain Type</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {CURTAIN_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    onClick={() => setType(ct.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-md border text-xs transition-colors ${
                      type === ct.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    {ct.icon}
                    <span className="text-[10px]">{ct.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fabric material */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fabric Material</Label>
              <Select value={fabricMaterial} onValueChange={(v) => setFabricMaterial(v as CurtainFabric)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FABRIC_MATERIALS.map(fm => (
                    <SelectItem key={fm.value} value={fm.value}>{fm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color presets */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fabric Color</Label>
              <div className="grid grid-cols-6 gap-1.5">
                {CURTAIN_FABRIC_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setFabricColor(preset.color)}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${
                      fabricColor === preset.color ? 'border-primary scale-110' : 'border-transparent hover:border-primary/30'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Input type="color" value={fabricColor} onChange={(e) => setFabricColor(e.target.value)} className="h-8 w-12 p-1 cursor-pointer" />
                <Input type="text" value={fabricColor} onChange={(e) => setFabricColor(e.target.value)} className="h-8 text-xs flex-1" />
              </div>
            </div>

            {/* Hang style */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Hang Style</Label>
              <RadioGroup value={hangStyle} onValueChange={(v) => setHangStyle(v as HangStyle)} className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="floor" id="hang-floor" />
                  <Label htmlFor="hang-floor" className="text-xs cursor-pointer">Floor-length</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="sill" id="hang-sill" />
                  <Label htmlFor="hang-sill" className="text-xs cursor-pointer">Sill-length</Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="custom" id="hang-custom" />
                  <Label htmlFor="hang-custom" className="text-xs cursor-pointer">Custom</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Width (cm)</Label>
                <Input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="h-8 text-xs" min={20} max={500} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Height (cm)</Label>
                <Input
                  type="number"
                  value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                  className="h-8 text-xs"
                  min={20}
                  max={400}
                  disabled={hangStyle !== 'custom'}
                />
              </div>
            </div>

            {/* Opacity slider */}
            {type === 'sheer' && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Opacity: {Math.round(opacity * 100)}%</Label>
                <Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} min={0.1} max={1} step={0.05} />
              </div>
            )}

            {/* Rod visibility */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Show curtain rod</Label>
              <Switch checked={rodVisible} onCheckedChange={setRodVisible} className="scale-75" />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm({ wallId: selectedWallId, type, fabricColor, fabricMaterial, width, height, opacity, mountHeight, rodVisible });
              onOpenChange(false);
            }}
            disabled={!selectedWallId}
          >
            Place Curtain{windowCount > 1 ? `s (${windowCount})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
