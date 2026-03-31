import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Grid3X3, ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface TilesToolbarProps {
  isApplyMode: boolean;
  selectedWallIndex: number;
  selectedTileName?: string;
  onApplyToWall?: () => void;
  showTilePreview: boolean;
  setShowTilePreview: (v: boolean) => void;
  wallCount: number;
  tiledWallCount: number;
}

export const TilesToolbar: React.FC<TilesToolbarProps> = ({
  isApplyMode, selectedWallIndex, selectedTileName, onApplyToWall,
  showTilePreview, setShowTilePreview, wallCount, tiledWallCount,
}) => {
  return (
    <div className="flex items-center gap-3 h-full">
      {isApplyMode && (
        <>
          <Badge variant="outline" className="gap-1 text-[10px] h-5">
            <ArrowLeft className="h-3 w-3" />
            Wall {selectedWallIndex + 1}
          </Badge>
          <span className="text-xs text-muted-foreground">Select tile & pattern</span>
          {selectedTileName && (
            <Button onClick={onApplyToWall} size="sm" className="gap-1 h-7 text-xs">
              <Grid3X3 className="h-3 w-3" />
              Apply
            </Button>
          )}
          <div className="w-px h-4 bg-primary/15" />
        </>
      )}

      <div className="flex items-center gap-1.5">
        <Switch
          id="toolbar-tile-preview"
          checked={showTilePreview}
          onCheckedChange={setShowTilePreview}
          className="scale-75"
        />
        <Label htmlFor="toolbar-tile-preview" className="text-xs text-muted-foreground uppercase tracking-wider cursor-pointer">
          Preview
        </Label>
      </div>

      <div className="w-px h-4 bg-primary/15" />

      <span className="text-xs text-muted-foreground">
        {tiledWallCount}/{wallCount} walls tiled
      </span>

      <span className="text-[10px] text-muted-foreground/60 ml-auto">
        Click walls to select · Use panels to configure
      </span>
    </div>
  );
};
