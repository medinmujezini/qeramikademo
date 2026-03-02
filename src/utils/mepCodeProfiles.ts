/**
 * MEP Code Profile System - Phase 9
 * 
 * Selectable code standards for regional plumbing code compliance.
 * Supports IPC, UPC, EU (EN12056), and NSF standards.
 */

import type { FixtureType } from '@/types/mep';

// =============================================================================
// TYPES
// =============================================================================

export type CodeStandard = 'IPC' | 'UPC' | 'EU-EN12056' | 'NSF';

export interface CodeProfile {
  id: CodeStandard;
  name: string;
  region: string;
  description: string;
  units: 'imperial' | 'metric';
  
  // Slope requirements
  slopeRequirements: SlopeRequirement[];
  
  // DFU/DU values
  fixtureUnits: Record<FixtureType, number>;
  
  // Pipe sizing tables
  drainPipeSizing: PipeSizeEntry[];
  ventPipeSizing: PipeSizeEntry[];
  waterPipeSizing: WaterPipeSizeEntry[];
  
  // Material restrictions
  allowedDrainMaterials: string[];
  allowedWaterMaterials: string[];
  
  // Trap requirements
  trapRequirements: TrapRequirementEntry[];
  
  // Cleanout spacing
  maxCleanoutSpacing: number; // in code's native units
}

export interface SlopeRequirement {
  minPipeSize: number;
  maxPipeSize: number;
  minSlope: number;
  slopeDescription: string;
}

export interface PipeSizeEntry {
  maxUnits: number;
  pipeSize: number;
  description: string;
}

export interface WaterPipeSizeEntry {
  maxGPM?: number;
  maxLPS?: number; // liters per second for metric
  pipeSize: number;
  description: string;
}

export interface TrapRequirementEntry {
  fixtureTypes: FixtureType[];
  minTrapSize: number;
  maxTrapArmLength: number;
}

// =============================================================================
// CODE PROFILES
// =============================================================================

export const CODE_PROFILES: Record<CodeStandard, CodeProfile> = {
  'IPC': {
    id: 'IPC',
    name: 'International Plumbing Code',
    region: 'USA (Many States)',
    description: 'Most widely adopted code in the United States',
    units: 'imperial',
    
    slopeRequirements: [
      { minPipeSize: 0, maxPipeSize: 3, minSlope: 0.25, slopeDescription: '1/4" per foot' },
      { minPipeSize: 3, maxPipeSize: Infinity, minSlope: 0.125, slopeDescription: '1/8" per foot' },
    ],
    
    fixtureUnits: {
      'toilet': 4,
      'sink': 1,
      'shower': 2,
      'bathtub': 2,
      'bidet': 1,
      'kitchen-sink': 2,
      'dishwasher': 2,
      'garbage-disposal': 1,
      'washing-machine': 2,
      'utility-sink': 2,
      'floor-drain': 2,
      'hose-bib': 0,
    },
    
    drainPipeSizing: [
      { maxUnits: 1, pipeSize: 1.25, description: '1-1/4"' },
      { maxUnits: 3, pipeSize: 1.5, description: '1-1/2"' },
      { maxUnits: 6, pipeSize: 2, description: '2"' },
      { maxUnits: 12, pipeSize: 2.5, description: '2-1/2"' },
      { maxUnits: 20, pipeSize: 3, description: '3"' },
      { maxUnits: 160, pipeSize: 4, description: '4"' },
      { maxUnits: 360, pipeSize: 5, description: '5"' },
      { maxUnits: 620, pipeSize: 6, description: '6"' },
    ],
    
    ventPipeSizing: [
      { maxUnits: 1, pipeSize: 1.25, description: '1-1/4"' },
      { maxUnits: 8, pipeSize: 1.5, description: '1-1/2"' },
      { maxUnits: 24, pipeSize: 2, description: '2"' },
      { maxUnits: 48, pipeSize: 2.5, description: '2-1/2"' },
      { maxUnits: 84, pipeSize: 3, description: '3"' },
      { maxUnits: 256, pipeSize: 4, description: '4"' },
    ],
    
    waterPipeSizing: [
      { maxGPM: 3, pipeSize: 0.5, description: '1/2"' },
      { maxGPM: 6, pipeSize: 0.625, description: '5/8"' },
      { maxGPM: 10, pipeSize: 0.75, description: '3/4"' },
      { maxGPM: 22, pipeSize: 1, description: '1"' },
      { maxGPM: 40, pipeSize: 1.25, description: '1-1/4"' },
    ],
    
    allowedDrainMaterials: ['PVC', 'ABS', 'Cast Iron', 'Copper', 'CPVC'],
    allowedWaterMaterials: ['Copper', 'PEX', 'CPVC', 'Galvanized'],
    
    trapRequirements: [
      { fixtureTypes: ['sink', 'bidet'], minTrapSize: 1.25, maxTrapArmLength: 5 },
      { fixtureTypes: ['shower', 'bathtub', 'kitchen-sink', 'utility-sink', 'washing-machine', 'dishwasher'], minTrapSize: 1.5, maxTrapArmLength: 6 },
      { fixtureTypes: ['toilet'], minTrapSize: 3, maxTrapArmLength: 6 },
      { fixtureTypes: ['floor-drain'], minTrapSize: 2, maxTrapArmLength: 8 },
    ],
    
    maxCleanoutSpacing: 600, // 50 feet in inches
  },
  
  'UPC': {
    id: 'UPC',
    name: 'Uniform Plumbing Code',
    region: 'USA (Western States)',
    description: 'Common in California, Arizona, and western states',
    units: 'imperial',
    
    slopeRequirements: [
      { minPipeSize: 0, maxPipeSize: 3, minSlope: 0.25, slopeDescription: '1/4" per foot' },
      { minPipeSize: 3, maxPipeSize: Infinity, minSlope: 0.125, slopeDescription: '1/8" per foot' },
    ],
    
    fixtureUnits: {
      'toilet': 4,
      'sink': 1,
      'shower': 2,
      'bathtub': 3, // Slightly different from IPC
      'bidet': 1,
      'kitchen-sink': 2,
      'dishwasher': 2,
      'garbage-disposal': 1,
      'washing-machine': 3, // Slightly different from IPC
      'utility-sink': 2,
      'floor-drain': 2,
      'hose-bib': 0,
    },
    
    drainPipeSizing: [
      { maxUnits: 1, pipeSize: 1.25, description: '1-1/4"' },
      { maxUnits: 2, pipeSize: 1.5, description: '1-1/2"' },
      { maxUnits: 4, pipeSize: 2, description: '2"' },
      { maxUnits: 10, pipeSize: 2.5, description: '2-1/2"' },
      { maxUnits: 20, pipeSize: 3, description: '3"' },
      { maxUnits: 160, pipeSize: 4, description: '4"' },
      { maxUnits: 360, pipeSize: 5, description: '5"' },
      { maxUnits: 600, pipeSize: 6, description: '6"' },
    ],
    
    ventPipeSizing: [
      { maxUnits: 1, pipeSize: 1.25, description: '1-1/4"' },
      { maxUnits: 8, pipeSize: 1.5, description: '1-1/2"' },
      { maxUnits: 24, pipeSize: 2, description: '2"' },
      { maxUnits: 48, pipeSize: 2.5, description: '2-1/2"' },
      { maxUnits: 84, pipeSize: 3, description: '3"' },
      { maxUnits: 256, pipeSize: 4, description: '4"' },
    ],
    
    waterPipeSizing: [
      { maxGPM: 3, pipeSize: 0.5, description: '1/2"' },
      { maxGPM: 6, pipeSize: 0.625, description: '5/8"' },
      { maxGPM: 10, pipeSize: 0.75, description: '3/4"' },
      { maxGPM: 20, pipeSize: 1, description: '1"' },
      { maxGPM: 35, pipeSize: 1.25, description: '1-1/4"' },
    ],
    
    allowedDrainMaterials: ['PVC', 'ABS', 'Cast Iron', 'Copper'],
    allowedWaterMaterials: ['Copper', 'PEX', 'CPVC'],
    
    trapRequirements: [
      { fixtureTypes: ['sink', 'bidet'], minTrapSize: 1.25, maxTrapArmLength: 3.5 },
      { fixtureTypes: ['shower', 'bathtub', 'kitchen-sink', 'utility-sink', 'washing-machine', 'dishwasher'], minTrapSize: 1.5, maxTrapArmLength: 5 },
      { fixtureTypes: ['toilet'], minTrapSize: 3, maxTrapArmLength: 6 },
      { fixtureTypes: ['floor-drain'], minTrapSize: 2, maxTrapArmLength: 6 },
    ],
    
    maxCleanoutSpacing: 600, // 50 feet in inches
  },
  
  'EU-EN12056': {
    id: 'EU-EN12056',
    name: 'European Standard EN12056',
    region: 'European Union',
    description: 'European drainage system standard',
    units: 'metric',
    
    slopeRequirements: [
      { minPipeSize: 0, maxPipeSize: 75, minSlope: 20, slopeDescription: '1:50 (2%)' },
      { minPipeSize: 75, maxPipeSize: Infinity, minSlope: 10, slopeDescription: '1:100 (1%)' },
    ],
    
    fixtureUnits: {
      // EU uses Design Units (DU) instead of DFU
      'toilet': 2.0,
      'sink': 0.5,
      'shower': 0.6,
      'bathtub': 0.8,
      'bidet': 0.5,
      'kitchen-sink': 0.8,
      'dishwasher': 0.8,
      'garbage-disposal': 0.3,
      'washing-machine': 1.5,
      'utility-sink': 0.8,
      'floor-drain': 0.8,
      'hose-bib': 0,
    },
    
    drainPipeSizing: [
      // Metric pipe sizes (mm)
      { maxUnits: 1, pipeSize: 32, description: 'DN32' },
      { maxUnits: 2.5, pipeSize: 40, description: 'DN40' },
      { maxUnits: 5.0, pipeSize: 50, description: 'DN50' },
      { maxUnits: 10, pipeSize: 75, description: 'DN75' },
      { maxUnits: 25, pipeSize: 100, description: 'DN100' },
      { maxUnits: 50, pipeSize: 125, description: 'DN125' },
      { maxUnits: 100, pipeSize: 150, description: 'DN150' },
    ],
    
    ventPipeSizing: [
      { maxUnits: 2, pipeSize: 32, description: 'DN32' },
      { maxUnits: 10, pipeSize: 40, description: 'DN40' },
      { maxUnits: 30, pipeSize: 50, description: 'DN50' },
      { maxUnits: 60, pipeSize: 75, description: 'DN75' },
      { maxUnits: 200, pipeSize: 100, description: 'DN100' },
    ],
    
    waterPipeSizing: [
      { maxLPS: 0.2, pipeSize: 15, description: 'DN15' },
      { maxLPS: 0.4, pipeSize: 20, description: 'DN20' },
      { maxLPS: 0.8, pipeSize: 25, description: 'DN25' },
      { maxLPS: 1.5, pipeSize: 32, description: 'DN32' },
      { maxLPS: 3.0, pipeSize: 40, description: 'DN40' },
    ],
    
    allowedDrainMaterials: ['PVC', 'PP', 'HDPE', 'Cast Iron', 'Stainless Steel'],
    allowedWaterMaterials: ['Copper', 'PEX', 'Multilayer', 'Stainless Steel', 'PPR'],
    
    trapRequirements: [
      { fixtureTypes: ['sink', 'bidet'], minTrapSize: 32, maxTrapArmLength: 1.5 },
      { fixtureTypes: ['shower', 'bathtub', 'kitchen-sink', 'utility-sink', 'washing-machine', 'dishwasher'], minTrapSize: 40, maxTrapArmLength: 2.0 },
      { fixtureTypes: ['toilet'], minTrapSize: 100, maxTrapArmLength: 2.0 },
      { fixtureTypes: ['floor-drain'], minTrapSize: 50, maxTrapArmLength: 2.5 },
    ],
    
    maxCleanoutSpacing: 15000, // 15 meters in mm
  },
  
  'NSF': {
    id: 'NSF',
    name: 'NSF/ANSI Standard',
    region: 'USA (Commercial/Food Service)',
    description: 'National Sanitation Foundation standards for commercial applications',
    units: 'imperial',
    
    slopeRequirements: [
      { minPipeSize: 0, maxPipeSize: 3, minSlope: 0.25, slopeDescription: '1/4" per foot' },
      { minPipeSize: 3, maxPipeSize: Infinity, minSlope: 0.125, slopeDescription: '1/8" per foot' },
    ],
    
    fixtureUnits: {
      'toilet': 4,
      'sink': 2, // Higher for commercial
      'shower': 2,
      'bathtub': 2,
      'bidet': 1,
      'kitchen-sink': 3, // Higher for commercial
      'dishwasher': 3, // Higher for commercial
      'garbage-disposal': 2,
      'washing-machine': 3,
      'utility-sink': 3,
      'floor-drain': 3,
      'hose-bib': 0,
    },
    
    drainPipeSizing: [
      { maxUnits: 1, pipeSize: 1.5, description: '1-1/2"' },
      { maxUnits: 4, pipeSize: 2, description: '2"' },
      { maxUnits: 10, pipeSize: 2.5, description: '2-1/2"' },
      { maxUnits: 20, pipeSize: 3, description: '3"' },
      { maxUnits: 120, pipeSize: 4, description: '4"' },
      { maxUnits: 300, pipeSize: 5, description: '5"' },
      { maxUnits: 500, pipeSize: 6, description: '6"' },
    ],
    
    ventPipeSizing: [
      { maxUnits: 4, pipeSize: 1.5, description: '1-1/2"' },
      { maxUnits: 20, pipeSize: 2, description: '2"' },
      { maxUnits: 40, pipeSize: 2.5, description: '2-1/2"' },
      { maxUnits: 70, pipeSize: 3, description: '3"' },
      { maxUnits: 200, pipeSize: 4, description: '4"' },
    ],
    
    waterPipeSizing: [
      { maxGPM: 5, pipeSize: 0.75, description: '3/4"' },
      { maxGPM: 12, pipeSize: 1, description: '1"' },
      { maxGPM: 25, pipeSize: 1.25, description: '1-1/4"' },
      { maxGPM: 45, pipeSize: 1.5, description: '1-1/2"' },
    ],
    
    allowedDrainMaterials: ['Stainless Steel', 'Cast Iron', 'HDPE'],
    allowedWaterMaterials: ['Copper', 'Stainless Steel', 'CPVC'],
    
    trapRequirements: [
      { fixtureTypes: ['sink', 'bidet'], minTrapSize: 1.5, maxTrapArmLength: 4 },
      { fixtureTypes: ['shower', 'bathtub', 'kitchen-sink', 'utility-sink', 'washing-machine', 'dishwasher'], minTrapSize: 2, maxTrapArmLength: 5 },
      { fixtureTypes: ['toilet'], minTrapSize: 3, maxTrapArmLength: 6 },
      { fixtureTypes: ['floor-drain'], minTrapSize: 3, maxTrapArmLength: 6 },
    ],
    
    maxCleanoutSpacing: 480, // 40 feet in inches (stricter)
  },
};

// =============================================================================
// CODE PROFILE HELPERS
// =============================================================================

let currentCodeStandard: CodeStandard = 'IPC';

/**
 * Get current code profile
 */
export function getCurrentCodeProfile(): CodeProfile {
  return CODE_PROFILES[currentCodeStandard];
}

/**
 * Set current code standard
 */
export function setCodeStandard(standard: CodeStandard): void {
  currentCodeStandard = standard;
}

/**
 * Get available code standards
 */
export function getAvailableCodeStandards(): Array<{ id: CodeStandard; name: string; region: string }> {
  return Object.values(CODE_PROFILES).map(p => ({
    id: p.id,
    name: p.name,
    region: p.region,
  }));
}

/**
 * Get fixture units for current code
 */
export function getCodeFixtureUnits(fixtureType: FixtureType): number {
  return getCurrentCodeProfile().fixtureUnits[fixtureType] ?? 0;
}

/**
 * Get drain pipe size for current code
 */
export function getCodeDrainPipeSize(units: number): number {
  const profile = getCurrentCodeProfile();
  for (const entry of profile.drainPipeSizing) {
    if (units <= entry.maxUnits) {
      return entry.pipeSize;
    }
  }
  return profile.drainPipeSizing[profile.drainPipeSizing.length - 1].pipeSize;
}

/**
 * Get minimum slope for current code
 */
export function getCodeMinSlope(pipeSize: number): number {
  const profile = getCurrentCodeProfile();
  for (const entry of profile.slopeRequirements) {
    if (pipeSize >= entry.minPipeSize && pipeSize < entry.maxPipeSize) {
      return entry.minSlope;
    }
  }
  return profile.slopeRequirements[profile.slopeRequirements.length - 1].minSlope;
}

/**
 * Check if material is allowed for drainage
 */
export function isMaterialAllowedForDrain(material: string): boolean {
  return getCurrentCodeProfile().allowedDrainMaterials.includes(material);
}

/**
 * Check if material is allowed for water supply
 */
export function isMaterialAllowedForWater(material: string): boolean {
  return getCurrentCodeProfile().allowedWaterMaterials.includes(material);
}

/**
 * Get max cleanout spacing for current code
 */
export function getCodeMaxCleanoutSpacing(): number {
  return getCurrentCodeProfile().maxCleanoutSpacing;
}

/**
 * Convert units between imperial and metric
 */
export function convertUnits(
  value: number,
  from: 'imperial' | 'metric',
  to: 'imperial' | 'metric'
): number {
  if (from === to) return value;
  
  if (from === 'imperial' && to === 'metric') {
    return value * 25.4; // inches to mm
  } else {
    return value / 25.4; // mm to inches
  }
}
