/**
 * Plumbing Tab - Water supply, drainage, and routing visualization
 * 
 * Focused on routing, validation, and visualization with sub-views.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { autoRouteAllFixturesStackCentric } from '@/utils/mepStackRouting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  RotateCcw,
  BookOpen,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Crosshair,
  Loader2,
} from 'lucide-react';
import { SYSTEM_COLORS, type MEPRoute, type MEPSystemType } from '@/types/mep';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MEPCanvas } from '@/components/mep/MEPCanvas';
import { AutoRoutingPanel } from '@/components/mep/AutoRoutingPanel';
import { RiserDiagramView } from '@/components/mep/RiserDiagramView';
import { IsometricMEPView } from '@/components/mep/IsometricMEPView';
import { FixturePropertiesPanel } from '@/components/mep/FixturePropertiesPanel';
import { NodePropertiesPanel } from '@/components/mep/NodePropertiesPanel';
import { InstallationGuidePanel } from '@/components/mep/InstallationGuidePanel';
import { InstallationChatbot } from '@/components/mep/InstallationChatbot';
import { InstallationChatProvider } from '@/contexts/InstallationChatContext';
import { useMEPContext } from '@/contexts/MEPContext';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';

// =============================================================================
// SUB-VIEW SELECTOR
// =============================================================================

type PlumbingView = 'plan' | 'isometric' | 'riser';

interface ViewSelectorProps {
  activeView: PlumbingView;
  onViewChange: (view: PlumbingView) => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({ activeView, onViewChange }) => {
  const views: { id: PlumbingView; label: string }[] = [
    { id: 'plan', label: 'Plan View' },
    { id: 'isometric', label: '3D Isometric' },
    { id: 'riser', label: 'Riser Diagram' },
  ];

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {views.map((view) => (
        <Button
          key={view.id}
          variant={activeView === view.id ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8"
          onClick={() => onViewChange(view.id)}
        >
          {view.label}
        </Button>
      ))}
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
  { key: 'fixtures', label: 'Fixtures', color: 'hsl(var(--muted-foreground))' },
];

interface LayerControlsProps {
  layers: Record<string, boolean>;
  onToggleLayer: (layer: string) => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({ layers, onToggleLayer }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Layers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
  );
};

// =============================================================================
// VALIDATION PANEL
// =============================================================================

import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import type { ValidationError, ValidationWarning } from '@/types/mep';

interface ValidationPanelProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  onValidate: () => void;
  onHighlightError: (error: ValidationError) => void;
  onReRoute: () => Promise<void>;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ errors, warnings, onValidate, onHighlightError, onReRoute }) => {
  const [errorsOpen, setErrorsOpen] = React.useState(true);
  const [warningsOpen, setWarningsOpen] = React.useState(false);
  const [isReRouting, setIsReRouting] = React.useState(false);
  
  const errorCount = errors.length;
  const warningCount = warnings.length;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Validation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button size="sm" variant="outline" className="w-full" onClick={onValidate}>
          Run Validation
        </Button>
        
        {/* Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {errorCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            <span className="text-sm">
              {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : 'No errors'}
            </span>
          </div>
          {warningCount > 0 && (
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">{warningCount}</span>
            </div>
          )}
        </div>
        
        {/* Error Details */}
        {errorCount > 0 && (
          <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-medium text-destructive hover:underline">
              <span>View Errors</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${errorsOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-32 mt-2">
                <div className="space-y-1.5 pr-3">
                  {errors.map((error, idx) => (
                    <div 
                      key={error.id || idx} 
                      className="text-xs p-2 rounded bg-destructive/10 border border-destructive/20"
                    >
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-destructive">{error.message}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {error.category} • {error.elementType}
                            {error.codeReference && ` • ${error.codeReference}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-xs gap-1 shrink-0"
                          onClick={() => onHighlightError(error)}
                        >
                          <Crosshair className="h-3 w-3" />
                          Highlight
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Re-route button */}
        {errorCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isReRouting}
            onClick={async () => {
              setIsReRouting(true);
              try {
                await onReRoute();
              } finally {
                setIsReRouting(false);
              }
            }}
          >
            {isReRouting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-1" />
            )}
            Re-route to fix errors
          </Button>
        )}
        
        {/* Warning Details */}
        {warningCount > 0 && (
          <Collapsible open={warningsOpen} onOpenChange={setWarningsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-medium text-yellow-600 hover:underline">
              <span>View Warnings</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${warningsOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-32 mt-2">
                <div className="space-y-1.5 pr-3">
                  {warnings.map((warning, idx) => (
                    <div 
                      key={warning.id || idx} 
                      className="text-xs p-2 rounded bg-yellow-500/10 border border-yellow-500/20"
                    >
                      <div className="flex items-start gap-1.5">
                        <Info className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">{warning.message}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {warning.category} • {warning.elementType}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

// =============================================================================
// MAIN PLUMBING TAB
// =============================================================================

const PlumbingTabContent: React.FC = () => {
  const { floorPlan } = useFloorPlanContext();
  const mepState = useMEPContext();
  
  const [activeView, setActiveView] = useState<PlumbingView>('plan');
  const [showGuidePanel, setShowGuidePanel] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRiserSystem, setSelectedRiserSystem] = useState<MEPSystemType | 'all'>('all');
  
  // Derive ceiling height from floor plan
  const ceilingHeight = useMemo(() => {
    return floorPlan.ceilingPlane?.baseHeight ?? floorPlan.wallHeight ?? 280;
  }, [floorPlan.ceilingPlane, floorPlan.wallHeight]);
  
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
    <div className="h-full relative">
      {/* FULL-SCREEN CANVAS AREA */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {activeView === 'plan' && (
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
            placingTemplate={null}
            onPlaceFixture={() => {}}
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

        {activeView === 'isometric' && (
          <div className="w-full h-full p-4 overflow-auto">
            <IsometricMEPView
              fixtures={mepState.fixtures}
              routes={mepState.routes}
              nodes={mepState.nodes}
              roomWidth={floorPlan.roomWidth}
              roomHeight={floorPlan.roomHeight}
              ceilingHeight={ceilingHeight}
              walls={floorPlan.walls}
              points={floorPlan.points}
            />
          </div>
        )}
        
        {activeView === 'riser' && (
          <RiserDiagramView
            fixtures={mepState.fixtures}
            routes={mepState.routes}
            nodes={mepState.nodes}
            selectedSystem={selectedRiserSystem}
          />
        )}
      </div>

      {/* FLOATING TOP TOOLBAR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-background/90 backdrop-blur-md rounded-xl shadow-lg px-4 py-2 flex items-center gap-3 max-w-[95vw]">
        <ViewSelector activeView={activeView} onViewChange={setActiveView} />
        
        <div className="h-4 w-px bg-border/50" />
        
        {activeView === 'riser' && (
          <>
            <Select value={selectedRiserSystem} onValueChange={(v) => setSelectedRiserSystem(v as MEPSystemType | 'all')}>
              <SelectTrigger className="w-28 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Systems</SelectItem>
                <SelectItem value="drainage">Drainage</SelectItem>
                <SelectItem value="vent">Vent</SelectItem>
                <SelectItem value="cold-water">Cold Water</SelectItem>
                <SelectItem value="hot-water">Hot Water</SelectItem>
                <SelectItem value="power">Electrical</SelectItem>
              </SelectContent>
            </Select>
            <div className="h-4 w-px bg-border/50" />
          </>
        )}
        
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowGuidePanel(true)}
          className="h-7 gap-1.5"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Guide
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowChatbot(true)}
          className="h-7 gap-1.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          AI Assistant
        </Button>
        
        <div className="h-4 w-px bg-border/50" />
        
        <Badge variant="secondary" className="bg-white/20 text-xs whitespace-nowrap">{mepState.fixtureCount} fixtures</Badge>
        <Badge variant="secondary" className="bg-white/20 text-xs whitespace-nowrap">{mepState.routeCount} routes</Badge>
        <Badge variant="secondary" className="bg-white/20 text-xs whitespace-nowrap">{mepState.totalDFU} DFU</Badge>
      </div>
      
      {/* FLOATING LEFT PANEL - Routing Controls */}
      {sidebarCollapsed ? (
        <Button
          variant="outline"
          size="icon"
          className="absolute top-20 left-6 z-20 bg-background/90 backdrop-blur-md shadow-lg"
          onClick={() => setSidebarCollapsed(false)}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      ) : (
        <div className="absolute top-20 left-6 bottom-6 z-20 w-80 flex flex-col">
          <div className="bg-background/90 backdrop-blur-md rounded-xl shadow-lg flex flex-col h-full border border-border/50">
            <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Controls</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSidebarCollapsed(true)}
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 pt-1 flex flex-col gap-3">
                <AutoRoutingPanel
                  fixtures={mepState.fixtures}
                  nodes={mepState.nodes}
                  routes={mepState.routes}
                  walls={wallsForRouting}
                  canvasWidth={floorPlan.roomWidth}
                  canvasHeight={floorPlan.roomHeight}
                  ceilingHeight={ceilingHeight}
                  onRoutesGenerated={handleRoutesGenerated}
                  onClearRoutes={mepState.clearAllRoutes}
                />
                
                <LayerControls 
                  layers={mepState.layerVisibility}
                  onToggleLayer={mepState.toggleLayer}
                />
                
                {/* Properties Panel - shows fixture or node based on selection */}
                {mepState.selectedNode ? (
                  <NodePropertiesPanel
                    node={mepState.selectedNode}
                    ceilingHeight={ceilingHeight}
                    onUpdateNode={mepState.updateNode}
                    onDelete={() => mepState.deleteNode(mepState.selectedNodeId!)}
                  />
                ) : (
                  <FixturePropertiesPanel
                    fixture={mepState.selectedFixture}
                    onRotate={() => {
                      if (mepState.selectedFixture) {
                        mepState.rotateFixture(mepState.selectedFixtureId!, (mepState.selectedFixture.rotation + 90) % 360);
                      }
                    }}
                    onDelete={() => {
                      if (mepState.selectedFixtureId) {
                        mepState.deleteFixture(mepState.selectedFixtureId);
                      }
                    }}
                    onUpdatePosition={(x, y) => {
                      if (mepState.selectedFixtureId) {
                        mepState.moveFixture(mepState.selectedFixtureId, { x, y });
                      }
                    }}
                  />
                )}
                
                <ValidationPanel 
                  errors={mepState.validationResult.errors}
                  warnings={mepState.validationResult.warnings}
                  onValidate={mepState.runValidation}
                  onHighlightError={(error) => {
                    // Clear any existing selection first
                    mepState.setSelectedFixtureId(null);
                    mepState.setSelectedNodeId(null);
                    
                    // Small delay to force re-render with new selection
                    setTimeout(() => {
                      if (error.elementType === 'fixture') {
                        mepState.setSelectedFixtureId(error.elementId);
                      } else if (error.elementType === 'route') {
                        const route = mepState.routes.find(r => r.id === error.elementId);
                        if (route?.destination.type === 'fixture') {
                          mepState.setSelectedFixtureId(route.destination.id);
                        }
                      } else if (error.elementType === 'segment') {
                        const parentRoute = mepState.routes.find(r =>
                          r.segments.some(s => s.id === error.elementId)
                        );
                        if (parentRoute?.destination.type === 'fixture') {
                          mepState.setSelectedFixtureId(parentRoute.destination.id);
                        }
                      } else if (error.elementType === 'node') {
                        mepState.setSelectedNodeId(error.elementId);
                      }
                    }, 50);
                  }}
                  onReRoute={async () => {
                    mepState.clearAllRoutes();
                    const result = autoRouteAllFixturesStackCentric(
                      mepState.fixtures,
                      mepState.nodes,
                      [],
                      { canvasWidth: floorPlan.roomWidth, canvasHeight: floorPlan.roomHeight, walls: wallsForRouting }
                    );
                    result.routes.forEach(route => mepState.addRoute(route));
                    mepState.runValidation();
                  }}
                />
                
                <Card className="glass-sm">
                  <CardContent className="p-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      onClick={() => mepState.reset()}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reset All
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM HINT (plan view only) */}
      {activeView === 'plan' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-background/80 backdrop-blur-md rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
          Scroll to zoom • Drag to pan • Click fixtures to select
        </div>
      )}
      
      {/* Installation Guide Panel */}
      <InstallationGuidePanel
        isOpen={showGuidePanel}
        onClose={() => setShowGuidePanel(false)}
        fixtures={mepState.fixtures}
        routes={mepState.routes}
        nodes={mepState.nodes}
      />
      
      {/* AI Installation Chatbot */}
      <InstallationChatbot
        isOpen={showChatbot}
        onClose={() => setShowChatbot(false)}
      />
    </div>
  );
};

// Wrap with InstallationChatProvider
export const PlumbingTab: React.FC = () => {
  return (
    <InstallationChatProvider>
      <PlumbingTabContent />
    </InstallationChatProvider>
  );
};
