import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CURTAIN_FABRIC_PRESETS } from '@/types/floorPlan';
import type { CurtainType, CurtainFabric, Wall, Window as FloorWindow } from '@/types/floorPlan';
import { Blinds, Layers, SquareStack, ScrollText, ChevronDown } from 'lucide-react';

interface WallWithWindows {
  wall: Wall;
  windows: FloorWindow[];
}

interface CurtainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallsWithWindows: WallWithWindows[];
  wallHeight: number;
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

export const CurtainDialog: React.FC<CurtainDialogProps> = ({
  open,
  onOpenChange,
  wallsWithWindows,
  wallHeight,
  onConfirm,
}) => {
  const [selectedWallId, setSelectedWallId] = useState<string>('');
  const [type, setType] = useState<CurtainType>('panel');
  const [fabricColor, setFabricColor] = useState('#f5f0e1');
  const [fabricMaterial, setFabricMaterial] = useState<CurtainFabric>('linen');
  const [width, setWidth] = useState(160);
  const [height, setHeight] = useState(wallHeight - 10);
  const [opacity, setOpacity] = useState(1);
  const [mountHeight, setMountHeight] = useState(wallHeight);
  const [rodVisible, setRodVisible] = useState(true);

  // Init on open
  React.useEffect(() => {
    if (open && wallsWithWindows.length > 0) {
      const first = wallsWithWindows[0];
      setSelectedWallId(first.wall.id);
      const avgW = first.windows.reduce((s, w) => s + w.width, 0) / first.windows.length;
      setWidth(Math.round(avgW + 40));
      setHeight(wallHeight - 10);
      setMountHeight(wallHeight);
    }
  }, [open, wallsWithWindows, wallHeight]);

  // Update width when wall selection changes
  React.useEffect(() => {
    const entry = wallsWithWindows.find(e => e.wall.id === selectedWallId);
    if (entry) {
      const avgW = entry.windows.reduce((s, w) => s + w.width, 0) / entry.windows.length;
      setWidth(Math.round(avgW + 40));
    }
  }, [selectedWallId, wallsWithWindows]);

  const selectedEntry = wallsWithWindows.find(e => e.wall.id === selectedWallId);
  const windowCount = selectedEntry?.windows.length ?? 0;

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

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Width (cm)</Label>
                <Input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="h-8 text-xs" min={20} max={500} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Height (cm)</Label>
                <Input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="h-8 text-xs" min={20} max={400} />
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
