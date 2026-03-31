import React from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  MousePointer2,
  Square,
  DoorOpen,
  Hand,
  X,
  Trash2,
  RotateCcw,
  Columns,
  Grid3X3,
  Undo2,
  Redo2,
  Ruler,
  LayoutTemplate,
  ImagePlus,
} from 'lucide-react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Tool = 'select' | 'wall' | 'door' | 'window' | 'pan' | 'column';

interface FloorPlanToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  isDrawingWall?: boolean;
  onCancelDrawing?: () => void;
  hasSelection?: boolean;
  onDeleteSelected?: () => void;
  onResetCanvas?: () => void;
  wallChainLength?: number;
  showDimensions?: boolean;
  onToggleDimensions?: () => void;
  onNewRoom?: () => void;
  onFromImage?: () => void;
}

export const FloorPlanToolbar: React.FC<FloorPlanToolbarProps> = ({
  activeTool,
  setActiveTool,
  showGrid,
  setShowGrid,
  isDrawingWall = false,
  onCancelDrawing,
  hasSelection = false,
  onDeleteSelected,
  onResetCanvas,
  wallChainLength = 0,
  showDimensions = true,
  onToggleDimensions,
  onNewRoom,
  onFromImage,
}) => {
  const { undo, redo, canUndo, canRedo } = useFloorPlanContext();

  return (
    <div className="flex items-center gap-1 h-full">
      {/* Selection Tools */}
      <Button
        variant={activeTool === 'select' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setActiveTool('select')}
        title="Select (V)"
      >
        <MousePointer2 className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant={activeTool === 'pan' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setActiveTool('pan')}
        title="Pan (Space)"
      >
        <Hand className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-primary/15" />

      {/* Drawing Tools */}
      <Button
        variant={activeTool === 'wall' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setActiveTool('wall')}
        title="Draw Wall (W)"
      >
        <Square className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant={activeTool === 'column' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setActiveTool('column')}
        title="Add Column (C)"
      >
        <Columns className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-primary/15" />

      {/* Openings */}
      <Button
        variant={activeTool === 'door' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setActiveTool('door')}
        title="Add Door (D)"
      >
        <DoorOpen className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant={activeTool === 'window' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => setActiveTool('window')}
        title="Add Window (N)"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      </Button>

      <div className="w-px h-4 bg-primary/15" />

      {/* Cancel Drawing */}
      {isDrawingWall && (
        <>
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancelDrawing}
            className="gap-1 h-7 text-xs"
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
          <Badge variant="outline" className="text-[10px] gap-1 h-5">
            {wallChainLength} wall{wallChainLength !== 1 ? 's' : ''}
          </Badge>
        </>
      )}

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-primary/15" />

      {/* Grid Toggle */}
      <Toggle
        pressed={showGrid}
        onPressedChange={setShowGrid}
        className="h-7 w-7 p-0"
        title="Toggle Grid (G)"
      >
        <Grid3X3 className="h-3.5 w-3.5" />
      </Toggle>

      {/* Dims Toggle */}
      <div className="flex items-center gap-1.5 ml-1">
        <Switch
          id="toolbar-dims"
          checked={showDimensions}
          onCheckedChange={() => onToggleDimensions?.()}
          className="scale-75"
        />
        <Label htmlFor="toolbar-dims" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
          <Ruler className="h-3 w-3" />
        </Label>
      </div>

      <div className="w-px h-4 bg-primary/15" />

      {/* Undo/Redo */}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undo} disabled={!canUndo}>
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={redo} disabled={!canRedo}>
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-primary/15" />

      {/* New Room & From Image */}
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onNewRoom}>
        <LayoutTemplate className="h-3.5 w-3.5" />
        New Room
      </Button>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onFromImage}>
        <ImagePlus className="h-3.5 w-3.5" />
        From Image
      </Button>

      <div className="w-px h-4 bg-primary/15" />

      {/* Reset */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Canvas?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all walls, doors, windows, columns, and fixtures. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onResetCanvas} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset Canvas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
