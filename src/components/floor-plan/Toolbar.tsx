import React from 'react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { 
  MousePointer2, 
  Square, 
  DoorOpen, 
  Grid3X3, 
  Undo2, 
  Redo2,
  Hand,
  X,
  Trash2,
  RotateCcw,
  Columns
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

interface ToolbarProps {
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
  currentAngle?: number | null;
  currentLength?: number | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({
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
  currentAngle = null,
  currentLength = null
}) => {
  const { undo, redo, canUndo, canRedo } = useFloorPlanContext();

  return (
    <div className="flex items-center justify-center gap-1 px-3 py-2 flex-wrap">
      {/* Selection Tools */}
      <button
        className={`btn-tech ${activeTool === 'select' ? 'active' : ''}`}
        onClick={() => setActiveTool('select')}
        title="Select (V)"
      >
        <MousePointer2 className="h-4 w-4" />
      </button>
      
      <button
        className={`btn-tech ${activeTool === 'pan' ? 'active' : ''}`}
        onClick={() => setActiveTool('pan')}
        title="Pan (Space)"
      >
        <Hand className="h-4 w-4" />
      </button>

      <div className="divider-tech mx-1" />

      {/* Drawing Tools */}
      <button
        className={`btn-tech ${activeTool === 'wall' ? 'active' : ''}`}
        onClick={() => setActiveTool('wall')}
        title="Draw Wall (W)"
      >
        <Square className="h-4 w-4" />
      </button>

      <button
        className={`btn-tech ${activeTool === 'column' ? 'active' : ''}`}
        onClick={() => setActiveTool('column')}
        title="Add Column (C)"
      >
        <Columns className="h-4 w-4" />
      </button>

      <div className="divider-tech mx-1" />

      {/* Openings */}
      <button
        className={`btn-tech ${activeTool === 'door' ? 'active' : ''}`}
        onClick={() => setActiveTool('door')}
        title="Add Door (D)"
      >
        <DoorOpen className="h-4 w-4" />
      </button>

      <button
        className={`btn-tech ${activeTool === 'window' ? 'active' : ''}`}
        onClick={() => setActiveTool('window')}
        title="Add Window (N)"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      </button>

      <div className="divider-tech mx-1" />

      {/* Cancel Drawing */}
      {isDrawingWall && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onCancelDrawing}
          title="Cancel Drawing (Esc)"
          className="gap-1 h-8"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      )}

      {/* Delete */}
      <button
        className="btn-tech"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        title="Delete Selected (Del)"
        style={{ opacity: hasSelection ? 1 : 0.4 }}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="divider-tech mx-1" />

      {/* Grid Toggle */}
      <Toggle
        pressed={showGrid}
        onPressedChange={setShowGrid}
        className="btn-tech data-[state=on]:active"
        title="Toggle Grid (G)"
      >
        <Grid3X3 className="h-4 w-4" />
      </Toggle>

      <div className="divider-tech mx-1" />

      {/* Undo/Redo */}
      <button
        className="btn-tech"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{ opacity: canUndo ? 1 : 0.4 }}
      >
        <Undo2 className="h-4 w-4" />
      </button>

      <button
        className="btn-tech"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={{ opacity: canRedo ? 1 : 0.4 }}
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="divider-tech mx-1" />

      {/* Reset */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="btn-tech text-destructive"
            title="Reset Canvas"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
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

      {/* Drawing Mode Indicator */}
      {isDrawingWall && (
        <div className="status-indicator ml-2">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="font-medium">
            Drawing{wallChainLength > 0 ? ` (${wallChainLength})` : ''}
          </span>
          {currentLength !== null && (
            <span className="text-primary/70 font-mono text-[10px]">
              {currentLength.toFixed(0)}cm
              {currentAngle !== null && ` @ ${currentAngle.toFixed(1)}°`}
            </span>
          )}
        </div>
      )}

      {/* Column Tool Indicator */}
      {activeTool === 'column' && (
        <div className="status-indicator ml-2">
          <Columns className="h-3 w-3" />
          <span className="font-medium">Column</span>
          <span className="text-primary/70 text-[10px]">Click to place</span>
        </div>
      )}
    </div>
  );
};
