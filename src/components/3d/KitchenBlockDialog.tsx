import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KITCHEN_BLOCK_DEFAULTS } from '@/types/floorPlan';
import type { KitchenBlockType, CountertopMaterial, HandleStyle } from '@/types/floorPlan';
import { supabase } from '@/integrations/supabase/client';
import ColorPickerField from '@/components/admin/ColorPickerField';
import {
  ChefHat, Refrigerator, CookingPot, Droplets, Box,
} from 'lucide-react';

interface KitchenModel {
  id: string;
  name: string;
  block_type: string;
  model_url: string;
  thumbnail_url: string | null;
}

interface KitchenBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (config: {
    blockType: KitchenBlockType;
    width: number;
    height: number;
    depth: number;
    cabinetColor: string;
    countertopColor: string;
    countertopMaterial: CountertopMaterial;
    handleStyle: HandleStyle;
    modelUrl?: string;
  }) => void;
}

const BLOCK_TYPES: { value: KitchenBlockType; label: string; icon: React.ReactNode }[] = [
  { value: 'base-cabinet', label: 'Base Cabinet', icon: <Box className="h-4 w-4" /> },
  { value: 'wall-cabinet', label: 'Wall Cabinet', icon: <Box className="h-4 w-4" /> },
  { value: 'tall-cabinet', label: 'Tall Cabinet', icon: <Box className="h-4 w-4" /> },
  { value: 'countertop', label: 'Countertop', icon: <Box className="h-4 w-4" /> },
  { value: 'appliance-fridge', label: 'Fridge', icon: <Refrigerator className="h-4 w-4" /> },
  { value: 'appliance-stove', label: 'Stove', icon: <CookingPot className="h-4 w-4" /> },
  { value: 'appliance-sink', label: 'Sink', icon: <Droplets className="h-4 w-4" /> },
  { value: 'appliance-dishwasher', label: 'Dishwasher', icon: <Box className="h-4 w-4" /> },
  { value: 'island', label: 'Island', icon: <ChefHat className="h-4 w-4" /> },
];

const round2 = (v: number) => Math.round(v * 100) / 100;

const KitchenBlockDialog: React.FC<KitchenBlockDialogProps> = ({ open, onOpenChange, onConfirm }) => {
  const [blockType, setBlockType] = useState<KitchenBlockType>('base-cabinet');
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(85);
  const [depth, setDepth] = useState(60);
  const [cabinetColor, setCabinetColor] = useState('#f5f0e1');
  const [countertopColor, setCountertopColor] = useState('#2d2d2d');
  const [countertopMaterial, setCountertopMaterial] = useState<CountertopMaterial>('granite');
  const [handleStyle, setHandleStyle] = useState<HandleStyle>('bar');
  const [selectedModelUrl, setSelectedModelUrl] = useState<string>('');
  const [models, setModels] = useState<KitchenModel[]>([]);

  // Load defaults when block type changes
  useEffect(() => {
    const defaults = KITCHEN_BLOCK_DEFAULTS[blockType];
    setWidth(defaults.width);
    setHeight(defaults.height);
    setDepth(defaults.depth);
    setSelectedModelUrl('');
  }, [blockType]);

  // Fetch models for selected type
  useEffect(() => {
    if (!open) return;
    const fetchModels = async () => {
      const { data } = await supabase
        .from('kitchen_models')
        .select('id, name, block_type, model_url, thumbnail_url')
        .eq('is_active', true)
        .eq('block_type', blockType)
        .order('sort_order');
      if (data) setModels(data as unknown as KitchenModel[]);
    };
    fetchModels();
  }, [open, blockType]);

  const handleConfirm = () => {
    onConfirm({
      blockType,
      width: round2(width),
      height: round2(height),
      depth: round2(depth),
      cabinetColor,
      countertopColor,
      countertopMaterial,
      handleStyle,
      modelUrl: selectedModelUrl || undefined,
    });
    onOpenChange(false);
  };

  const showCountertop = blockType === 'base-cabinet' || blockType === 'island' || blockType === 'countertop' || blockType.startsWith('appliance-');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest text-sm flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-primary" />
            Place Kitchen Block
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-1">
          <div className="space-y-4 pb-2">
            {/* Block Type Cards */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Block Type</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {BLOCK_TYPES.map(bt => (
                  <button
                    key={bt.value}
                    onClick={() => setBlockType(bt.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded border text-[10px] transition-all ${
                      blockType === bt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {bt.icon}
                    {bt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Width (cm)</Label>
                <Input type="number" step="1" min={10} value={round2(width)} onChange={e => setWidth(parseFloat(e.target.value) || 60)} className="h-7 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Height (cm)</Label>
                <Input type="number" step="1" min={3} value={round2(height)} onChange={e => setHeight(parseFloat(e.target.value) || 85)} className="h-7 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground">Depth (cm)</Label>
                <Input type="number" step="1" min={10} value={round2(depth)} onChange={e => setDepth(parseFloat(e.target.value) || 60)} className="h-7 text-xs" />
              </div>
            </div>

            {/* Cabinet Color */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cabinet Color</Label>
              <ColorPickerField value={cabinetColor} onChange={setCabinetColor} />
            </div>

            {/* Countertop */}
            {showCountertop && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Countertop Color</Label>
                  <ColorPickerField value={countertopColor} onChange={setCountertopColor} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Countertop Material</Label>
                  <Select value={countertopMaterial} onValueChange={v => setCountertopMaterial(v as CountertopMaterial)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="granite">Granite</SelectItem>
                      <SelectItem value="marble">Marble</SelectItem>
                      <SelectItem value="quartz">Quartz</SelectItem>
                      <SelectItem value="wood">Wood</SelectItem>
                      <SelectItem value="steel">Steel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Handle Style */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Handle Style</Label>
              <Select value={handleStyle} onValueChange={v => setHandleStyle(v as HandleStyle)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="knob">Knob</SelectItem>
                  <SelectItem value="integrated">Integrated</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model Picker */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">3D Model (optional)</Label>
              <Select value={selectedModelUrl || '__none__'} onValueChange={v => setSelectedModelUrl(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Default (procedural)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default (procedural)</SelectItem>
                  {models.map(m => (
                    <SelectItem key={m.id} value={m.model_url}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {models.length === 0 && (
                <p className="text-[10px] text-muted-foreground">No models for this type — will use procedural geometry</p>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>Place Block</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KitchenBlockDialog;
