/**
 * Floor Surface Dialog - Choose floor finish (tiles, hardwood, carpet)
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Grid3X3, Check, Square } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { TileLibraryPanel } from '@/components/tiles/TileLibraryPanel';
import { GroutColorPicker } from '@/components/tiles/GroutColorPicker';
import { useMaterialContext } from '@/contexts/MaterialContext';
import type { Tile, TilePattern, FloorSurfaceType } from '@/types/floorPlan';
import { cn } from '@/lib/utils';

// Hardwood/Carpet presets
const FLOOR_FINISHES = [
  { id: 'oak-light', name: 'Light Oak', type: 'hardwood' as const, color: '#deb887' },
  { id: 'oak-medium', name: 'Medium Oak', type: 'hardwood' as const, color: '#a0522d' },
  { id: 'walnut', name: 'Walnut', type: 'hardwood' as const, color: '#5d4037' },
  { id: 'maple', name: 'Maple', type: 'hardwood' as const, color: '#d4a574' },
  { id: 'cherry', name: 'Cherry', type: 'hardwood' as const, color: '#8b4513' },
  { id: 'bamboo', name: 'Bamboo', type: 'hardwood' as const, color: '#c4a35a' },
  { id: 'carpet-beige', name: 'Beige Carpet', type: 'carpet' as const, color: '#d4c4b0' },
  { id: 'carpet-gray', name: 'Gray Carpet', type: 'carpet' as const, color: '#9ca3af' },
  { id: 'carpet-blue', name: 'Blue Carpet', type: 'carpet' as const, color: '#6b7fad' },
  { id: 'carpet-green', name: 'Green Carpet', type: 'carpet' as const, color: '#7a9e7a' },
];

interface FloorSurfaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floorArea: number; // in square cm
  onApplyFinish: (type: FloorSurfaceType, color: string, materialId?: string, textureScaleCm?: number) => void;
  onApplyTiles: (tileId: string, groutColor: string, pattern: TilePattern) => void;
  onRemoveFinish: () => void;
  currentFinish?: { type?: FloorSurfaceType; surfaceType?: FloorSurfaceType; color?: string; tileId?: string };
}

export const FloorSurfaceDialog: React.FC<FloorSurfaceDialogProps> = ({
  open,
  onOpenChange,
  floorArea,
  onApplyFinish,
  onApplyTiles,
  onRemoveFinish,
  currentFinish,
}) => {
  const [activeTab, setActiveTab] = useState<'finish' | 'tiles'>('finish');
  const [selectedFinish, setSelectedFinish] = useState<typeof FLOOR_FINISHES[number] | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [groutColor, setGroutColor] = useState('#9ca3af');
  const [tilePattern, setTilePattern] = useState<TilePattern>('grid');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('none');
  const [textureScaleCm, setTextureScaleCm] = useState(30);

  const { materials } = useMaterialContext();
  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  const areaInSqM = floorArea / 10000;

  const handleApplyFinish = () => {
    // Allow applying with just a PBR material (no preset needed)
    const finishType = selectedFinish?.type || 'hardwood';
    const finishColor = selectedFinish?.color || '#d4cdc5';
    
    onApplyFinish(
      finishType,
      finishColor,
      selectedMaterialId !== 'none' ? selectedMaterialId : undefined,
      selectedMaterialId !== 'none' ? textureScaleCm : undefined,
    );
    onOpenChange(false);
  };

  const handleApplyTiles = () => {
    if (selectedTile) {
      onApplyTiles(selectedTile.id, groutColor, tilePattern);
      onOpenChange(false);
    }
  };

  const handleRemove = () => {
    onRemoveFinish();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Floor Surface Treatment
            <Badge variant="outline" className="font-normal">
              {areaInSqM.toFixed(1)} m²
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'finish' | 'tiles')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="finish" className="gap-2">
              <Square className="h-4 w-4" />
              Hardwood / Carpet
            </TabsTrigger>
            <TabsTrigger value="tiles" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              Tiles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="finish" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid grid-cols-5 gap-3">
                {FLOOR_FINISHES.map((finish) => (
                  <button
                    key={finish.id}
                    onClick={() => setSelectedFinish(finish)}
                    className={cn(
                      'relative aspect-square rounded-lg border-2 transition-all hover:scale-105 flex flex-col items-center justify-end p-2',
                      selectedFinish?.id === finish.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    )}
                    style={{ backgroundColor: finish.color }}
                  >
                    <span className="text-xs font-medium bg-background/80 px-1.5 py-0.5 rounded truncate max-w-full">
                      {finish.name}
                    </span>
                    {selectedFinish?.id === finish.id && (
                      <Check className="absolute top-1 right-1 h-4 w-4 text-primary drop-shadow-md" />
                    )}
                  </button>
                ))}
              </div>

              {/* PBR Material (optional) */}
              <div className="mt-4 p-3 border rounded-lg bg-muted/30 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">PBR Material (optional)</p>
                <div className="flex items-center gap-3">
                  {selectedMaterial?.albedo && (
                    <div
                      className="w-10 h-10 rounded border bg-cover bg-center flex-shrink-0"
                      style={{ backgroundImage: `url(${selectedMaterial.albedo})` }}
                    />
                  )}
                  <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="None (color only)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (color only)</SelectItem>
                      {materials.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedMaterialId !== 'none' && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Scale (cm per repeat)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={textureScaleCm}
                      onChange={(e) => setTextureScaleCm(Number(e.target.value) || 30)}
                      className="w-24 h-8"
                    />
                  </div>
                )}
              </div>

              {(selectedFinish || selectedMaterialId !== 'none') && (
                <div className="mt-4 flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{selectedFinish?.name || selectedMaterial?.name || 'PBR Material'}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedFinish?.type || 'hardwood'}
                      {selectedMaterialId !== 'none' && ' + PBR textures'}
                    </p>
                  </div>
                  <Button size="sm" onClick={handleApplyFinish}>
                    Apply to Floor
                  </Button>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tiles" className="mt-4">
            <div className="space-y-4">
              <TileLibraryPanel
                selectedTileId={selectedTile?.id}
                onTileSelect={setSelectedTile}
                showHeader={false}
                maxHeight="250px"
              />

              {selectedTile && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selectedTile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTile.width}×{selectedTile.height}cm
                      </p>
                    </div>
                    <Badge variant="secondary">
                      ${selectedTile.pricePerUnit}/unit
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-1.5 block">Pattern</label>
                      <select
                        value={tilePattern}
                        onChange={(e) => setTilePattern(e.target.value as TilePattern)}
                        className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="grid">Grid</option>
                        <option value="staggered">Staggered (Brick)</option>
                        <option value="herringbone">Herringbone</option>
                        <option value="diagonal">Diagonal</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium mb-1.5 block">Grout Color</label>
                      <GroutColorPicker
                        value={groutColor}
                        onChange={setGroutColor}
                        compact
                      />
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleApplyTiles}>
                    Apply Tiles to Floor
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {currentFinish && (currentFinish.type || currentFinish.surfaceType) !== 'plain' && (currentFinish.type || currentFinish.surfaceType) && (
          <div className="pt-4 border-t">
            <Button variant="outline" size="sm" onClick={handleRemove}>
              Remove Current Finish
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};