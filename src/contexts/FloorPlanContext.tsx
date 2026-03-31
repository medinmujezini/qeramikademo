import React, { createContext, useContext, ReactNode, useState, useMemo, useCallback } from 'react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import type { CeilingPlane } from '@/types/floorPlan';
import { DEFAULT_CEILING_PLANE } from '@/types/floorPlan';
import { DEFAULT_WALL_HEIGHT } from '@/constants/units';
import type { Building, Floor, Staircase, StaircaseType, RailingStyle } from '@/types/multiFloor';
import { createDefaultBuilding, createDefaultFloor, calculateStaircaseGeometry } from '@/types/multiFloor';
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
  addFloor: () => void;
  removeFloor: (level: number) => void;
  renameFloor: (level: number, name: string) => void;
  staircases: Staircase[];
  addStaircase: (type: StaircaseType, x: number, y: number) => void;
  removeStaircase: (id: string) => void;
  updateStaircase: (id: string, updates: Partial<Staircase>) => void;
};

const FloorPlanContext = createContext<FloorPlanContextType | null>(null);

const DEFAULT_WALL_SYNC_SETTINGS: WallSyncSettings = {
  autoSyncJunctionHeights: true,
};

export const FloorPlanProvider = ({ children }: { children: ReactNode }) => {
  const floorPlanState = useFloorPlan();
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [activeEditingLayer, setActiveEditingLayer] = useState<'floorplan' | 'tiles' | 'plumbing' | 'electrical' | 'fixtures' | 'preview'>('floorplan');
  const [wallSyncSettings, setWallSyncSettings] = useState<WallSyncSettings>(DEFAULT_WALL_SYNC_SETTINGS);
  const [building, setBuilding] = useState<Building>(createDefaultBuilding());

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Multi-floor operations
  const activeLevel = building.activeLevel;

  const setActiveLevel = useCallback((level: number) => {
    setBuilding(prev => ({ ...prev, activeLevel: level }));
  }, []);

  const addFloor = useCallback(() => {
    setBuilding(prev => {
      const maxLevel = Math.max(...prev.floors.map(f => f.level), -1);
      const newLevel = maxLevel + 1;
      const newFloor = createDefaultFloor(newLevel);
      return {
        ...prev,
        floors: [...prev.floors, newFloor],
        activeLevel: newLevel,
      };
    });
  }, []);

  const removeFloor = useCallback((level: number) => {
    setBuilding(prev => {
      if (prev.floors.length <= 1) return prev; // Keep at least one floor
      const filtered = prev.floors.filter(f => f.level !== level);
      const newActive = prev.activeLevel === level
        ? (filtered[0]?.level ?? 0)
        : prev.activeLevel;
      return {
        ...prev,
        floors: filtered,
        activeLevel: newActive,
        staircases: prev.staircases.filter(s => s.fromLevel !== level && s.toLevel !== level),
      };
    });
  }, []);

  const renameFloor = useCallback((level: number, name: string) => {
    setBuilding(prev => ({
      ...prev,
      floors: prev.floors.map(f => f.level === level ? { ...f, name } : f),
    }));
  }, []);

  const addStaircase = useCallback((type: StaircaseType, x: number, y: number) => {
    setBuilding(prev => {
      const currentFloor = prev.floors.find(f => f.level === prev.activeLevel);
      if (!currentFloor) return prev;
      
      const nextLevel = prev.activeLevel + 1;
      const targetFloor = prev.floors.find(f => f.level === nextLevel);
      if (!targetFloor) return prev; // No floor above to connect

      const geo = calculateStaircaseGeometry(
        currentFloor.floorToFloorHeight,
        type,
      );

      const staircase: Staircase = {
        id: uuidv4(),
        type,
        fromLevel: prev.activeLevel,
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

      return {
        ...prev,
        staircases: [...prev.staircases, staircase],
      };
    });
  }, []);

  const removeStaircase = useCallback((id: string) => {
    setBuilding(prev => ({
      ...prev,
      staircases: prev.staircases.filter(s => s.id !== id),
    }));
  }, []);

  const updateStaircase = useCallback((id: string, updates: Partial<Staircase>) => {
    setBuilding(prev => ({
      ...prev,
      staircases: prev.staircases.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
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
    staircases: building.staircases,
    addStaircase,
    removeStaircase,
    updateStaircase,
  }), [floorPlanState, layerVisibility, activeEditingLayer, wallSyncSettings, ceilingPlane, isCeilingPlaneEnabled, building, activeLevel, setActiveLevel, addFloor, removeFloor, renameFloor, addStaircase, removeStaircase, updateStaircase]);
  
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
