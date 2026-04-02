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
import type { CurtainType, CurtainFabric, Window as FloorWindow } from '@/types/floorPlan';
import { Blinds, Layers, SquareStack, ScrollText, ChevronDown } from 'lucide-react';

interface CurtainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  windows: FloorWindow[]; // all windows on the wall
  selectedWindowId: string | null;
  wallHeight: number;
  onConfirm: (config: {
    windowId: string;
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

const CURTAIN_TYPES: { value: CurtainType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'panel', label: 'Panel', description: 'Classic split curtains with folds', icon: <Blinds className="h-4 w-4" /> },
  { value: 'sheer', label: 'Sheer', description: 'Translucent light-filtering', icon: <Layers className="h-4 w-4" /> },
  { value: 'roman', label: 'Roman', description: 'Horizontal fold layers', icon: <SquareStack className="h-4 w-4" /> },
  { value: 'roller', label: 'Roller', description: 'Roll-up shade', icon: <ScrollText className="h-4 w-4" /> },
  { value: 'pleated', label: 'Pleated', description: 'Accordion zigzag', icon: <ChevronDown className="h-4 w-4" /> },
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
  windows,
  selectedWindowId,
  wallHeight,
  onConfirm,
}) => {
  const [type, setType] = useState<CurtainType>('panel');
  const [fabricColor, setFabricColor] = useState('#f5f0e1');
  const [fabricMaterial, setFabricMaterial] = useState<CurtainFabric>('linen');
  const [chosenWindowId, setChosenWindowId] = useState<string>(selectedWindowId ?? windows[0]?.id ?? '');
  const chosenWindow = windows.find(w => w.id === chosenWindowId) ?? windows[0] ?? null;
  const [width, setWidth] = useState(chosenWindow ? chosenWindow.width + 40 : 160);
  const [height, setHeight] = useState(wallHeight - 10);
  const [opacity, setOpacity] = useState(1);
  const [mountHeight, setMountHeight] = useState(wallHeight);
  const [rodVisible, setRodVisible] = useState(true);

  // Update dimensions when window changes
  React.useEffect(() => {
    if (chosenWindow) {
      setWidth(chosenWindow.width + 40);
      setHeight(wallHeight - 10);
      setMountHeight(wallHeight);
    }
  }, [chosenWindow, wallHeight]);

  // Sync chosen window when dialog opens
  React.useEffect(() => {
    if (open) {
      setChosenWindowId(selectedWindowId ?? windows[0]?.id ?? '');
    }
  }, [open, selectedWindowId, windows]);

  const isPhase2 = false; // All types now implemented

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-sm">Add Curtain</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Window picker (when multiple windows on wall) */}
            {windows.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Window</Label>
                <Select value={chosenWindowId} onValueChange={setChosenWindowId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {windows.map((w, i) => (
                      <SelectItem key={w.id} value={w.id}>Window {i + 1} — {w.width}×{w.height}cm ({w.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              {isPhase2 && (
                <Badge variant="outline" className="text-[10px]">Coming in Phase 2</Badge>
              )}
            </div>

            {/* Fabric material */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fabric Material</Label>
              <Select value={fabricMaterial} onValueChange={(v) => setFabricMaterial(v as CurtainFabric)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
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
                <Input
                  type="color"
                  value={fabricColor}
                  onChange={(e) => setFabricColor(e.target.value)}
                  className="h-8 w-12 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={fabricColor}
                  onChange={(e) => setFabricColor(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
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
                <Slider
                  value={[opacity]}
                  onValueChange={([v]) => setOpacity(v)}
                  min={0.1}
                  max={1}
                  step={0.05}
                />
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
              onConfirm({ type, fabricColor, fabricMaterial, width, height, opacity, mountHeight, rodVisible });
              onOpenChange(false);
            }}
            disabled={isPhase2}
          >
            Place Curtain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
