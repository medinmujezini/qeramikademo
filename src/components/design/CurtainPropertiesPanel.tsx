import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Blinds, Trash2 } from 'lucide-react';
import { CURTAIN_FABRIC_PRESETS } from '@/types/floorPlan';
import type { Curtain, CurtainType, CurtainFabric } from '@/types/floorPlan';

interface CurtainPropertiesPanelProps {
  curtain: Curtain;
  wallHeight: number;
  onUpdate: (id: string, updates: Partial<Curtain>) => void;
  onDelete: (id: string) => void;
  onDeselect: () => void;
}

const FABRIC_MATERIALS: { value: CurtainFabric; label: string }[] = [
  { value: 'linen', label: 'Linen' },
  { value: 'velvet', label: 'Velvet' },
  { value: 'cotton', label: 'Cotton' },
  { value: 'silk', label: 'Silk' },
  { value: 'blackout', label: 'Blackout' },
];

const CURTAIN_TYPE_LABELS: Record<CurtainType, string> = {
  panel: 'Panel', sheer: 'Sheer', roman: 'Roman', roller: 'Roller', pleated: 'Pleated',
};

export const CurtainPropertiesPanel: React.FC<CurtainPropertiesPanelProps> = ({
  curtain, wallHeight, onUpdate, onDelete, onDeselect,
}) => {
  return (
    <div className="h-full flex flex-col border-l border-primary/10 bg-card/50 shadow-[inset_0_0_40px_hsl(38_60%_68%/0.03)]">
      <div className="p-4 border-b border-primary/15">
        <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-primary/70">Curtain Properties</h3>
        <div className="w-8 h-px bg-primary/25 mt-1" />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info card */}
          <Card className="luxury-hover-glow">
            <div className="h-[2px] bg-primary/40" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Blinds className="h-4 w-4" />
                {CURTAIN_TYPE_LABELS[curtain.type]} Curtain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Type */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Type</Label>
                <Select value={curtain.type} onValueChange={(v) => onUpdate(curtain.id, { type: v as CurtainType })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CURTAIN_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fabric */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Fabric</Label>
                <Select value={curtain.fabricMaterial} onValueChange={(v) => onUpdate(curtain.id, { fabricMaterial: v as CurtainFabric })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FABRIC_MATERIALS.map(fm => (
                      <SelectItem key={fm.value} value={fm.value}>{fm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Color */}
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground">Color</Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {CURTAIN_FABRIC_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => onUpdate(curtain.id, { fabricColor: preset.color })}
                      className={`w-7 h-7 rounded-md border-2 transition-all ${
                        curtain.fabricColor === preset.color ? 'border-primary scale-110' : 'border-transparent hover:border-primary/30'
                      }`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <Input type="color" value={curtain.fabricColor} onChange={(e) => onUpdate(curtain.id, { fabricColor: e.target.value })} className="h-7 w-10 p-0.5 cursor-pointer" />
                  <Input type="text" value={curtain.fabricColor} onChange={(e) => onUpdate(curtain.id, { fabricColor: e.target.value })} className="h-7 text-xs flex-1" />
                </div>
              </div>

              <Separator />

              {/* Open Amount */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Open: {Math.round(curtain.openAmount * 100)}%</Label>
                <Slider
                  value={[curtain.openAmount]}
                  onValueChange={([v]) => onUpdate(curtain.id, { openAmount: v })}
                  min={0} max={1} step={0.05}
                />
              </div>

              {/* Opacity (sheer) */}
              {curtain.type === 'sheer' && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Opacity: {Math.round(curtain.opacity * 100)}%</Label>
                  <Slider
                    value={[curtain.opacity]}
                    onValueChange={([v]) => onUpdate(curtain.id, { opacity: v })}
                    min={0.1} max={1} step={0.05}
                  />
                </div>
              )}

              <Separator />

              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Width (cm)</Label>
                  <Input type="number" value={curtain.width} onChange={e => onUpdate(curtain.id, { width: Number(e.target.value) })} className="h-7 text-xs" min={20} max={500} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Height (cm)</Label>
                  <Input type="number" value={curtain.height} onChange={e => onUpdate(curtain.id, { height: Number(e.target.value) })} className="h-7 text-xs" min={20} max={400} />
                </div>
              </div>

              {/* Rod */}
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Show rod</Label>
                <Switch checked={curtain.rodVisible !== false} onCheckedChange={(v) => onUpdate(curtain.id, { rodVisible: v })} className="scale-75" />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-primary/60 border-l-[3px] border-primary/35 pl-2">Actions</h4>
            <Button variant="destructive" size="sm" className="w-full" onClick={() => { onDelete(curtain.id); onDeselect(); }}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Curtain
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
