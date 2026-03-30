/**
 * Wall Surface Dialog - Choose color (paint/wallpaper) or redirect to Tiles tab
 * 
 * Simplified workflow:
 * - Color: Shows paint/wallpaper picker (existing functionality)
 * - Tiles: Redirects to Tiles tab where full tile configuration happens
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Paintbrush, Grid3X3, Check, Wallpaper, ArrowRight } from 'lucide-react';
import { PAINT_COLORS, WALLPAPER_PATTERNS, WallSurfaceType } from '@/types/floorPlan';
import type { Wall, Point } from '@/types/floorPlan';
import { cn } from '@/lib/utils';

interface WallSurfaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wall: Wall | null;
  wallStart: Point | null;
  wallEnd: Point | null;
  onApplyPaint: (wallId: string, color: string) => void;
  onApplyWallpaper: (wallId: string, patternId: string) => void;
  onRemoveFinish: (wallId: string) => void;
  onOpenTilesTab: (wallId: string) => void; // Redirect to tiles tab
  currentFinish?: { type: WallSurfaceType; color?: string; patternId?: string; tileId?: string };
  // Live preview callbacks
  onPreviewPaint?: (wallId: string, color: string | null) => void;
  onPreviewWallpaper?: (wallId: string, patternId: string | null) => void;
}

type DialogView = 'choose' | 'color';

export const WallSurfaceDialog: React.FC<WallSurfaceDialogProps> = ({
  open,
  onOpenChange,
  wall,
  wallStart,
  wallEnd,
  onApplyPaint,
  onApplyWallpaper,
  onRemoveFinish,
  onOpenTilesTab,
  currentFinish,
  onPreviewPaint,
  onPreviewWallpaper,
}) => {
  const [view, setView] = useState<DialogView>('choose');
  const [selectedPaintColor, setSelectedPaintColor] = useState<string | null>(
    currentFinish?.type === 'paint' ? currentFinish.color || null : null
  );
  const [selectedWallpaperId, setSelectedWallpaperId] = useState<string | null>(
    currentFinish?.type === 'wallpaper' ? currentFinish.patternId || null : null
  );

  // Reset view when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setView('choose');
      // Reset selections based on current finish
      setSelectedPaintColor(currentFinish?.type === 'paint' ? currentFinish.color || null : null);
      setSelectedWallpaperId(currentFinish?.type === 'wallpaper' ? currentFinish.patternId || null : null);
    }
  }, [open, currentFinish]);

  if (!wall) return null;

  const wallLength = wallStart && wallEnd 
    ? Math.sqrt((wallEnd.x - wallStart.x) ** 2 + (wallEnd.y - wallStart.y) ** 2) 
    : 0;

  const handleApplyPaint = () => {
    if (selectedPaintColor) {
      onApplyPaint(wall.id, selectedPaintColor);
      onOpenChange(false);
    }
  };

  const handleApplyWallpaper = () => {
    if (selectedWallpaperId) {
      onApplyWallpaper(wall.id, selectedWallpaperId);
      onOpenChange(false);
    }
  };

  const handleRemove = () => {
    onRemoveFinish(wall.id);
    onOpenChange(false);
  };

  const handleChooseTiles = () => {
    onOpenChange(false);
    onOpenTilesTab(wall.id);
  };

  const handleChooseColor = () => {
    setView('color');
  };

  const handleBack = () => {
    setView('choose');
    // Clear previews when going back
    onPreviewPaint?.(wall.id, null);
    onPreviewWallpaper?.(wall.id, null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Wall Surface Treatment
            <Badge variant="outline" className="font-normal">
              {Math.round(wallLength)}cm × {wall.height}cm
            </Badge>
          </DialogTitle>
          {view === 'choose' && (
            <DialogDescription>
              Choose how you want to finish this wall
            </DialogDescription>
          )}
        </DialogHeader>

        {view === 'choose' ? (
          /* Initial choice view */
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              {/* Color option */}
              <button
                onClick={handleChooseColor}
                className="group p-6 border-2 rounded-xl hover:border-primary hover:bg-accent/50 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Paintbrush className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg">Color</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Apply paint or wallpaper to the wall
                </p>
                <div className="flex gap-1">
                  {PAINT_COLORS.slice(0, 6).map((paint) => (
                    <div
                      key={paint.id}
                      className="w-5 h-5 rounded-full border"
                      style={{ backgroundColor: paint.color }}
                    />
                  ))}
                </div>
              </button>

              {/* Tiles option */}
              <button
                onClick={handleChooseTiles}
                className="group p-6 border-2 rounded-xl hover:border-primary hover:bg-accent/50 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Grid3X3 className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg">Tiles</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Configure tiles with patterns & grout
                </p>
                <div className="flex items-center gap-1 text-sm text-primary">
                  Opens Tiles tab
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            </div>

            {currentFinish && currentFinish.type !== 'plain' && (
              <div className="pt-4 border-t">
                <Button variant="outline" size="sm" onClick={handleRemove}>
                  Remove Current Finish
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Color selection view */
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 -ml-2">
              ← Back to options
            </Button>

            <ScrollArea className="h-[350px] pr-4">
              {/* Paint Colors */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Paintbrush className="h-4 w-4" />
                  Paint Colors
                </h4>
                <div className="grid grid-cols-6 gap-2">
                  {PAINT_COLORS.map((paint) => (
                    <button
                      key={paint.id}
                      onClick={() => {
                        setSelectedPaintColor(paint.color);
                        setSelectedWallpaperId(null);
                        onPreviewWallpaper?.(wall.id, null);
                      }}
                      onMouseEnter={() => onPreviewPaint?.(wall.id, paint.color)}
                      onMouseLeave={() => {
                        onPreviewPaint?.(wall.id, selectedPaintColor);
                      }}
                      className={cn(
                        'relative aspect-square rounded-lg border-2 transition-all hover:scale-105',
                        selectedPaintColor === paint.color
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      )}
                      style={{ backgroundColor: paint.color }}
                      
                    >
                      {selectedPaintColor === paint.color && (
                        <Check className="absolute inset-0 m-auto h-5 w-5 text-primary drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
                {selectedPaintColor && !selectedWallpaperId && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Selected: {PAINT_COLORS.find(p => p.color === selectedPaintColor)?.name}
                    </span>
                    <Button size="sm" onClick={handleApplyPaint}>
                      Apply Paint
                    </Button>
                  </div>
                )}
              </div>

              {/* Wallpaper Patterns */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Wallpaper className="h-4 w-4" />
                  Wallpaper Patterns
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  {WALLPAPER_PATTERNS.map((wp) => (
                    <button
                      key={wp.id}
                      onClick={() => {
                        setSelectedWallpaperId(wp.id);
                        setSelectedPaintColor(null);
                        onPreviewPaint?.(wall.id, null);
                      }}
                      onMouseEnter={() => onPreviewWallpaper?.(wall.id, wp.id)}
                      onMouseLeave={() => {
                        onPreviewWallpaper?.(wall.id, selectedWallpaperId);
                      }}
                      className={cn(
                        'relative p-3 rounded-lg border-2 transition-all hover:scale-105 text-left',
                        selectedWallpaperId === wp.id
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      )}
                      style={{ 
                        background: `linear-gradient(45deg, ${wp.baseColor} 25%, ${wp.accentColor} 25%, ${wp.accentColor} 50%, ${wp.baseColor} 50%, ${wp.baseColor} 75%, ${wp.accentColor} 75%)`,
                        backgroundSize: '20px 20px'
                      }}
                    >
                      <span className="text-xs font-medium bg-background/80 px-1.5 py-0.5 rounded">
                        {wp.name}
                      </span>
                      {selectedWallpaperId === wp.id && (
                        <Check className="absolute top-1 right-1 h-4 w-4 text-primary drop-shadow-md" />
                      )}
                    </button>
                  ))}
                </div>
                {selectedWallpaperId && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Selected: {WALLPAPER_PATTERNS.find(p => p.id === selectedWallpaperId)?.name}
                    </span>
                    <Button size="sm" onClick={handleApplyWallpaper}>
                      Apply Wallpaper
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
