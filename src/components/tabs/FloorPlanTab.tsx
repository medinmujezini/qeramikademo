import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Canvas2D } from '@/components/floor-plan/Canvas2D';
import { FloorPlanToolbar } from '@/components/toolbars/FloorPlanToolbar';
import { PropertiesPanel } from '@/components/floor-plan/PropertiesPanel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { BlueprintImportWizard, FloorPlanAnalysis } from '@/components/blueprint/BlueprintImportWizard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      case 'wall': deleteWall(selectedElement.id); break;
      case 'point': deletePoint(selectedElement.id); break;
      case 'door': deleteDoor(selectedElement.id); break;
      case 'window': deleteWindow(selectedElement.id); break;
      case 'fixture': deleteFixture(selectedElement.id); break;
    }
    setSelectedElement(null);
  }, [selectedElement, deleteWall, deletePoint, deleteDoor, deleteWindow, deleteFixture, setSelectedElement]);

  const handleResetCanvas = useCallback(() => {
    resetFloorPlan();
    setSelectedElement(null);
    setIsDrawingWall(false);
    setWallChainLength(0);
  }, [resetFloorPlan, setSelectedElement]);

  const handleImportComplete = useCallback((
    analysis: FloorPlanAnalysis, 
    pixelsPerCm: number, 
    settings: { wallThickness: number }
  ) => {
    resetFloorPlan();
    const pointMap = new Map<string, string>();
    const getOrCreatePoint = (x: number, y: number): string => {
      const key = `${Math.round(x)},${Math.round(y)}`;
      if (pointMap.has(key)) return pointMap.get(key)!;
      const id = addPoint(x, y);
      pointMap.set(key, id);
      return id;
    };

    let wallsAdded = 0;
    analysis.walls.forEach(wall => {
      const startPointId = getOrCreatePoint(wall.startX, wall.startY);
      const endPointId = getOrCreatePoint(wall.endX, wall.endY);
      const length = Math.sqrt((wall.endX - wall.startX) ** 2 + (wall.endY - wall.startY) ** 2);
      if (length < 5) return;
      addWall(startPointId, endPointId);
      wallsAdded++;
    });

    toast.success('Floor plan imported!', { description: `Added ${wallsAdded} walls from the image analysis.` });
    setSelectedElement(null);
  }, [resetFloorPlan, addPoint, addWall, setSelectedElement]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); break;
        case ' ': e.preventDefault(); setActiveTool('pan'); break;
        case 'w': setActiveTool('wall'); break;
        case 'c': setActiveTool('column'); break;
        case 'd': setActiveTool('door'); break;
        case 'n': setActiveTool('window'); break;
        case 'g': setShowGrid(prev => !prev); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') setActiveTool('select'); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  const validateRange = (v: string) => { const n = parseFloat(v); return !isNaN(n) && n >= 100 && n <= 2000; };

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
    <div className="h-full flex flex-col">
      {/* Layer 3 — contextual toolbar */}
      <div className="h-10 border-b border-t px-4 flex items-center justify-center shrink-0 relative" style={{ borderColor: 'hsl(var(--primary) / 0.10)', borderTopColor: 'hsl(var(--primary) / 0.08)', background: 'linear-gradient(90deg, hsl(var(--card)), hsl(var(--card)) 40%, hsl(38 60% 68% / 0.03) 50%, hsl(var(--card)) 60%, hsl(var(--card)))' }}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent" />
        <FloorPlanToolbar
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
          showDimensions={layerVisibility.dimensions}
          onToggleDimensions={() => toggleLayer('dimensions')}
          onNewRoom={() => setShowNewRoomDialog(true)}
          onFromImage={() => setShowImportWizard(true)}
        />
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
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

        {/* RIGHT PANEL - Properties */}
        <div className="absolute top-4 right-6 z-20 w-64 max-h-[calc(100%-48px)]">
          <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
            <div className="panel-header shrink-0">
              <span className="panel-header-title">Properties</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <PropertiesPanel />
            </div>
          </div>
        </div>
      </div>

      <BlueprintImportWizard
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
        onComplete={handleImportComplete}
      />

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
              {rectErrors.map((err, i) => <p key={i} className="text-xs text-destructive">{err}</p>)}
              <Button onClick={handleGenerateRoom} disabled={rectErrors.length > 0} className="w-full">Generate</Button>
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
              <div className="flex justify-center py-2">
                <svg width="120" height="100" viewBox="0 0 120 100" className="text-muted-foreground">
                  <path d="M10 10 L80 10 L80 45 L55 45 L55 90 L10 90 Z" fill="none" stroke="currentColor" strokeWidth="2" />
                  <text x="45" y="8" fontSize="8" textAnchor="middle" fill="currentColor">W</text>
                  <text x="4" y="55" fontSize="8" textAnchor="middle" fill="currentColor">H</text>
                  <text x="90" y="30" fontSize="7" textAnchor="start" fill="hsl(var(--destructive))">notch</text>
                </svg>
              </div>
              {lErrors.map((err, i) => <p key={i} className="text-xs text-destructive">{err}</p>)}
              <Button onClick={handleGenerateRoom} disabled={lErrors.length > 0} className="w-full">Generate</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};
