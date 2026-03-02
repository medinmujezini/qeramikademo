import React, { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import { GIConfig, GIQualityTier, QUALITY_PRESETS, DEFAULT_GI_CONFIG } from './GIConfig';
import { ProbeVolume } from './ProbeVolume';
import { DirtyRegionTracker } from './DirtyRegionTracker';
import * as THREE from 'three';

interface GIContextValue {
  // Configuration
  config: GIConfig;
  setConfig: (config: GIConfig) => void;
  setQualityTier: (tier: GIQualityTier) => void;
  
  // Probe volume
  probeVolume: ProbeVolume | null;
  setProbeVolume: (volume: ProbeVolume | null) => void;
  
  // Dirty region tracking
  dirtyTracker: DirtyRegionTracker;
  markRegionDirty: (bounds: THREE.Box3) => void;
  
  // Status
  isInitialized: boolean;
  setInitialized: (initialized: boolean) => void;
  
  // Performance stats
  stats: GIStats;
  updateStats: (stats: Partial<GIStats>) => void;
}

interface GIStats {
  ssgiMs: number;
  probeUpdateMs: number;
  compositionMs: number;
  probesUpdatedThisFrame: number;
  totalProbes: number;
  dirtyRegions: number;
}

const defaultStats: GIStats = {
  ssgiMs: 0,
  probeUpdateMs: 0,
  compositionMs: 0,
  probesUpdatedThisFrame: 0,
  totalProbes: 0,
  dirtyRegions: 0,
};

const GIContext = createContext<GIContextValue | null>(null);

export const useGI = (): GIContextValue => {
  const context = useContext(GIContext);
  if (!context) {
    throw new Error('useGI must be used within a GIProvider');
  }
  return context;
};

export const useGIOptional = (): GIContextValue | null => {
  return useContext(GIContext);
};

interface GIProviderProps {
  children: React.ReactNode;
  initialQuality?: GIQualityTier;
}

export const GIProvider: React.FC<GIProviderProps> = ({ 
  children, 
  initialQuality = 'medium' 
}) => {
  const [config, setConfigState] = useState<GIConfig>(QUALITY_PRESETS[initialQuality]);
  const [probeVolume, setProbeVolume] = useState<ProbeVolume | null>(null);
  const [isInitialized, setInitialized] = useState(false);
  const [stats, setStats] = useState<GIStats>(defaultStats);
  
  const dirtyTrackerRef = useRef<DirtyRegionTracker>(new DirtyRegionTracker());
  
  const setConfig = useCallback((newConfig: GIConfig) => {
    setConfigState(newConfig);
  }, []);
  
  const setQualityTier = useCallback((tier: GIQualityTier) => {
    setConfigState(QUALITY_PRESETS[tier]);
  }, []);
  
  const markRegionDirty = useCallback((bounds: THREE.Box3) => {
    dirtyTrackerRef.current.markDirty(bounds);
    // Update stats
    setStats(prev => ({
      ...prev,
      dirtyRegions: dirtyTrackerRef.current.getDirtyRegions().length,
    }));
  }, []);
  
  const updateStats = useCallback((partialStats: Partial<GIStats>) => {
    setStats(prev => ({ ...prev, ...partialStats }));
  }, []);
  
  const value = useMemo<GIContextValue>(() => ({
    config,
    setConfig,
    setQualityTier,
    probeVolume,
    setProbeVolume,
    dirtyTracker: dirtyTrackerRef.current,
    markRegionDirty,
    isInitialized,
    setInitialized,
    stats,
    updateStats,
  }), [config, setConfig, setQualityTier, probeVolume, markRegionDirty, isInitialized, stats, updateStats]);
  
  return (
    <GIContext.Provider value={value}>
      {children}
    </GIContext.Provider>
  );
};

export default GIContext;
