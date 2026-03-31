import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Grid3X3, Droplets, RotateCcw, Settings2, Camera,
  Loader2, Box, LayoutGrid, Mountain, Eye, Bookmark, Trash2,
  Play, PersonStanding, Move3D, Lightbulb,
} from 'lucide-react';
import { QualitySettingsPanel, QualitySettings } from '@/components/design/QualitySettingsPanel';

interface SavedCameraView {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

interface DesignToolbarProps {
  giEnabled: boolean;
  setGiEnabled: (v: boolean) => void;
  qualitySettings: QualitySettings;
  setQualitySettings: (s: QualitySettings) => void;
  showTiles: boolean;
  setShowTiles: (v: boolean) => void;
  showCeiling: boolean;
  setShowCeiling: (v: boolean) => void;
  showPlumbing: boolean;
  setShowPlumbing: (v: boolean) => void;
  viewMode: 'design' | 'walkthrough';
  furnitureCount: number;
  fixtureCount: number;
  isRendering: boolean;
  onRender: () => void;
  onResetView: () => void;
  onAddLight: () => void;
  // Camera presets
  onPresetCorner: () => void;
  onPresetTopDown: () => void;
  onPresetEyeLevel: () => void;
  onPresetBirdseye: () => void;
  // Walkthrough
  isPreparingWalkthrough: boolean;
  onEnterWalkthrough: () => void;
  onExitWalkthrough: () => void;
  // Saved views
  savedViews: SavedCameraView[];
  onSaveView: (name: string) => void;
  onApplyView: (view: SavedCameraView) => void;
  onRemoveView: (id: string) => void;
  // Dragging
  isDragging: boolean;
}

export const DesignToolbar: React.FC<DesignToolbarProps> = ({
  giEnabled, setGiEnabled, qualitySettings, setQualitySettings,
  showTiles, setShowTiles, showCeiling, setShowCeiling,
  showPlumbing, setShowPlumbing, viewMode,
  furnitureCount, fixtureCount, isRendering, onRender, onResetView, onAddLight,
  onPresetCorner, onPresetTopDown, onPresetEyeLevel, onPresetBirdseye,
  isPreparingWalkthrough, onEnterWalkthrough, onExitWalkthrough,
  savedViews, onSaveView, onApplyView, onRemoveView, isDragging,
}) => {
  return (
    <div className="flex items-center gap-3 h-full overflow-x-auto">
      {/* Enhanced toggle */}
      <div className="flex items-center gap-1.5">
        <Switch id="toolbar-gi" checked={giEnabled} onCheckedChange={setGiEnabled} className="scale-75" />
        <Label htmlFor="toolbar-gi" className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="uppercase tracking-wider">Enhanced</span>
        </Label>
      </div>

      {viewMode === 'design' && giEnabled && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Settings2 className="h-3 w-3" />
              Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <ScrollArea className="h-[400px]">
              <QualitySettingsPanel
                settings={qualitySettings}
                onChange={setQualitySettings}
                disabled={!giEnabled}
              />
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      <div className="w-px h-4 bg-primary/15" />

      {/* Layer toggles */}
      <div className="flex items-center gap-1.5">
        <Switch id="toolbar-tiles" checked={showTiles} onCheckedChange={setShowTiles} className="scale-75" />
        <Label htmlFor="toolbar-tiles" className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
          <Grid3X3 className="h-3 w-3" />
          <span className="uppercase tracking-wider">Tiles</span>
        </Label>
      </div>

      {viewMode === 'design' && (
        <>
          <div className="flex items-center gap-1.5">
            <Switch id="toolbar-ceiling" checked={showCeiling} onCheckedChange={setShowCeiling} className="scale-75" />
            <Label htmlFor="toolbar-ceiling" className="text-xs text-muted-foreground uppercase tracking-wider cursor-pointer">
              Ceiling
            </Label>
          </div>

          <div className="flex items-center gap-1.5">
            <Switch id="toolbar-plumbing" checked={showPlumbing} onCheckedChange={setShowPlumbing} className="scale-75" />
            <Label htmlFor="toolbar-plumbing" className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <Droplets className="h-3 w-3 text-blue-500" />
              <span className="uppercase tracking-wider">Plumbing</span>
            </Label>
          </div>

          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onAddLight}>
            <Lightbulb className="h-3 w-3" />
            Light
          </Button>

          <div className="w-px h-4 bg-primary/15" />

          <Badge variant="outline" className="text-[10px] h-5 gap-1">{furnitureCount} Furn</Badge>
          <Badge variant="outline" className="text-[10px] h-5 gap-1">{fixtureCount} Fix</Badge>

          <div className="w-px h-4 bg-primary/15" />

          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onRender} disabled={isRendering}>
            {isRendering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            Render
          </Button>

          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onResetView}>
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>

          <div className="w-px h-4 bg-primary/15" />

          {/* Camera presets */}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onPresetCorner}><Box className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onPresetTopDown}><LayoutGrid className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onPresetEyeLevel}><Eye className="h-3 w-3" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onPresetBirdseye}><Mountain className="h-3 w-3" /></Button>

          <div className="w-px h-4 bg-primary/15" />

          {/* Saved views */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
                <Bookmark className={"h-3 w-3" + (savedViews.length > 0 ? " fill-current" : "")} />
                {savedViews.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] rounded-full h-3 w-3 flex items-center justify-center">
                    {savedViews.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" side="bottom" align="end">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="View name..."
                    className="flex-1 h-7 px-2 text-xs rounded-md border border-input bg-background"
                    id="save-view-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const name = e.currentTarget.value.trim();
                        if (!name) return;
                        onSaveView(name);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      const input = document.getElementById('save-view-input') as HTMLInputElement;
                      const name = input?.value.trim();
                      if (!name) return;
                      onSaveView(name);
                      input.value = '';
                    }}
                  >
                    Save
                  </Button>
                </div>
                <div className="space-y-1">
                  {savedViews.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No saved views yet.</p>
                  ) : (
                    savedViews.map(view => (
                      <div key={view.id} className="flex items-center gap-1.5 group">
                        <span className="text-xs truncate flex-1">{view.name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100" onClick={() => onApplyView(view)}>
                          <Play className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100 text-destructive" onClick={() => onRemoveView(view.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}

      <div className="w-px h-4 bg-primary/15" />

      {/* Walkthrough */}
      <Button
        variant={viewMode === 'walkthrough' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={viewMode === 'design' ? onEnterWalkthrough : onExitWalkthrough}
        disabled={isPreparingWalkthrough}
      >
        {isPreparingWalkthrough ? <Loader2 className="h-3 w-3 animate-spin" /> : <PersonStanding className="h-3 w-3" />}
        {isPreparingWalkthrough ? 'Preparing...' : viewMode === 'walkthrough' ? 'Exit Walk' : 'Walk'}
      </Button>

      {isDragging && (
        <Badge variant="outline" className="gap-1 animate-pulse text-[10px]">
          <Move3D className="h-3 w-3" />
          Dragging
        </Badge>
      )}
    </div>
  );
};
