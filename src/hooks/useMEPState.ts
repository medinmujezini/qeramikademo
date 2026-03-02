/**
 * MEP State Management Hook
 * 
 * Manages the complete MEP system state including fixtures, routes, nodes, and validation.
 */

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { 
  MEPFixture, 
  MEPRoute, 
  MEPNode, 
  ElectricalCircuit,
  MEPClash,
  MEPSystemState,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '@/types/mep';
import { createFixtureFromTemplate, type FixtureTemplate } from '@/data/fixtureLibrary';
import { validateMEPSystem } from '@/utils/mepValidation';
import { detectClashes } from '@/utils/mepClashDetection';

// =============================================================================
// INITIAL STATE
// =============================================================================

const createInitialState = (): MEPSystemState => ({
  fixtures: [],
  routes: [],
  nodes: [
    // Default infrastructure nodes
    {
      id: 'water-main-default',
      type: 'water-main',
      name: 'Water Main Entry',
      position: { x: 50, y: 300, z: 15 },  // ~6" from floor
      mountingType: 'underground' as const,
      heightFromFloor: 15,
      penetratesFloor: true,
      capacity: 60,  // 60 PSI typical
      connectedRouteIds: [],
    },
    {
      id: 'water-heater-default',
      type: 'water-heater',
      name: 'Water Heater',
      position: { x: 80, y: 350, z: 0 },
      mountingType: 'floor' as const,
      heightFromFloor: 0,
      connectedRouteIds: [],
      waterHeaterProps: {
        type: 'tank' as const,
        capacity: 50,              // 50 gallon
        inletHeight: 137,          // ~54" cold water inlet
        outletHeight: 142,         // ~56" hot water outlet  
        fuelType: 'electric' as const,
      },
    },
    // Main Drain Stack - vertical stack for drainage
    {
      id: 'drain-stack-default',
      type: 'drain-stack',
      name: 'Main Drain Stack',
      position: { x: 150, y: 350, z: 120 }, // z = typical branch connection height
      mountingType: 'floor' as const,
      penetratesFloor: true,
      penetratesCeiling: true,
      capacity: 256,
      connectedRouteIds: [],
      stackProperties: {
        bottomElevation: 0,      // Floor/slab level
        topElevation: 280,       // Through roof
        diameter: 4,             // 4" main stack
        isVentTermination: true,
      },
    },
    // Vent Stack - separate vent riser
    {
      id: 'vent-stack-default',
      type: 'vent-stack',
      name: 'Vent Stack',
      position: { x: 200, y: 400, z: 150 },
      mountingType: 'floor' as const,
      penetratesCeiling: true,
      connectedRouteIds: [],
      stackProperties: {
        bottomElevation: 80,     // Starts above flood rim
        topElevation: 300,       // Through roof
        diameter: 3,             // 3" vent stack
        isVentTermination: true,
      },
    },
    {
      id: 'electrical-panel-default',
      type: 'electrical-panel',
      name: 'Main Electrical Panel',
      position: { x: 50, y: 200, z: 150 },  // ~5' from floor (typical)
      mountingType: 'wall' as const,
      heightFromFloor: 150,
      circuitCount: 20,
      mainBreakerSize: 200,
      connectedRouteIds: [],
    },
  ],
  circuits: [],
  clashes: [],
  layerVisibility: {
    coldWater: true,
    hotWater: true,
    drainage: true,
    vent: true,
    electrical: true,
    fixtures: true,
  },
  routingConfig: {
    preferWallHugging: true,
    maxBends: 4,
    minClearance: 10,
    autoSize: true,
  },
});

// =============================================================================
// HOOK
// =============================================================================

export function useMEPState() {
  const [state, setState] = useState<MEPSystemState>(createInitialState);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDraggingFixture, setIsDraggingFixture] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });

  // ===========================================================================
  // FIXTURE OPERATIONS
  // ===========================================================================

  const addFixture = useCallback((
    template: FixtureTemplate,
    position: { x: number; y: number },
    rotation: number = 0
  ) => {
    const fixture = createFixtureFromTemplate(template, position, rotation);
    
    setState(prev => ({
      ...prev,
      fixtures: [...prev.fixtures, fixture],
    }));
    
    return fixture.id;
  }, []);

  const updateFixture = useCallback((
    fixtureId: string,
    updates: Partial<MEPFixture>
  ) => {
    setState(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(f =>
        f.id === fixtureId ? { ...f, ...updates } : f
      ),
    }));
  }, []);

  const moveFixture = useCallback((
    fixtureId: string,
    position: { x: number; y: number }
  ) => {
    updateFixture(fixtureId, { position });
  }, [updateFixture]);

  const rotateFixture = useCallback((
    fixtureId: string,
    rotation: number
  ) => {
    updateFixture(fixtureId, { rotation });
  }, [updateFixture]);

  const deleteFixture = useCallback((fixtureId: string) => {
    setState(prev => ({
      ...prev,
      fixtures: prev.fixtures.filter(f => f.id !== fixtureId),
      // Also remove any routes connected to this fixture
      routes: prev.routes.filter(r => 
        r.destination.type !== 'fixture' || r.destination.id !== fixtureId
      ),
    }));
    
    if (selectedFixtureId === fixtureId) {
      setSelectedFixtureId(null);
    }
  }, [selectedFixtureId]);

  // ===========================================================================
  // NODE OPERATIONS
  // ===========================================================================

  const addNode = useCallback((node: Omit<MEPNode, 'id' | 'connectedRouteIds'>) => {
    const newNode: MEPNode = {
      ...node,
      id: uuidv4(),
      connectedRouteIds: [],
    };
    
    setState(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    
    return newNode.id;
  }, []);

  const updateNode = useCallback((nodeId: string, updates: Partial<MEPNode>) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, ...updates } : n
      ),
    }));
  }, []);

  const moveNode = useCallback((
    nodeId: string,
    position: { x: number; y: number; z: number }
  ) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, position } : n
      ),
    }));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      // Also remove routes connected to this node
      routes: prev.routes.filter(r => 
        r.source.nodeId !== nodeId && 
        (r.destination.type !== 'node' || r.destination.id !== nodeId)
      ),
    }));
    
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId]);

  // ===========================================================================
  // LAYER VISIBILITY
  // ===========================================================================

  const toggleLayer = useCallback((layer: keyof MEPSystemState['layerVisibility']) => {
    setState(prev => ({
      ...prev,
      layerVisibility: {
        ...prev.layerVisibility,
        [layer]: !prev.layerVisibility[layer],
      },
    }));
  }, []);

  const setLayerVisibility = useCallback((
    visibility: Partial<MEPSystemState['layerVisibility']>
  ) => {
    setState(prev => ({
      ...prev,
      layerVisibility: {
        ...prev.layerVisibility,
        ...visibility,
      },
    }));
  }, []);

  // ===========================================================================
  // ROUTE OPERATIONS
  // ===========================================================================

  const addRoute = useCallback((route: Omit<MEPRoute, 'id'>) => {
    const newRoute: MEPRoute = {
      ...route,
      id: uuidv4(),
    };
    
    setState(prev => ({
      ...prev,
      routes: [...prev.routes, newRoute],
    }));
    
    return newRoute.id;
  }, []);

  const deleteRoute = useCallback((routeId: string) => {
    setState(prev => ({
      ...prev,
      routes: prev.routes.filter(r => r.id !== routeId),
    }));
    
    if (selectedRouteId === routeId) {
      setSelectedRouteId(null);
    }
  }, [selectedRouteId]);

  const clearAllRoutes = useCallback(() => {
    setState(prev => ({
      ...prev,
      routes: [],
    }));
    setSelectedRouteId(null);
  }, []);

  // ===========================================================================
  // VALIDATION & CLASH DETECTION
  // ===========================================================================

  const runValidation = useCallback((walls: Array<{ x1: number; y1: number; x2: number; y2: number }> = []) => {
    const result = validateMEPSystem(
      state.fixtures,
      state.routes,
      state.nodes,
      walls
    );
    
    setValidationResult(result);
    return result;
  }, [state.fixtures, state.routes, state.nodes]);

  const runClashDetection = useCallback(() => {
    const result = detectClashes(
      state.fixtures,
      state.routes,
      state.nodes
    );
    
    setState(prev => ({
      ...prev,
      clashes: result.clashes,
    }));
    
    return result;
  }, [state.fixtures, state.routes, state.nodes]);

  // ===========================================================================
  // DERIVED VALUES
  // ===========================================================================

  const selectedFixture = useMemo(() => 
    state.fixtures.find(f => f.id === selectedFixtureId) || null,
    [state.fixtures, selectedFixtureId]
  );

  const selectedRoute = useMemo(() =>
    state.routes.find(r => r.id === selectedRouteId) || null,
    [state.routes, selectedRouteId]
  );

  const fixtureCount = state.fixtures.length;
  const routeCount = state.routes.length;
  
  const totalDFU = useMemo(() => 
    state.fixtures.reduce((sum, f) => sum + f.dfu, 0),
    [state.fixtures]
  );
  
  const totalWattage = useMemo(() =>
    state.fixtures.reduce((sum, f) => sum + f.wattage, 0),
    [state.fixtures]
  );

  // ===========================================================================
  // SYNC STACKS WITH CEILING
  // ===========================================================================

  const syncStacksWithCeiling = useCallback((ceilingHeight: number) => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        // Update stacks that penetrate ceiling
        if (node.penetratesCeiling && node.stackProperties) {
          return {
            ...node,
            stackProperties: {
              ...node.stackProperties,
              topElevation: ceilingHeight + 30, // Extend 30cm through roof for vent termination
            }
          };
        }
        return node;
      })
    }));
  }, []);

  // ===========================================================================
  // RESET
  // ===========================================================================

  const reset = useCallback(() => {
    setState(createInitialState());
    setSelectedFixtureId(null);
    setSelectedRouteId(null);
    setSelectedNodeId(null);
    setValidationResult({ isValid: true, errors: [], warnings: [] });
  }, []);

  // Derive selected node
  const selectedNode = useMemo(() =>
    state.nodes.find(n => n.id === selectedNodeId) || null,
    [state.nodes, selectedNodeId]
  );

  return {
    // State
    state,
    fixtures: state.fixtures,
    routes: state.routes,
    nodes: state.nodes,
    circuits: state.circuits,
    clashes: state.clashes,
    layerVisibility: state.layerVisibility,
    routingConfig: state.routingConfig,
    
    // Selection
    selectedFixtureId,
    setSelectedFixtureId,
    selectedFixture,
    selectedRouteId,
    setSelectedRouteId,
    selectedRoute,
    selectedNodeId,
    setSelectedNodeId,
    selectedNode,
    isDraggingFixture,
    setIsDraggingFixture,
    
    // Fixture operations
    addFixture,
    updateFixture,
    moveFixture,
    rotateFixture,
    deleteFixture,
    
    // Node operations
    addNode,
    updateNode,
    moveNode,
    deleteNode,
    
    // Route operations
    addRoute,
    deleteRoute,
    clearAllRoutes,
    
    // Layer visibility
    toggleLayer,
    setLayerVisibility,
    
    // Validation & clash detection
    validationResult,
    runValidation,
    runClashDetection,
    
    // Stats
    fixtureCount,
    routeCount,
    totalDFU,
    totalWattage,
    
    // Ceiling sync
    syncStacksWithCeiling,
    
    // Reset
    reset,
  };
}

export type MEPStateHook = ReturnType<typeof useMEPState>;
