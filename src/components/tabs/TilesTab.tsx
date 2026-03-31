import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Tile, WallTileSection, isWallCurved, isWallSloped, isTileSuitableForCurve, getRecommendedTileSize, TILE_LIBRARY, TilePattern } from '@/types/floorPlan';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TilesCanvas } from '@/components/tiles/TilesCanvas';
import { WallElevationViewer } from '@/components/tiles/WallElevationViewer';
import { TileLibraryPanel } from '@/components/tiles/TileLibraryPanel';
import { GroutColorPicker } from '@/components/tiles/GroutColorPicker';

import { 
  calculateWallDimensions, 
  calculateTileLayout, 
  calculateMaterials,
  calculateFullTileEstimate,
  calculateProjectFromSections,
  CutOptimizationResult
} from '@/utils/tileCalculator';
import { generateCutListPDF } from '@/utils/pdfExport';
import { calculateArcInfo } from '@/utils/arcUtils';
import { useTileTemplates } from '@/hooks/useTemplatesFromDB';
import { Grid3X3, Paintbrush, Check, Calculator, ChevronRight, Scissors, Recycle, AlertTriangle, Waves, TrendingUp, FileDown, Loader2, ArrowLeft, Eye, EyeOff, X } from 'lucide-react';
import { TileCalculationsPanel } from '@/components/tiles/TileCalculationsPanel';

interface TilesTabProps {
  pendingWallId?: string | null;
  onApplyComplete?: (wallId: string, tileSettings: WallTileSection) => void;
}

export const TilesTab: React.FC<TilesTabProps> = ({
  pendingWallId,
  onApplyComplete,
}) => {
  const { floorPlan, assignTileToWall, updateWallTileSections, setWallFinish, setAllWallsFinish } = useFloorPlanContext();
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(pendingWallId || null);
  const [jointWidth, setJointWidth] = useState(3);
  const [groutColor, setGroutColor] = useState('#d1d5db');
  const [showTilePreview, setShowTilePreview] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [tilePattern, setTilePattern] = useState<'grid' | 'staggered' | 'herringbone' | 'diagonal'>('grid');
  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'calculations' | null>(null);
  const [showTileLibrary, setShowTileLibrary] = useState(true);

  // Auto-select pending wall when it changes
  React.useEffect(() => {
    if (pendingWallId) {
      setSelectedWallId(pendingWallId);
    }
  }, [pendingWallId]);
  
  // Fetch tiles from database
  const { data: dbTiles } = useTileTemplates();
  
  // Build tile lookup that combines DB tiles with fallback
  const tileLibrary = useMemo(() => {
    if (dbTiles && dbTiles.length > 0) {
      return dbTiles.map(t => ({
        id: t.id,
        name: t.name,
        width: t.dimensions.width,
        height: t.dimensions.height,
        color: t.defaultColor,
        material: t.material as Tile['material'],
        pricePerUnit: t.pricePerUnit,
        isFlexible: t.isFlexible,
        minCurveRadius: t.minCurveRadius,
        materialId: t.materialId,
        textureScaleCm: t.textureScaleCm,
      }));
    }
    return TILE_LIBRARY;
  }, [dbTiles]);
  
  // Find tile by ID from our library
  const findTile = useCallback((tileId: string) => {
    return tileLibrary.find(t => t.id === tileId);
  }, [tileLibrary]);

  // Get selected wall and its index
  const selectedWall = useMemo(() => 
    floorPlan.walls.find(w => w.id === selectedWallId) ?? null,
    [floorPlan.walls, selectedWallId]
  );

  const selectedWallIndex = useMemo(() => 
    floorPlan.walls.findIndex(w => w.id === selectedWallId),
    [floorPlan.walls, selectedWallId]
  );

  // Get tile assigned to selected wall (if any)
  const selectedWallTileSection = useMemo(() => 
    floorPlan.tileSections.find(s => s.wallId === selectedWallId),
    [floorPlan.tileSections, selectedWallId]
  );

  const selectedWallTile = useMemo(() => 
    selectedWallTileSection ? findTile(selectedWallTileSection.tileId) : null,
    [selectedWallTileSection, findTile]
  );

  // Effective tile: library selection OR wall's assigned tile
  const effectiveTile = selectedTile || selectedWallTile;

  // Calculate wall dimensions with curved/sloped info
  const wallDimensions = useMemo(() => 
    calculateWallDimensions(floorPlan.walls, floorPlan.points),
    [floorPlan.walls, floorPlan.points]
  );

  // Selected wall dimension
  const selectedWallDimension = useMemo(() => 
    wallDimensions.find(d => d.wallId === selectedWallId),
    [wallDimensions, selectedWallId]
  );
  
  // Get selected wall object for curved/sloped checks
  const selectedWallObj = useMemo(() => 
    floorPlan.walls.find(w => w.id === selectedWallId),
    [floorPlan.walls, selectedWallId]
  );
  
  // Check if selected tile is suitable for selected wall
  const tileWarning = useMemo(() => {
    if (!selectedTile || !selectedWallObj || !selectedWallDimension) return null;
    
    if (selectedWallDimension.isCurved && selectedWallDimension.curveRadius) {
      if (!isTileSuitableForCurve(selectedTile, selectedWallDimension.curveRadius)) {
        const rec = getRecommendedTileSize(selectedWallDimension.curveRadius);
        return {
          type: 'curve',
          message: `Large tiles not recommended for this curved wall (R=${selectedWallDimension.curveRadius.toFixed(0)}cm)`,
          recommendation: rec.recommendation
        };
      }
    }
    return null;
  }, [selectedTile, selectedWallObj, selectedWallDimension]);
  
  // Count special walls
  const curvedWallCount = useMemo(() => 
    floorPlan.walls.filter(w => isWallCurved(w)).length,
    [floorPlan.walls]
  );
  
  const slopedWallCount = useMemo(() => 
    floorPlan.walls.filter(w => isWallSloped(w)).length,
    [floorPlan.walls]
  );

  const totalWallArea = useMemo(() => 
    wallDimensions.reduce((sum, d) => sum + d.area, 0),
    [wallDimensions]
  );

  const totalPerimeter = useMemo(() => 
    wallDimensions.reduce((sum, d) => sum + (d.length * 2 + d.height * 2) / 100, 0),
    [wallDimensions]
  );

  // Calculation for selected wall only (with wastage factors)
  const selectedWallCalculation = useMemo(() => {
    if (!effectiveTile || !selectedWallDimension) return null;
    
    // Pass slope info for proper angled cut calculations
    const slopeInfo = selectedWallDimension.isSlopedHeight && selectedWallDimension.startHeight && selectedWallDimension.endHeight
      ? { startHeight: selectedWallDimension.startHeight, endHeight: selectedWallDimension.endHeight }
      : undefined;
    
    const layout = calculateTileLayout(
      selectedWallDimension.length, 
      selectedWallDimension.height, 
      effectiveTile, 
      0, 
      0, 
      jointWidth,
      'grid',
      slopeInfo
    );
    const materials = calculateMaterials(selectedWallDimension.area, (selectedWallDimension.length * 2 + selectedWallDimension.height * 2) / 100, effectiveTile, jointWidth);
    
    // Apply wastage factors
    const baseTileCount = layout.fullTiles + layout.cutTiles.reduce((sum, c) => sum + c.count, 0);
    const wastageFactor = selectedWallDimension.curveWastageFactor * selectedWallDimension.slopeWastageFactor;
    const adjustedTileCount = Math.ceil(baseTileCount * wastageFactor);
    
    return {
      ...layout,
      totalTiles: adjustedTileCount,
      baseTiles: baseTileCount,
      area: selectedWallDimension.area,
      ...materials,
      cost: adjustedTileCount * effectiveTile.pricePerUnit,
      wastageFactor,
      isCurved: selectedWallDimension.isCurved,
      curveRadius: selectedWallDimension.curveRadius,
      isSloped: selectedWallDimension.isSlopedHeight,
      slopeAngle: selectedWallDimension.slopeAngle
    };
  }, [effectiveTile, selectedWallDimension, jointWidth]);

  // Full project calculation with cut tiles
  const fullCalculation = useMemo(() => {
    if (!effectiveTile) return null;
    return calculateFullTileEstimate(floorPlan.walls, floorPlan.points, effectiveTile, 1.1, jointWidth);
  }, [effectiveTile, floorPlan.walls, floorPlan.points, jointWidth]);

  // Per-wall breakdown with special wall info
  const wallBreakdown = useMemo(() => {
    if (!effectiveTile) return [];
    return wallDimensions.map((dim, idx) => {
      const layout = calculateTileLayout(dim.length, dim.height, effectiveTile, 0, 0, jointWidth);
      const section = floorPlan.tileSections.find(s => s.wallId === dim.wallId);
      const wall = floorPlan.walls[idx];
      
      return {
        wallId: dim.wallId,
        length: dim.length,
        height: dim.height,
        area: dim.area,
        fullTiles: layout.fullTiles,
        cutTiles: layout.cutTiles,
        totalTiles: layout.fullTiles + layout.cutTiles.reduce((sum, c) => sum + c.count, 0),
        hasTile: !!section,
        assignedTileId: section?.tileId,
        isCurved: dim.isCurved,
        curveRadius: dim.curveRadius,
        isSloped: dim.isSlopedHeight,
        slopeAngle: dim.slopeAngle,
        curveWastageFactor: dim.curveWastageFactor,
        slopeWastageFactor: dim.slopeWastageFactor
      };
    });
  }, [effectiveTile, wallDimensions, floorPlan.tileSections, floorPlan.walls, jointWidth]);

  const materials = useMemo(() => {
    if (!effectiveTile) return null;
    return calculateMaterials(totalWallArea, totalPerimeter, effectiveTile, jointWidth);
  }, [effectiveTile, totalWallArea, totalPerimeter, jointWidth]);

  const totalCost = useMemo(() => {
    if (!effectiveTile || !fullCalculation) return 0;
    return fullCalculation.totalTiles * effectiveTile.pricePerUnit;
  }, [effectiveTile, fullCalculation]);

  // Project calculation from actual assigned sections (with cut optimization)
  const projectCalculation = useMemo(() => {
    if (floorPlan.tileSections.length === 0) return null;
    return calculateProjectFromSections(floorPlan.walls, floorPlan.points, floorPlan.tileSections, tileLibrary);
  }, [floorPlan.walls, floorPlan.points, floorPlan.tileSections, tileLibrary]);

  // Helper to set wall finish with cached tile data for 3D rendering
  const applyWallFinish = useCallback((wallId: string, tileId: string, settings: Partial<WallTileSection>) => {
    const tile = findTile(tileId);
    setWallFinish(wallId, 'tiles', {
      tileId,
      groutColor: settings.groutColor || groutColor,
      pattern: settings.pattern || 'grid',
      jointWidth: jointWidth,
      orientation: settings.orientation || 'horizontal',
      offsetX: settings.offsetX || 0,
      offsetY: settings.offsetY || 0,
      tileWidth: tile?.width,
      tileHeight: tile?.height,
      tileColor: tile?.color,
      tileMaterial: tile?.material,
    });
  }, [findTile, setWallFinish, groutColor, jointWidth]);

  // Handle applying tiles with settings from elevation viewer
  const handleApplyTile = useCallback((wallId: string, settings: Partial<WallTileSection>) => {
    if (settings.tileId) {
      assignTileToWall(wallId, settings.tileId, settings);
      applyWallFinish(wallId, settings.tileId, settings);
    }
  }, [assignTileToWall, applyWallFinish]);

  // Handle saving multiple sections for a wall
  const handleSaveSections = useCallback((wallId: string, sections: Partial<WallTileSection>[]) => {
    if (sections.length > 0 && sections.some(s => s.tileId)) {
      updateWallTileSections(wallId, sections);
      // Also set wall finish for the first section's tile (for 3D rendering)
      const firstTiled = sections.find(s => s.tileId);
      if (firstTiled?.tileId) {
        applyWallFinish(wallId, firstTiled.tileId, firstTiled);
      }
    }
  }, [updateWallTileSections, applyWallFinish]);

  const handleApplyToAllWalls = useCallback((settings: Partial<WallTileSection>) => {
    if (!settings.tileId) return;
    const tile = findTile(settings.tileId);
    // Use batched single-state-update to apply to ALL walls atomically
    setAllWallsFinish('tiles', {
      tileId: settings.tileId,
      groutColor: settings.groutColor || groutColor,
      pattern: settings.pattern || 'grid',
      jointWidth: jointWidth,
      orientation: settings.orientation || 'horizontal',
      offsetX: settings.offsetX || 0,
      offsetY: settings.offsetY || 0,
      tileWidth: tile?.width,
      tileHeight: tile?.height,
      tileColor: tile?.color,
      tileMaterial: tile?.material,
    });
    toast.success(`Tile applied to all ${floorPlan.walls.length} walls`);
  }, [floorPlan.walls.length, findTile, setAllWallsFinish, groutColor, jointWidth]);

  // Count walls with tiles assigned
  const tiledWallCount = useMemo(() => {
    const tiledWallIds = new Set(floorPlan.tileSections.map(s => s.wallId));
    return tiledWallIds.size;
  }, [floorPlan.tileSections]);

  // PDF Export handler
  const handleExportPDF = useCallback(async () => {
    if (!projectCalculation?.optimization || !projectCalculation.walls) return;
    
    setIsExportingPDF(true);
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      generateCutListPDF({
        projectName: floorPlan.name,
        optimization: projectCalculation.optimization,
        wallResults: projectCalculation.walls,
        walls: floorPlan.walls,
        points: floorPlan.points,
        tiles: tileLibrary
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsExportingPDF(false);
    }
  }, [projectCalculation, floorPlan, tileLibrary]);

  // Apply tiles to wall and trigger navigation back to Design tab
  const handleApplyToWall = useCallback(() => {
    if (!selectedWallId || !selectedTile) return;

    // Create tile section settings for full wall coverage
    const tileSettings: WallTileSection = {
      id: `tile-section-${selectedWallId}`,
      wallId: selectedWallId,
      tileId: selectedTile.id,
      startPosition: 0,
      endPosition: 1,
      startHeight: 0,
      endHeight: 1,
      orientation: 'horizontal',
      pattern: tilePattern,
      offsetX: 0,
      offsetY: 0,
      groutColor: groutColor,
    };

    // Apply tiles via wall finish (for 3D rendering) - pass ALL settings including cached tile data
    setWallFinish(selectedWallId, 'tiles', {
      tileId: selectedTile.id,
      groutColor: groutColor,
      pattern: tilePattern,
      jointWidth: jointWidth,
      orientation: 'horizontal',
      offsetX: 0,
      offsetY: 0,
      // Cache tile properties for 3D rendering (avoids DB lookup)
      tileWidth: selectedTile.width,
      tileHeight: selectedTile.height,
      tileColor: selectedTile.color,
      tileMaterial: selectedTile.material,
    });

    // Also save as tile section for calculations
    assignTileToWall(selectedWallId, selectedTile.id, tileSettings);

    // Notify parent to switch to Design tab with animation
    onApplyComplete?.(selectedWallId, tileSettings);
  }, [selectedWallId, selectedTile, tilePattern, groutColor, jointWidth, setWallFinish, assignTileToWall, onApplyComplete]);

  // Check if we're in "apply to wall" mode (came from Design tab)
  const isApplyMode = !!pendingWallId;

  return (
    <div className="h-full flex flex-col">
      {/* Layer 3 — contextual toolbar */}
      <div className="h-10 border-b border-t px-4 flex items-center justify-center shrink-0 relative" style={{ borderColor: 'hsl(var(--primary) / 0.10)', borderTopColor: 'hsl(var(--primary) / 0.08)', background: 'linear-gradient(90deg, hsl(var(--card)), hsl(var(--card)) 40%, hsl(38 60% 68% / 0.03) 50%, hsl(var(--card)) 60%, hsl(var(--card)))' }}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent" />
        <div className="flex items-center gap-3 h-full">
          {isApplyMode && selectedWallId && (
            <>
              <Badge variant="outline" className="gap-1 text-[10px] h-5">
                <ArrowLeft className="h-3 w-3" />
                Wall {selectedWallIndex + 1}
              </Badge>
              <span className="text-xs text-muted-foreground">Select tile & pattern</span>
              {selectedTile && (
                <Button onClick={handleApplyToWall} size="sm" className="gap-1 h-7 text-xs">
                  <Grid3X3 className="h-3 w-3" />
                  Apply
                </Button>
              )}
              <div className="w-px h-4 bg-primary/15" />
            </>
          )}
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Preview</span>
          </div>
          <div className="w-px h-4 bg-primary/15" />
          <span className="text-xs text-muted-foreground">{tiledWallCount}/{floorPlan.walls.length} walls tiled</span>
          <span className="text-[10px] text-muted-foreground/60 ml-auto">Click walls to select · Use panels to configure</span>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <TilesCanvas
          selectedWallId={selectedWallId}
          onWallSelect={setSelectedWallId}
          selectedTile={selectedTile}
          jointWidth={jointWidth}
          showTilePreview={showTilePreview}
          pendingWallId={pendingWallId}
        />
      {/* LEFT PANEL - Tile Library */}
      {showTileLibrary ? (
        <div className="absolute top-4 left-6 z-20 w-52 max-h-[calc(100%-48px)]">
          <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
            <div className="panel-header shrink-0 flex items-center justify-between">
              <span className="panel-header-title">Tile Library</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowTileLibrary(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                <TileLibraryPanel
                  selectedTileId={selectedTile?.id}
                  onTileSelect={setSelectedTile}
                  maxHeight="180px"
                />

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <Label className="text-xs text-muted-foreground">Joint: {jointWidth}mm</Label>
                  <Slider
                    value={[jointWidth]}
                    onValueChange={([v]) => setJointWidth(v)}
                    min={1}
                    max={10}
                    step={0.5}
                  />
                </div>
                
                <GroutColorPicker
                  value={groutColor}
                  onChange={setGroutColor}
                  compact
                />
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        <div className="absolute top-4 left-6 z-20">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 rounded-lg text-xs shadow-md backdrop-blur-sm glass-control"
            onClick={() => setShowTileLibrary(true)}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Tile Library
          </Button>
        </div>
      )}

      {/* BOTTOM LEFT - Stats card */}
      <div className="absolute bottom-6 left-6 z-20">
        <div className="glass-control p-3 space-y-1 text-xs rounded-xl">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Walls</span>
            <span className="font-medium">{floorPlan.walls.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Tiled</span>
            <span className="font-medium">{tiledWallCount}/{floorPlan.walls.length}</span>
          </div>
          {fullCalculation && (
            <div className="flex justify-between gap-4 pt-1 border-t border-white/10">
              <span className="text-muted-foreground">Est. Cost</span>
              <span className="font-bold">${totalCost.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT TOP - Toggle Buttons */}
      <div className="absolute top-4 right-4 z-30 flex gap-1.5">
        <Button
          variant={rightPanelTab === 'preview' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 h-9 rounded-lg text-xs shadow-md backdrop-blur-sm"
          onClick={() => setRightPanelTab(rightPanelTab === 'preview' ? null : 'preview')}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          Preview
        </Button>
        <Button
          variant={rightPanelTab === 'calculations' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 h-9 rounded-lg text-xs shadow-md backdrop-blur-sm"
          onClick={() => setRightPanelTab(rightPanelTab === 'calculations' ? null : 'calculations')}
        >
          <Calculator className="h-3.5 w-3.5" />
          Calculations
        </Button>
      </div>

      {/* RIGHT PANEL - Full height, wide */}
      {rightPanelTab && (
        <div className="absolute top-0 right-0 z-20 w-[420px] h-full border-l border-border/50 bg-background/95 backdrop-blur-md flex flex-col shadow-2xl overflow-x-hidden overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 mt-1">
            <span className="text-sm font-semibold capitalize">{rightPanelTab}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-md"
              onClick={() => setRightPanelTab(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {rightPanelTab === 'preview' && !selectedWall && (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 gap-3">
                <Grid3X3 className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Select a wall to see tile details</p>
              </div>
            )}
            {rightPanelTab === 'preview' && selectedWall && (
              <WallElevationViewer
                wall={selectedWall}
                wallIndex={selectedWallIndex}
                selectedTile={selectedTile}
                jointWidth={jointWidth}
                groutColor={groutColor}
                tiles={tileLibrary}
                onApplyTile={handleApplyTile}
                onApplyToAll={handleApplyToAllWalls}
                onSaveSections={handleSaveSections}
              />
            )}
            {rightPanelTab === 'calculations' && (
              <TileCalculationsPanel
                projectCalculation={projectCalculation}
                wallBreakdown={wallBreakdown.map((wb, idx) => ({
                  wallId: wb.wallId,
                  wallName: `Wall ${String.fromCharCode(65 + idx)}`,
                  area: wb.area,
                  fullTiles: wb.fullTiles,
                  cutTiles: wb.cutTiles.reduce((sum, c) => sum + c.count, 0),
                  isCurved: wb.isCurved,
                  isSloped: wb.isSloped,
                  wastageFactor: wb.curveWastageFactor || wb.slopeWastageFactor || 1,
                  assignedTile: wb.assignedTileId ?? null,
                }))}
                materials={materials}
                totalCost={totalCost}
                onExportPDF={handleExportPDF}
                isExportingPDF={isExportingPDF}
                curvedWallCount={curvedWallCount}
                slopedWallCount={slopedWallCount}
                walls={floorPlan.walls}
              />
            )}
          </ScrollArea>
        </div>
      )}

      </div>{/* end flex-1 canvas area */}
    </div>
  );
};