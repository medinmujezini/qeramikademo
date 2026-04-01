import React, { createContext, useContext, ReactNode, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import type { CeilingPlane, FloorPlan } from '@/types/floorPlan';
import { DEFAULT_CEILING_PLANE, createDefaultFloorPlan } from '@/types/floorPlan';
import { DEFAULT_WALL_HEIGHT } from '@/constants/units';
import type { Building, Floor, Staircase, StaircaseType, RailingStyle, FloorSlab, SlabOpening } from '@/types/multiFloor';
import { createDefaultBuilding, createDefaultFloor, calculateStaircaseGeometry, DEFAULT_SLAB } from '@/types/multiFloor';
import { v4 as uuidv4 } from 'uuid';

// Layer visibility state for canvas rendering
export interface LayerVisibility {
  walls: boolean;
  tiles: boolean;
  plumbing: boolean;
  electrical: boolean;
  fixtures: boolean;
  columns: boolean;
  grid: boolean;
  dimensions: boolean;
}

// Wall height sync settings
export interface WallSyncSettings {
  autoSyncJunctionHeights: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  walls: true,
  tiles: true,
  plumbing: true,
  electrical: true,
  fixtures: true,
  columns: true,
  grid: true,
  dimensions: true,
};

type FloorPlanContextType = ReturnType<typeof useFloorPlan> & {
  layerVisibility: LayerVisibility;
  setLayerVisibility: React.Dispatch<React.SetStateAction<LayerVisibility>>;
  toggleLayer: (layer: keyof LayerVisibility) => void;
  activeEditingLayer: 'floorplan' | 'tiles' | 'plumbing' | 'electrical' | 'fixtures' | 'preview';
  setActiveEditingLayer: React.Dispatch<React.SetStateAction<'floorplan' | 'tiles' | 'plumbing' | 'electrical' | 'fixtures' | 'preview'>>;
  wallSyncSettings: WallSyncSettings;
  setWallSyncSettings: React.Dispatch<React.SetStateAction<WallSyncSettings>>;
  // Ceiling plane helpers
  ceilingPlane: CeilingPlane;
  isCeilingPlaneEnabled: boolean;
  // Multi-floor system
  building: Building;
  activeLevel: number;
  setActiveLevel: (level: number) => void;
  addFloor: (options?: { name?: string; height?: number; copyOuterWalls?: boolean }) => void;
  removeFloor: (level: number) => void;
  renameFloor: (level: number, name: string) => void;
  duplicateFloor: (level: number) => void;
  updateFloorHeight: (level: number, height: number) => void;
  staircases: Staircase[];
  addStaircase: (type: StaircaseType, x: number, y: number) => void;
  removeStaircase: (id: string) => void;
  updateStaircase: (id: string, updates: Partial<Staircase>) => void;
  getFloorPlanForLevel: (level: number) => FloorPlan | null;
  // Selected staircase
  selectedStaircaseId: string | null;
  setSelectedStaircaseId: (id: string | null) => void;
  // Ghost floor toggle
  showAdjacentFloors: boolean;
  setShowAdjacentFloors: (v: boolean) => void;
};

const FloorPlanContext = createContext<FloorPlanContextType | null>(null);

const DEFAULT_WALL_SYNC_SETTINGS: WallSyncSettings = {
  autoSyncJunctionHeights: true,
};

/**
 * Sync slab openings: for every staircase, ensure the target floor's slab has a matching opening.
 */
function syncSlabOpenings(building: Building): Building {
  const updatedFloors = building.floors.map(floor => {
    if (floor.level <= 0) return floor;
    
    // Find all staircases that go TO this level
    const stairsToThisFloor = building.staircases.filter(s => s.toLevel === floor.level);
    
    const slab: FloorSlab = floor.slab || { ...DEFAULT_SLAB, openings: [] };
    
    // Build openings from staircases + keep manual openings (no staircaseId)
    const manualOpenings = slab.openings.filter(o => !o.staircaseId);
    const staircaseOpenings: SlabOpening[] = stairsToThisFloor.map(stair => ({
      id: `slab-opening-${stair.id}`,
      staircaseId: stair.id,
      x: stair.x - 10, // 10cm clearance margin
      y: stair.y - 10,
      width: stair.width + 20,
      depth: stair.depth + 20,
    }));
    
    return {
      ...floor,
      slab: {
        ...slab,
        openings: [...manualOpenings, ...staircaseOpenings],
      },
    };
  });
  
  return { ...building, floors: updatedFloors };
}

export const FloorPlanProvider = ({ children }: { children: ReactNode }) => {
  const floorPlanState = useFloorPlan();
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [activeEditingLayer, setActiveEditingLayer] = useState<'floorplan' | 'tiles' | 'plumbing' | 'electrical' | 'fixtures' | 'preview'>('floorplan');
  const [wallSyncSettings, setWallSyncSettings] = useState<WallSyncSettings>(DEFAULT_WALL_SYNC_SETTINGS);
  const [building, setBuilding] = useState<Building>(createDefaultBuilding());
  const [selectedStaircaseId, setSelectedStaircaseId] = useState<string | null>(null);
  const [showAdjacentFloors, setShowAdjacentFloors] = useState(true);
  
  // Track which level's floor plan is currently loaded in useFloorPlan
  const loadedLevelRef = useRef<number>(0);

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  // === STEP 1: Per-floor state isolation ===
  // Save current floor plan back to building state
  const saveCurrentFloorPlan = useCallback(() => {
    const currentPlan = floorPlanState.floorPlan;
    const currentLevel = loadedLevelRef.current;
    setBuilding(prev => ({
      ...prev,
      floors: prev.floors.map(f =>
        f.level === currentLevel ? { ...f, floorPlan: currentPlan } : f
      ),
    }));
  }, [floorPlanState.floorPlan]);

  const activeLevel = building.activeLevel;

  const setActiveLevel = useCallback((level: number) => {
    // Save current floor plan to building
    const currentPlan = floorPlanState.floorPlan;
    const currentLevel = loadedLevelRef.current;
    
    setBuilding(prev => {
      const updated = {
        ...prev,
        activeLevel: level,
        floors: prev.floors.map(f =>
          f.level === currentLevel ? { ...f, floorPlan: currentPlan } : f
        ),
      };
      
      // Load the target floor's plan
      const targetFloor = updated.floors.find(f => f.level === level);
      if (targetFloor) {
        // Use setTimeout to avoid state conflicts  
        setTimeout(() => {
          floorPlanState.loadFloorPlan(targetFloor.floorPlan);
          loadedLevelRef.current = level;
        }, 0);
      }
      
      return updated;
    });
  }, [floorPlanState]);

  // Get floor plan for any level (for ghost rendering)
  const getFloorPlanForLevel = useCallback((level: number): FloorPlan | null => {
    if (level === loadedLevelRef.current) return floorPlanState.floorPlan;
    const floor = building.floors.find(f => f.level === level);
    return floor?.floorPlan || null;
  }, [building.floors, floorPlanState.floorPlan]);

  const addFloor = useCallback((options?: { name?: string; height?: number; copyOuterWalls?: boolean }) => {
    // Save current floor first
    const currentPlan = floorPlanState.floorPlan;
    const currentLevel = loadedLevelRef.current;
    
    setBuilding(prev => {
      const maxLevel = Math.max(...prev.floors.map(f => f.level), -1);
      const newLevel = maxLevel + 1;
      const newFloor = createDefaultFloor(newLevel, options?.name);
      if (options?.height) {
        newFloor.floorToFloorHeight = options.height;
      }

      // Copy walls from the floor below as structural walls
      if (options?.copyOuterWalls) {
        const sourceFloor = prev.floors.find(f => f.level === currentLevel);
        // Use the live floor plan for the active level, not the stale one in building state
        const sourcePlan = (sourceFloor && sourceFloor.level === currentLevel) ? currentPlan : (sourceFloor?.floorPlan || currentPlan);
        if (sourcePlan.walls.length > 0) {
          const pointIdMap = new Map<string, string>();
          const clonedPoints = sourcePlan.points
            .filter(p => sourcePlan.walls.some(w => w.startPointId === p.id || w.endPointId === p.id))
            .map(p => {
              const newId = uuidv4();
              pointIdMap.set(p.id, newId);
              return { ...p, id: newId };
            });
          const clonedWalls = sourcePlan.walls.map(w => ({
            ...w,
            id: uuidv4(),
            startPointId: pointIdMap.get(w.startPointId) || w.startPointId,
            endPointId: pointIdMap.get(w.endPointId) || w.endPointId,
            isStructural: true,
          }));
          newFloor.floorPlan = {
            ...newFloor.floorPlan,
            points: [...newFloor.floorPlan.points, ...clonedPoints],
            walls: [...newFloor.floorPlan.walls, ...clonedWalls],
          };
        }
      }

      // Sync all wall heights to match floor-to-floor height (after cloning)
      if (options?.height) {
        newFloor.floorPlan = {
          ...newFloor.floorPlan,
          walls: newFloor.floorPlan.walls.map(w => ({ ...w, height: options.height })),
        };
      }

      const updated = {
        ...prev,
        floors: prev.floors.map(f =>
          f.level === currentLevel ? { ...f, floorPlan: currentPlan } : f
        ).concat(newFloor),
        activeLevel: newLevel,
      };
      
      setTimeout(() => {
        floorPlanState.loadFloorPlan(newFloor.floorPlan);
        loadedLevelRef.current = newLevel;
      }, 0);
      
      return syncSlabOpenings(updated);
    });
  }, [floorPlanState]);

  const removeFloor = useCallback((level: number) => {
    setBuilding(prev => {
      if (prev.floors.length <= 1) return prev;
      const filtered = prev.floors.filter(f => f.level !== level);
      const newActive = prev.activeLevel === level
        ? (filtered[0]?.level ?? 0)
        : prev.activeLevel;
      
      const updated = {
        ...prev,
        floors: filtered,
        activeLevel: newActive,
        staircases: prev.staircases.filter(s => s.fromLevel !== level && s.toLevel !== level),
      };
      
      if (prev.activeLevel === level) {
        const targetFloor = filtered.find(f => f.level === newActive);
        if (targetFloor) {
          setTimeout(() => {
            floorPlanState.loadFloorPlan(targetFloor.floorPlan);
            loadedLevelRef.current = newActive;
          }, 0);
        }
      }
      
      return syncSlabOpenings(updated);
    });
  }, [floorPlanState]);

  const renameFloor = useCallback((level: number, name: string) => {
    setBuilding(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.level === level ? { ...f, name } : f),
    }));
  }, []);

  const duplicateFloor = useCallback((level: number) => {
    const currentPlan = floorPlanState.floorPlan;
    const currentLevel = loadedLevelRef.current;
    
    setBuilding(prev => {
      const sourceFloor = level === currentLevel
        ? { ...prev.floors.find(f => f.level === level)!, floorPlan: currentPlan }
        : prev.floors.find(f => f.level === level);
      if (!sourceFloor) return prev;
      
      const maxLevel = Math.max(...prev.floors.map(f => f.level), -1);
      const newLevel = maxLevel + 1;
      const newFloor: Floor = {
        ...createDefaultFloor(newLevel),
        floorPlan: JSON.parse(JSON.stringify(sourceFloor.floorPlan)),
        floorToFloorHeight: sourceFloor.floorToFloorHeight,
      };
      
      const updated = {
        ...prev,
        floors: prev.floors.map(f =>
          f.level === currentLevel ? { ...f, floorPlan: currentPlan } : f
        ).concat(newFloor),
        activeLevel: newLevel,
      };
      
      setTimeout(() => {
        floorPlanState.loadFloorPlan(newFloor.floorPlan);
        loadedLevelRef.current = newLevel;
      }, 0);
      
      return syncSlabOpenings(updated);
    });
  }, [floorPlanState]);

  const updateFloorHeight = useCallback((level: number, height: number) => {
    // Also save current floor plan if we're updating the active level
    const currentPlan = floorPlanState.floorPlan;
    const currentLevel = loadedLevelRef.current;

    setBuilding(prev => {
      const updated = {
        ...prev,
        floors: prev.floors.map(f => {
          if (f.level !== level) return f;
          // Use live plan for the currently loaded level
          const plan = f.level === currentLevel ? currentPlan : f.floorPlan;
          const updatedPlan = {
            ...plan,
            walls: plan.walls.map(w => ({ ...w, height })),
          };
          return { ...f, floorToFloorHeight: height, floorPlan: updatedPlan };
        }),
      };
      // If updating the active level, reload the plan so useFloorPlan picks up new wall heights
      if (level === currentLevel) {
        setTimeout(() => {
          const floor = updated.floors.find(f => f.level === level);
          if (floor) floorPlanState.loadFloorPlan(floor.floorPlan);
        }, 0);
      }
      return updated;
    });
  }, [floorPlanState]);

  const addStaircase = useCallback((type: StaircaseType, x: number, y: number) => {
    const currentPlan = floorPlanState.floorPlan;
    const currentLevel = loadedLevelRef.current;
    
    setBuilding(prev => {
      // Save current plan
      let updated = {
        ...prev,
        floors: prev.floors.map(f =>
          f.level === currentLevel ? { ...f, floorPlan: currentPlan } : f
        ),
      };
      
      const currentFloor = updated.floors.find(f => f.level === updated.activeLevel);
      if (!currentFloor) return prev;
      
      const nextLevel = updated.activeLevel + 1;
      const targetFloor = updated.floors.find(f => f.level === nextLevel);
      if (!targetFloor) return prev;

      const geo = calculateStaircaseGeometry(
        currentFloor.floorToFloorHeight,
        type,
      );

      const staircase: Staircase = {
        id: uuidv4(),
        type,
        fromLevel: updated.activeLevel,
        toLevel: nextLevel,
        x,
        y,
        width: geo.width,
        depth: geo.depth,
        rotation: 0,
        treadDepth: 28,
        riserHeight: geo.riserHeight,
        numTreads: geo.numTreads,
        stairWidth: 100,
        railing: 'simple',
        landingPosition: 0.5,
        treadMaterial: 'wood',
      };

      updated = {
        ...updated,
        staircases: [...updated.staircases, staircase],
      };
      
      return syncSlabOpenings(updated);
    });
  }, [floorPlanState]);

  const removeStaircase = useCallback((id: string) => {
    setBuilding(prev => {
      const updated = {
        ...prev,
        staircases: prev.staircases.filter(s => s.id !== id),
      };
      return syncSlabOpenings(updated);
    });
    if (selectedStaircaseId === id) setSelectedStaircaseId(null);
  }, [selectedStaircaseId]);

  const updateStaircase = useCallback((id: string, updates: Partial<Staircase>) => {
    setBuilding(prev => {
      const updated = {
        ...prev,
        staircases: prev.staircases.map(s => s.id === id ? { ...s, ...updates } : s),
      };
      return syncSlabOpenings(updated);
    });
  }, []);

  // Derive ceiling plane info from floor plan
  const ceilingPlane = floorPlanState.floorPlan.ceilingPlane ?? DEFAULT_CEILING_PLANE;
  const isCeilingPlaneEnabled = ceilingPlane.enabled;

  const contextValue = useMemo(() => ({
    ...floorPlanState,
    layerVisibility,
    setLayerVisibility,
    toggleLayer,
    activeEditingLayer,
    setActiveEditingLayer,
    wallSyncSettings,
    setWallSyncSettings,
    ceilingPlane,
    isCeilingPlaneEnabled,
    // Multi-floor
    building,
    activeLevel,
    setActiveLevel,
    addFloor,
    removeFloor,
    renameFloor,
    duplicateFloor,
    updateFloorHeight,
    staircases: building.staircases,
    addStaircase,
    removeStaircase,
    updateStaircase,
    getFloorPlanForLevel,
    selectedStaircaseId,
    setSelectedStaircaseId,
    showAdjacentFloors,
    setShowAdjacentFloors,
  }), [floorPlanState, layerVisibility, activeEditingLayer, wallSyncSettings, ceilingPlane, isCeilingPlaneEnabled, building, activeLevel, setActiveLevel, addFloor, removeFloor, renameFloor, duplicateFloor, updateFloorHeight, addStaircase, removeStaircase, updateStaircase, getFloorPlanForLevel, selectedStaircaseId, showAdjacentFloors]);
  
  return (
    <FloorPlanContext.Provider value={contextValue}>
      {children}
    </FloorPlanContext.Provider>
  );
};

export const useFloorPlanContext = () => {
  const context = useContext(FloorPlanContext);
  if (!context) {
    throw new Error('useFloorPlanContext must be used within a FloorPlanProvider');
  }
  return context;
};
