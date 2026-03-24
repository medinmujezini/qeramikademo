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

  const validateRange = (v: string) => {
    const n = parseFloat(v);
    return !isNaN(n) && n >= 100 && n <= 2000;
  };

  const rectErrors = useMemo(() => {
    const errs: string[] = [];
    if (!validateRange(rectWidth)) errs.push('Width must be 100–2000 cm');
    if (!validateRange(rectHeight)) errs.push('Height must be 100–2000 cm');
    return errs;
  }, [rectWidth, rectHeight]);

  const lErrors = useMemo(() => {
    const errs: string[] = [];
    if (!validateRange(lWidth)) errs.push('Width must be 100–2000 cm');
    if (!validateRange(lHeight)) errs.push('Height must be 100–2000 cm');
    if (!validateRange(lNotchW)) errs.push('Notch width must be 100–2000 cm');
    if (!validateRange(lNotchH)) errs.push('Notch height must be 100–2000 cm');
    if (validateRange(lNotchW) && validateRange(lWidth) && parseFloat(lNotchW) >= parseFloat(lWidth))
      errs.push('Notch width must be less than overall width');
    if (validateRange(lNotchH) && validateRange(lHeight) && parseFloat(lNotchH) >= parseFloat(lHeight))
      errs.push('Notch height must be less than overall height');
    return errs;
  }, [lWidth, lHeight, lNotchW, lNotchH]);

  const handleGenerateRoom = useCallback(() => {
    if (roomTab === 'rectangle') {
      if (rectErrors.length > 0) return;
      const plan = generateRectangleRoom(parseFloat(rectWidth), parseFloat(rectHeight));
      loadFloorPlan(plan);
    } else {
      if (lErrors.length > 0) return;
      const plan = generateLShapeRoom(parseFloat(lWidth), parseFloat(lHeight), parseFloat(lNotchW), parseFloat(lNotchH));
      loadFloorPlan(plan);
    }
    setShowNewRoomDialog(false);
    toast.success('Room generated!');
  }, [roomTab, rectWidth, rectHeight, lWidth, lHeight, lNotchW, lNotchH, rectErrors, lErrors, loadFloorPlan]);


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
            onClick={() => setShowNewRoomDialog(true)}
            className="h-7 text-xs gap-1.5 w-full justify-start"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            New Room
          </Button>
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

      {/* New Room Dialog */}
      <Dialog open={showNewRoomDialog} onOpenChange={setShowNewRoomDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New Room</DialogTitle>
          </DialogHeader>
          <Tabs value={roomTab} onValueChange={setRoomTab}>
            <TabsList className="w-full">
              <TabsTrigger value="rectangle" className="flex-1">Rectangle</TabsTrigger>
              <TabsTrigger value="lshape" className="flex-1">L-Shape</TabsTrigger>
            </TabsList>

            <TabsContent value="rectangle" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="rect-w" className="text-xs">Width (cm)</Label>
                <Input id="rect-w" type="number" value={rectWidth} onChange={e => setRectWidth(e.target.value)} min={100} max={2000} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rect-h" className="text-xs">Height (cm)</Label>
                <Input id="rect-h" type="number" value={rectHeight} onChange={e => setRectHeight(e.target.value)} min={100} max={2000} />
              </div>
              {rectErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive">{err}</p>
              ))}
              <Button onClick={handleGenerateRoom} disabled={rectErrors.length > 0} className="w-full">
                Generate
              </Button>
            </TabsContent>

            <TabsContent value="lshape" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="l-w" className="text-xs">Overall Width (cm)</Label>
                  <Input id="l-w" type="number" value={lWidth} onChange={e => setLWidth(e.target.value)} min={100} max={2000} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-h" className="text-xs">Overall Height (cm)</Label>
                  <Input id="l-h" type="number" value={lHeight} onChange={e => setLHeight(e.target.value)} min={100} max={2000} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-nw" className="text-xs">Notch Width (cm)</Label>
                  <Input id="l-nw" type="number" value={lNotchW} onChange={e => setLNotchW(e.target.value)} min={100} max={2000} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="l-nh" className="text-xs">Notch Height (cm)</Label>
                  <Input id="l-nh" type="number" value={lNotchH} onChange={e => setLNotchH(e.target.value)} min={100} max={2000} />
                </div>
              </div>
              {/* L-Shape diagram */}
              <div className="flex justify-center py-2">
                <svg width="120" height="100" viewBox="0 0 120 100" className="text-muted-foreground">
                  <path d="M10 10 L80 10 L80 45 L55 45 L55 90 L10 90 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <text x="45" y="8" fontSize="8" textAnchor="middle" fill="currentColor">W</text>
                  <text x="4" y="55" fontSize="8" textAnchor="middle" fill="currentColor">H</text>
                  <text x="90" y="30" fontSize="7" textAnchor="start" fill="hsl(var(--destructive))">notch</text>
                </svg>
              </div>
              {lErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive">{err}</p>
              ))}
              <Button onClick={handleGenerateRoom} disabled={lErrors.length > 0} className="w-full">
                Generate
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};
