import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Trash2, ChefHat } from 'lucide-react';
import type { KitchenBlock, KitchenBlockType, CountertopMaterial, HandleStyle, KITCHEN_BLOCK_DEFAULTS } from '@/types/floorPlan';
import ColorPickerField from '@/components/admin/ColorPickerField';
import { supabase } from '@/integrations/supabase/client';

const round2 = (v: number) => Math.round(v * 100) / 100;

const BLOCK_TYPE_LABELS: Record<KitchenBlockType, string> = {
  'base-cabinet': 'Base Cabinet',
  'wall-cabinet': 'Wall Cabinet',
  'tall-cabinet': 'Tall Cabinet',
  'countertop': 'Countertop',
  'appliance-fridge': 'Fridge',
  'appliance-stove': 'Stove',
  'appliance-sink': 'Sink',
  'appliance-dishwasher': 'Dishwasher',
  'island': 'Island',
};

const COUNTERTOP_MATERIALS: { value: CountertopMaterial; label: string }[] = [
  { value: 'granite', label: 'Granite' },
  { value: 'marble', label: 'Marble' },
  { value: 'quartz', label: 'Quartz' },
  { value: 'wood', label: 'Wood' },
  { value: 'steel', label: 'Steel' },
];

const HANDLE_STYLES: { value: HandleStyle; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'knob', label: 'Knob' },
  { value: 'integrated', label: 'Integrated' },
  { value: 'none', label: 'None' },
];

interface KitchenModel {
  id: string;
  name: string;
  block_type: string;
  model_url: string;
  thumbnail_url: string | null;
}

interface KitchenPropertiesPanelProps {
  block: KitchenBlock;
  onUpdate: (id: string, updates: Partial<KitchenBlock>) => void;
  onDelete: (id: string) => void;
  onDeselect: () => void;
}

export const KitchenPropertiesPanel: React.FC<KitchenPropertiesPanelProps> = ({
  block,
  onUpdate,
  onDelete,
  onDeselect,
}) => {
  const [models, setModels] = useState<KitchenModel[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      const { data } = await supabase
        .from('kitchen_models')
        .select('id, name, block_type, model_url, thumbnail_url')
        .eq('is_active', true)
        .eq('block_type', block.blockType)
        .order('sort_order');
      if (data) setModels(data as unknown as KitchenModel[]);
    };
    fetchModels();
  }, [block.blockType]);

  const showCountertop = block.blockType === 'base-cabinet' || block.blockType === 'island' || block.blockType === 'countertop' || block.blockType.startsWith('appliance-');

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-primary">Kitchen Block</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { onDelete(block.id); onDeselect(); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <Separator className="bg-primary/10" />

      {/* Block Type */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
        <Select value={block.blockType} onValueChange={(v) => onUpdate(block.id, { blockType: v as KitchenBlockType })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(BLOCK_TYPE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">W (cm)</Label>
          <Input type="number" step="1" min={10} value={round2(block.width)} onChange={e => onUpdate(block.id, { width: parseFloat(e.target.value) || 60 })} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">H (cm)</Label>
          <Input type="number" step="1" min={3} value={round2(block.height)} onChange={e => onUpdate(block.id, { height: parseFloat(e.target.value) || 85 })} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">D (cm)</Label>
          <Input type="number" step="1" min={10} value={round2(block.depth)} onChange={e => onUpdate(block.id, { depth: parseFloat(e.target.value) || 60 })} className="h-7 text-xs" />
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">X (cm)</Label>
          <Input type="number" step="1" value={round2(block.x)} onChange={e => onUpdate(block.id, { x: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground">Y (cm)</Label>
          <Input type="number" step="1" value={round2(block.y)} onChange={e => onUpdate(block.id, { y: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
        </div>
      </div>

      {/* Rotation */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rotation</Label>
        <Select value={String(block.rotation)} onValueChange={v => onUpdate(block.id, { rotation: parseInt(v) })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0°</SelectItem>
            <SelectItem value="90">90°</SelectItem>
            <SelectItem value="180">180°</SelectItem>
            <SelectItem value="270">270°</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-primary/10" />

      {/* Cabinet Color */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cabinet Color</Label>
        <ColorPickerField value={block.cabinetColor} onChange={c => onUpdate(block.id, { cabinetColor: c })} />
      </div>

      {/* Countertop */}
      {showCountertop && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Countertop Color</Label>
            <ColorPickerField value={block.countertopColor} onChange={c => onUpdate(block.id, { countertopColor: c })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Countertop Material</Label>
            <Select value={block.countertopMaterial} onValueChange={v => onUpdate(block.id, { countertopMaterial: v as CountertopMaterial })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTERTOP_MATERIALS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Handle Style */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Handle Style</Label>
        <Select value={block.handleStyle} onValueChange={v => onUpdate(block.id, { handleStyle: v as HandleStyle })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HANDLE_STYLES.map(h => (
              <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-primary/10" />

      {/* Model Picker */}
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">3D Model</Label>
        <Select value={block.modelUrl || '__none__'} onValueChange={v => onUpdate(block.id, { modelUrl: v === '__none__' ? undefined : v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Default (procedural)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Default (procedural)</SelectItem>
            {models.map(m => (
              <SelectItem key={m.id} value={m.model_url}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {models.length === 0 && (
          <p className="text-[10px] text-muted-foreground">No models uploaded for this type</p>
        )}
      </div>
    </div>
  );
};

export default KitchenPropertiesPanel;
