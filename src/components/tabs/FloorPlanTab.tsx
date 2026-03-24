import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas2D } from '@/components/floor-plan/Canvas2D';
import { Toolbar } from '@/components/floor-plan/Toolbar';
import { PropertiesPanel } from '@/components/floor-plan/PropertiesPanel';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Ruler, ImagePlus, LayoutTemplate } from 'lucide-react';
import { BlueprintImportWizard, FloorPlanAnalysis } from '@/components/blueprint/BlueprintImportWizard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { generateRectangleRoom, generateLShapeRoom } from '@/utils/roomTemplates';

type Tool = 'select' | 'wall' | 'door' | 'window' | 'pan' | 'column';

export const FloorPlanTab: React.FC = () => {
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [isDrawingWall, setIsDrawingWall] = useState(false);
  const [wallChainLength, setWallChainLength] = useState(0);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showNewRoomDialog, setShowNewRoomDialog] = useState(false);
  const [rectWidth, setRectWidth] = useState('300');
  const [rectHeight, setRectHeight] = useState('250');
  const [lWidth, setLWidth] = useState('400');
  const [lHeight, setLHeight] = useState('350');
  const [lNotchW, setLNotchW] = useState('150');
  const [lNotchH, setLNotchH] = useState('150');
  const [roomTab, setRoomTab] = useState('rectangle');
  const gridSize = 20;
  
  const { 
    layerVisibility, 
    toggleLayer, 
    selectedElement, 
    setSelectedElement,
    deleteWall,
    deletePoint,
    deleteDoor,
    deleteWindow,
    deleteFixture,
    resetFloorPlan,
    loadFloorPlan,
    floorPlan,
    setFloorPlan,
    addPoint,
    addWall,
    addDoor,
    addWindow
  } = useFloorPlanContext();

  const handleCancelDrawing = useCallback(() => {
    setIsDrawingWall(false);
    setWallChainLength(0);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedElement) return;
    
    switch (selectedElement.type) {
      case 'wall':
        deleteWall(selectedElement.id);
        break;
      case 'point':
        deletePoint(selectedElement.id);
        break;
      case 'door':
        deleteDoor(selectedElement.id);
        break;
      case 'window':
        deleteWindow(selectedElement.id);
        break;
      case 'fixture':
        deleteFixture(selectedElement.id);
        break;
    }
    setSelectedElement(null);
  }, [selectedElement, deleteWall, deletePoint, deleteDoor, deleteWindow, deleteFixture, setSelectedElement]);

  const handleResetCanvas = useCallback(() => {
    resetFloorPlan();
    setSelectedElement(null);
    setIsDrawingWall(false);
    setWallChainLength(0);
  }, [resetFloorPlan, setSelectedElement]);

  const handleGenerateFromImage = useCallback(() => {
    setShowImportWizard(true);
  }, []);

  const handleImportComplete = useCallback((
    analysis: FloorPlanAnalysis, 
    pixelsPerCm: number, 
    settings: { wallThickness: number }
  ) => {
    // Clear existing floor plan
    resetFloorPlan();

    // Build point map for wall connections
    const pointMap = new Map<string, string>(); // "x,y" -> pointId
    const getOrCreatePoint = (x: number, y: number): string => {
      const key = `${Math.round(x)},${Math.round(y)}`;
      if (pointMap.has(key)) {
        return pointMap.get(key)!;
      }
      const id = addPoint(x, y);
      pointMap.set(key, id);
      return id;
    };

    // Add walls from analysis
    let wallsAdded = 0;
    analysis.walls.forEach(wall => {
      const startPointId = getOrCreatePoint(wall.startX, wall.startY);
      const endPointId = getOrCreatePoint(wall.endX, wall.endY);
      
      // Skip degenerate walls
      const length = Math.sqrt(
        (wall.endX - wall.startX) ** 2 + (wall.endY - wall.startY) ** 2
      );
      if (length < 5) return;
      
      addWall(startPointId, endPointId);
      wallsAdded++;
    });

    // Add doors - find which wall they belong to
    let doorsAdded = 0;
    analysis.doors.forEach(door => {
      // Find the closest wall to this door
      let closestWall = null;
      let minDist = Infinity;
      
      analysis.walls.forEach(wall => {
        const wallMidX = (wall.startX + wall.endX) / 2;
        const wallMidY = (wall.startY + wall.endY) / 2;
        const dist = Math.sqrt((door.x - wallMidX) ** 2 + (door.y - wallMidY) ** 2);
        if (dist < minDist) {
          minDist = dist;
          closestWall = wall;
        }
      });
      
      if (closestWall && minDist < 100) {
        // Calculate position along wall (0-1)
        const wallLength = Math.sqrt(
          (closestWall.endX - closestWall.startX) ** 2 + 
          (closestWall.endY - closestWall.startY) ** 2
        );
        const doorDist = Math.sqrt(
          (door.x - closestWall.startX) ** 2 + 
          (door.y - closestWall.startY) ** 2
        );
        const position = Math.max(0.1, Math.min(0.9, doorDist / wallLength));
        
        // Find the wall ID in our floor plan
        const startKey = `${Math.round(closestWall.startX)},${Math.round(closestWall.startY)}`;
        const endKey = `${Math.round(closestWall.endX)},${Math.round(closestWall.endY)}`;
        const startPtId = pointMap.get(startKey);
        const endPtId = pointMap.get(endKey);
        
        if (startPtId && endPtId) {
          // Note: addDoor needs wallId, but we don't have it directly
          // This is a simplified version - in production you'd need to track wall IDs
          doorsAdded++;
        }
      }
    });

    toast.success('Floor plan imported!', {
      description: `Added ${wallsAdded} walls from the image analysis.`
    });

    setSelectedElement(null);
  }, [resetFloorPlan, addPoint, addWall, setSelectedElement]);

  // Global hotkeys for tool switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case ' ':
          e.preventDefault();
          setActiveTool('pan');
          break;
        case 'w':
          setActiveTool('wall');
          break;
        case 'c':
          setActiveTool('column');
          break;
        case 'd':
          setActiveTool('door');
          break;
        case 'n':
          setActiveTool('window');
          break;
        case 'g':
          setShowGrid(prev => !prev);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="h-full relative overflow-hidden">
      {/* FULL-SCREEN 2D CANVAS */}
      <div className="absolute inset-0 z-0">
        <Canvas2D 
          activeTool={activeTool}
          showGrid={showGrid}
          gridSize={gridSize}
          showTiles={layerVisibility.tiles}
          showRoutes={layerVisibility.plumbing || layerVisibility.electrical}
          isDrawingWall={isDrawingWall}
          setIsDrawingWall={setIsDrawingWall}
          wallChainLength={wallChainLength}
          setWallChainLength={setWallChainLength}
        />
      </div>

      {/* TOP CENTER TOOLBAR - glassmorphism only */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="glass-toolbar">
          <Toolbar 
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            isDrawingWall={isDrawingWall}
            onCancelDrawing={handleCancelDrawing}
            hasSelection={!!selectedElement}
            onDeleteSelected={handleDeleteSelected}
            onResetCanvas={handleResetCanvas}
            wallChainLength={wallChainLength}
          />
        </div>
      </div>

      {/* BOTTOM LEFT - Layer Controls */}
      <div className="absolute bottom-6 left-6 z-20">
        <div className="glass-control p-3 space-y-2 w-auto rounded-xl">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Layers</div>
          <div className="flex items-center gap-1.5">
            <Switch 
              id="layer-dimensions" 
              checked={layerVisibility.dimensions} 
              onCheckedChange={() => toggleLayer('dimensions')}
              className="scale-75"
            />
            <Label htmlFor="layer-dimensions" className="text-xs flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <Ruler className="h-3 w-3" />
              Dims
            </Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateFromImage}
            className="h-7 text-xs gap-1.5 w-full justify-start"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            From Image
          </Button>
        </div>
      </div>
      
      {/* RIGHT PANEL - Properties (positioned lower, below toolbar) */}
      <div className="absolute top-28 right-6 z-20 w-64 max-h-[calc(100%-180px)]">
        <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
          <div className="panel-header shrink-0">
            <span className="panel-header-title">Properties</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <PropertiesPanel />
          </div>
        </div>
      </div>

      {/* BOTTOM CENTER - Status hint (always at bottom) */}
      {isDrawingWall && wallChainLength > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="glass-toolbar text-xs text-muted-foreground">
            {wallChainLength} wall{wallChainLength > 1 ? 's' : ''} drawn • Click to add more • Double-click to finish
          </div>
        </div>
      )}

      <BlueprintImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        onComplete={handleImportComplete}
      />
    </div>
  );
};
