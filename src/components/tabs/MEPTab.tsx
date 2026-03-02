/**
 * MEP Tab - Unified Mechanical, Electrical, and Plumbing Interface
 * 
 * Full-canvas layout with floating glassmorphism panels
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FloatingPanel, FloatingToolbar } from '@/components/ui/floating-panel';
import { 
  Bath,
  UtensilsCrossed,
  WashingMachine,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
  Layers,
  Settings2,
  Library
} from 'lucide-react';
import { getFixturesByCategory, type FixtureTemplate } from '@/data/fixtureLibrary';
import { SYSTEM_COLORS, type MEPRoute } from '@/types/mep';
import { MEPCanvas } from '@/components/mep/MEPCanvas';
import { FixturePropertiesPanel } from '@/components/mep/FixturePropertiesPanel';
import { AutoRoutingPanel } from '@/components/mep/AutoRoutingPanel';
import { RiserDiagramView } from '@/components/mep/RiserDiagramView';
import { BillOfMaterialsPanel } from '@/components/mep/BillOfMaterialsPanel';
import { IsometricMEPView } from '@/components/mep/IsometricMEPView';
import { useMEPState } from '@/hooks/useMEPState';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';

// =============================================================================
// FIXTURE LIBRARY PANEL
// =============================================================================

interface FixtureLibraryPanelProps {
  onSelectFixture: (template: FixtureTemplate | null) => void;
  selectedFixture: FixtureTemplate | null;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bathroom: <Bath className="h-4 w-4" />,
  kitchen: <UtensilsCrossed className="h-4 w-4" />,
  laundry: <WashingMachine className="h-4 w-4" />,
  utility: <Wrench className="h-4 w-4" />,
};

const FixtureLibraryPanel: React.FC<FixtureLibraryPanelProps> = ({ 
  onSelectFixture, 
  selectedFixture 
}) => {
  const fixturesByCategory = getFixturesByCategory();
  
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Click to select, then click on canvas to place
      </p>
      {Object.entries(fixturesByCategory).map(([category, fixtures]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-2">
            {CATEGORY_ICONS[category]}
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {category}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {fixtures.map((fixture) => (
              <Button
                key={fixture.type}
                variant={selectedFixture?.type === fixture.type ? 'secondary' : 'ghost'}
                size="sm"
                className="justify-start h-auto py-2 px-3"
                onClick={() => onSelectFixture(
                  selectedFixture?.type === fixture.type ? null : fixture
                )}
              >
                <div className="flex flex-col items-start">
                  <span className="text-sm">{fixture.name}</span>
                  <div className="flex gap-1 mt-1">
                    {fixture.connectionTemplates.some(c => c.systemType === 'cold-water') && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: SYSTEM_COLORS['cold-water'] }}>
                        W
                      </Badge>
                    )}
                    {fixture.connectionTemplates.some(c => c.systemType === 'drainage') && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: SYSTEM_COLORS['drainage'] }}>
                        D
                      </Badge>
                    )}
                    {fixture.connectionTemplates.some(c => c.systemType === 'power') && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: SYSTEM_COLORS['power'] }}>
                        E
                      </Badge>
                    )}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      ))}
      
      {/* Reset Button */}
      <div className="pt-3 border-t border-white/10">
        <Button 
          size="sm" 
          variant="outline" 
          className="w-full"
          onClick={() => onSelectFixture(null)}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Clear Selection
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// LAYER CONTROLS
// =============================================================================

const LAYER_CONFIG = [
  { key: 'coldWater', label: 'Cold Water', color: SYSTEM_COLORS['cold-water'] },
  { key: 'hotWater', label: 'Hot Water', color: SYSTEM_COLORS['hot-water'] },
  { key: 'drainage', label: 'Drainage', color: SYSTEM_COLORS['drainage'] },
  { key: 'vent', label: 'Vent', color: SYSTEM_COLORS['vent'] },
  { key: 'electrical', label: 'Electrical', color: SYSTEM_COLORS['power'] },
  { key: 'fixtures', label: 'Fixtures', color: 'hsl(var(--muted-foreground))' },
];

interface LayerControlsProps {
  layers: Record<string, boolean>;
  onToggleLayer: (layer: string) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({ layers, onToggleLayer }) => {
  return (
    <div className="space-y-2">
      {LAYER_CONFIG.map(({ key, label, color }) => (
        <div key={key} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color }}
            />
            <span className="text-xs">{label}</span>
          </div>
          <Switch
            checked={layers[key] ?? true}
            onCheckedChange={() => onToggleLayer(key)}
            className="scale-75"
          />
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// VALIDATION PANEL
// =============================================================================

interface ValidationPanelProps {
  errorCount: number;
  warningCount: number;
  onValidate: () => void;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ errorCount, warningCount, onValidate }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {errorCount > 0 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          <span className="text-sm">
            {errorCount > 0 ? `${errorCount} errors` : 'No errors'}
          </span>
        </div>
      </div>
      {warningCount > 0 && (
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-yellow-500" />
          <span className="text-sm">{warningCount} warnings</span>
        </div>
      )}
      <Button size="sm" variant="outline" className="w-full" onClick={onValidate}>
        Run Validation
      </Button>
    </div>
  );
};

// =============================================================================
// MAIN MEP TAB
// =============================================================================

export const MEPTab: React.FC = () => {
  const { floorPlan } = useFloorPlanContext();
  const mepState = useMEPState();
  
  const [placingTemplate, setPlacingTemplate] = useState<FixtureTemplate | null>(null);
  const [currentView, setCurrentView] = useState<'plan' | 'isometric' | 'riser' | 'bom'>('plan');
  
  // Handle fixture placement
  const handlePlaceFixture = useCallback((
    position: { x: number; y: number },
    rotation: number
  ) => {
    if (!placingTemplate) return;
    mepState.addFixture(placingTemplate, position, rotation);
  }, [placingTemplate, mepState]);
  
  // Handle fixture rotation
  const handleRotateSelected = useCallback(() => {
    if (mepState.selectedFixture) {
      mepState.rotateFixture(
        mepState.selectedFixture.id,
        (mepState.selectedFixture.rotation + 90) % 360
      );
    }
  }, [mepState]);
  
  // Handle fixture deletion
  const handleDeleteSelected = useCallback(() => {
    if (mepState.selectedFixtureId) {
      mepState.deleteFixture(mepState.selectedFixtureId);
    }
  }, [mepState]);
  
  // Handle position update
  const handleUpdatePosition = useCallback((x: number, y: number) => {
    if (mepState.selectedFixtureId) {
      mepState.moveFixture(mepState.selectedFixtureId, { x, y });
    }
  }, [mepState]);
  
  // Handle routes generated from auto-routing
  const handleRoutesGenerated = useCallback((newRoutes: MEPRoute[]) => {
    mepState.clearAllRoutes();
    newRoutes.forEach(route => {
      mepState.addRoute(route);
    });
  }, [mepState]);
  
  // Convert walls to routing format
  const wallsForRouting = useMemo(() => {
    const pointMap = new Map(floorPlan.points.map(p => [p.id, p]));
    return floorPlan.walls.map(wall => {
      const startPt = pointMap.get(wall.startPointId);
      const endPt = pointMap.get(wall.endPointId);
      return {
        x1: startPt?.x ?? 0,
        y1: startPt?.y ?? 0,
        x2: endPt?.x ?? 0,
        y2: endPt?.y ?? 0,
      };
    });
  }, [floorPlan.walls, floorPlan.points]);
  
  return (
    <div className="h-full relative overflow-hidden">
      {/* FULL CANVAS */}
      <div className="absolute inset-0 z-0">
        {currentView === 'plan' && (
          <MEPCanvas
            walls={floorPlan.walls}
            points={floorPlan.points}
            roomWidth={floorPlan.roomWidth}
            roomHeight={floorPlan.roomHeight}
            fixtures={mepState.fixtures}
            nodes={mepState.nodes}
            routes={mepState.routes}
            clashes={mepState.clashes}
            layerVisibility={mepState.layerVisibility}
            placingTemplate={placingTemplate}
            onPlaceFixture={handlePlaceFixture}
            selectedFixtureId={mepState.selectedFixtureId}
            onSelectFixture={mepState.setSelectedFixtureId}
            selectedNodeId={mepState.selectedNodeId}
            onSelectNode={mepState.setSelectedNodeId}
            onMoveFixture={mepState.moveFixture}
            onRotateFixture={mepState.rotateFixture}
            onDeleteFixture={mepState.deleteFixture}
            onMoveNode={mepState.moveNode}
          />
        )}
        {currentView === 'isometric' && (
          <div className="w-full h-full p-4">
            <IsometricMEPView
              fixtures={mepState.fixtures}
              routes={mepState.routes}
              nodes={mepState.nodes}
              roomWidth={floorPlan.roomWidth}
              roomHeight={floorPlan.roomHeight}
              walls={floorPlan.walls}
              points={floorPlan.points}
            />
          </div>
        )}
        {currentView === 'riser' && (
          <div className="w-full h-full p-4">
            <RiserDiagramView
              fixtures={mepState.fixtures}
              routes={mepState.routes}
              nodes={mepState.nodes}
            />
          </div>
        )}
        {currentView === 'bom' && (
          <div className="w-full h-full p-4 overflow-auto">
            <BillOfMaterialsPanel
              fixtures={mepState.fixtures}
              routes={mepState.routes}
              nodes={mepState.nodes}
            />
          </div>
        )}
      </div>
      
      {/* TOP CENTER: Status Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass-toolbar flex items-center gap-2">
        {placingTemplate && (
          <Badge variant="secondary" className="bg-white/20">
            Placing: {placingTemplate.name}
          </Badge>
        )}
        <Badge variant="outline" className="bg-white/10">
          {mepState.fixtureCount} fixtures
        </Badge>
        <Badge variant="outline" className="bg-white/10">
          {mepState.routeCount} routes
        </Badge>
        <Badge variant="outline" className="bg-white/10">
          {mepState.totalDFU} DFU
        </Badge>
      </div>
      
      {/* LEFT: Fixture Library */}
      <div className="absolute top-20 left-6 z-20 w-56 max-h-[calc(100%-180px)]">
        <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
          <div className="panel-header shrink-0">
            <Library className="h-4 w-4 mr-2" />
            <span className="panel-header-title">Fixture Library</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <FixtureLibraryPanel 
              onSelectFixture={setPlacingTemplate}
              selectedFixture={placingTemplate}
            />
          </div>
        </div>
      </div>
      
      {/* RIGHT: Properties & Controls */}
      <div className="absolute top-20 right-6 z-20 w-64 max-h-[calc(100%-180px)]">
        <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
          <div className="panel-header shrink-0">
            <Settings2 className="h-4 w-4 mr-2" />
            <span className="panel-header-title">Properties</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <FixturePropertiesPanel
              fixture={mepState.selectedFixture}
              onRotate={handleRotateSelected}
              onDelete={handleDeleteSelected}
              onUpdatePosition={handleUpdatePosition}
            />
            
            <div className="border-t border-white/10 pt-4">
              <AutoRoutingPanel
                fixtures={mepState.fixtures}
                nodes={mepState.nodes}
                routes={mepState.routes}
                walls={wallsForRouting}
                canvasWidth={floorPlan.roomWidth}
                canvasHeight={floorPlan.roomHeight}
                onRoutesGenerated={handleRoutesGenerated}
                onClearRoutes={mepState.clearAllRoutes}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* BOTTOM LEFT: Layer Controls */}
      <div className="absolute bottom-6 left-6 z-20">
        <div className="glass-control p-3 w-44 rounded-xl">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Layers</div>
          <LayerControls 
            layers={mepState.layerVisibility}
            onToggleLayer={mepState.toggleLayer}
          />
        </div>
      </div>
      
      {/* BOTTOM CENTER: View Tabs */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 glass-toolbar px-1">
        <div className="flex gap-1">
          {[
            { value: 'plan', label: 'Plan View' },
            { value: 'isometric', label: '3D Isometric' },
            { value: 'riser', label: 'Riser Diagram' },
            { value: 'bom', label: 'Bill of Materials' },
          ].map((view) => (
            <Button
              key={view.value}
              variant={currentView === view.value ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs"
              onClick={() => setCurrentView(view.value as typeof currentView)}
            >
              {view.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
