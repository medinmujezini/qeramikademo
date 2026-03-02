import React, { createContext, useContext, ReactNode, useState, useMemo } from 'react';
import { useFloorPlan } from '@/hooks/useFloorPlan';
import type { CeilingPlane } from '@/types/floorPlan';
import { DEFAULT_CEILING_PLANE } from '@/types/floorPlan';
import { DEFAULT_WALL_HEIGHT } from '@/constants/units';

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

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

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
  }), [floorPlanState, layerVisibility, activeEditingLayer, wallSyncSettings, ceilingPlane, isCeilingPlaneEnabled]);
  
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
