/**
 * Plumbing Code Compliance Data
 * 
 * Based on IPC (International Plumbing Code) and UPC (Uniform Plumbing Code).
 * These values are used for automatic pipe sizing and slope calculations.
 */

import type { FixtureType } from '@/types/mep';

// =============================================================================
// DRAINAGE FIXTURE UNITS (DFU)
// Based on IPC Table 709.1 / UPC Table 702-1
// =============================================================================

export const DFU_TABLE: Record<FixtureType, number> = {
  // Bathroom fixtures
  'toilet': 4,
  'sink': 1,
  'shower': 2,
  'bathtub': 2,
  'bidet': 1,
  
  // Kitchen fixtures
  'kitchen-sink': 2,
  'dishwasher': 2,
  'garbage-disposal': 1,  // Added to kitchen sink DFU
  
  // Laundry fixtures
  'washing-machine': 2,
  'utility-sink': 2,
  
  // Utility fixtures
  'floor-drain': 2,
  'hose-bib': 0,  // No drainage
};

// =============================================================================
// WATER DEMAND (GPM - Gallons Per Minute)
// Based on IPC Table 604.3
// =============================================================================

export const GPM_TABLE: Record<FixtureType, { cold: number; hot: number }> = {
  // Bathroom fixtures
  'toilet': { cold: 3.0, hot: 0 },
  'sink': { cold: 1.5, hot: 1.5 },
  'shower': { cold: 2.5, hot: 2.5 },
  'bathtub': { cold: 4.0, hot: 4.0 },
  'bidet': { cold: 1.5, hot: 1.5 },
  
  // Kitchen fixtures
  'kitchen-sink': { cold: 2.5, hot: 2.5 },
  'dishwasher': { cold: 0, hot: 2.0 },  // Hot water only
  'garbage-disposal': { cold: 3.0, hot: 0 },
  
  // Laundry fixtures
  'washing-machine': { cold: 4.0, hot: 4.0 },
  'utility-sink': { cold: 2.5, hot: 2.5 },
  
  // Utility fixtures
  'floor-drain': { cold: 0, hot: 0 },
  'hose-bib': { cold: 5.0, hot: 0 },
};

// =============================================================================
// DRAIN PIPE SIZING
// Based on IPC Table 710.1(2) - Horizontal fixture branches and stacks
// =============================================================================

export interface PipeSizeEntry {
  maxDFU: number;
  pipeSize: number;  // inches
  description: string;
}

export const DRAIN_PIPE_SIZING: PipeSizeEntry[] = [
  { maxDFU: 1, pipeSize: 1.25, description: '1-1/4"' },
  { maxDFU: 3, pipeSize: 1.5, description: '1-1/2"' },
  { maxDFU: 6, pipeSize: 2, description: '2"' },
  { maxDFU: 12, pipeSize: 2.5, description: '2-1/2"' },
  { maxDFU: 20, pipeSize: 3, description: '3"' },
  { maxDFU: 160, pipeSize: 4, description: '4"' },
  { maxDFU: 360, pipeSize: 5, description: '5"' },
  { maxDFU: 620, pipeSize: 6, description: '6"' },
];

// =============================================================================
// VENT PIPE SIZING
// Based on IPC Table 916.1
// =============================================================================

export const VENT_PIPE_SIZING: PipeSizeEntry[] = [
  { maxDFU: 1, pipeSize: 1.25, description: '1-1/4"' },
  { maxDFU: 8, pipeSize: 1.5, description: '1-1/2"' },
  { maxDFU: 24, pipeSize: 2, description: '2"' },
  { maxDFU: 48, pipeSize: 2.5, description: '2-1/2"' },
  { maxDFU: 84, pipeSize: 3, description: '3"' },
  { maxDFU: 256, pipeSize: 4, description: '4"' },
];

// =============================================================================
// WATER SUPPLY PIPE SIZING
// Based on IPC Table 604.4 - Minimum pipe sizes
// =============================================================================

export interface WaterPipeSizeEntry {
  maxGPM: number;
  pipeSize: number;  // inches
  description: string;
}

export const WATER_PIPE_SIZING: WaterPipeSizeEntry[] = [
  { maxGPM: 3, pipeSize: 0.5, description: '1/2"' },
  { maxGPM: 6, pipeSize: 0.625, description: '5/8"' },
  { maxGPM: 10, pipeSize: 0.75, description: '3/4"' },
  { maxGPM: 22, pipeSize: 1, description: '1"' },
  { maxGPM: 40, pipeSize: 1.25, description: '1-1/4"' },
  { maxGPM: 60, pipeSize: 1.5, description: '1-1/2"' },
  { maxGPM: 100, pipeSize: 2, description: '2"' },
];

// =============================================================================
// MINIMUM DRAINAGE SLOPES
// Based on IPC Section 704.1
// =============================================================================

export interface SlopeRequirement {
  minPipeSize: number;  // inches
  maxPipeSize: number;  // inches
  minSlope: number;     // inches per foot
  percentSlope: number; // percentage
  description: string;
}

export const DRAINAGE_SLOPES: SlopeRequirement[] = [
  { 
    minPipeSize: 0, 
    maxPipeSize: 3, 
    minSlope: 0.25, 
    percentSlope: 2.08,
    description: '1/4" per foot (2.08%)' 
  },
  { 
    minPipeSize: 3, 
    maxPipeSize: Infinity, 
    minSlope: 0.125, 
    percentSlope: 1.04,
    description: '1/8" per foot (1.04%)' 
  },
];

// =============================================================================
// TRAP REQUIREMENTS
// Based on IPC Section 1002
// =============================================================================

export interface TrapRequirement {
  fixtureTypes: FixtureType[];
  minTrapSize: number;  // inches
  maxTrapArmLength: number;  // feet (distance to vent)
}

export const TRAP_REQUIREMENTS: TrapRequirement[] = [
  {
    fixtureTypes: ['sink', 'bidet'],
    minTrapSize: 1.25,
    maxTrapArmLength: 5,
  },
  {
    fixtureTypes: ['shower', 'bathtub', 'kitchen-sink', 'utility-sink', 'washing-machine', 'dishwasher'],
    minTrapSize: 1.5,
    maxTrapArmLength: 6,
  },
  {
    fixtureTypes: ['toilet'],
    minTrapSize: 3,  // Built-in trap
    maxTrapArmLength: 6,
  },
  {
    fixtureTypes: ['floor-drain'],
    minTrapSize: 2,
    maxTrapArmLength: 8,
  },
];

// =============================================================================
// FIXTURE CLEARANCES
// Based on IPC and accessibility requirements
// =============================================================================

export interface ClearanceRequirement {
  fixtureType: FixtureType;
  frontClearance: number;  // cm
  sideClearance: number;   // cm
  centerToCenter: number;  // cm (to adjacent fixtures)
}

export const FIXTURE_CLEARANCES: ClearanceRequirement[] = [
  { fixtureType: 'toilet', frontClearance: 53, sideClearance: 38, centerToCenter: 76 },
  { fixtureType: 'sink', frontClearance: 53, sideClearance: 10, centerToCenter: 76 },
  { fixtureType: 'shower', frontClearance: 60, sideClearance: 0, centerToCenter: 0 },
  { fixtureType: 'bathtub', frontClearance: 53, sideClearance: 0, centerToCenter: 0 },
  { fixtureType: 'bidet', frontClearance: 53, sideClearance: 38, centerToCenter: 76 },
  { fixtureType: 'kitchen-sink', frontClearance: 76, sideClearance: 15, centerToCenter: 0 },
  { fixtureType: 'washing-machine', frontClearance: 90, sideClearance: 5, centerToCenter: 0 },
  { fixtureType: 'utility-sink', frontClearance: 60, sideClearance: 10, centerToCenter: 0 },
  { fixtureType: 'dishwasher', frontClearance: 90, sideClearance: 0, centerToCenter: 0 },
  { fixtureType: 'garbage-disposal', frontClearance: 0, sideClearance: 0, centerToCenter: 0 },
  { fixtureType: 'floor-drain', frontClearance: 30, sideClearance: 30, centerToCenter: 0 },
  { fixtureType: 'hose-bib', frontClearance: 30, sideClearance: 0, centerToCenter: 0 },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the required drain pipe size for a given DFU value
 */
export function getDrainPipeSize(dfu: number): number {
  for (const entry of DRAIN_PIPE_SIZING) {
    if (dfu <= entry.maxDFU) {
      return entry.pipeSize;
    }
  }
  return DRAIN_PIPE_SIZING[DRAIN_PIPE_SIZING.length - 1].pipeSize;
}

/**
 * Get the required vent pipe size for a given DFU value
 */
export function getVentPipeSize(dfu: number): number {
  for (const entry of VENT_PIPE_SIZING) {
    if (dfu <= entry.maxDFU) {
      return entry.pipeSize;
    }
  }
  return VENT_PIPE_SIZING[VENT_PIPE_SIZING.length - 1].pipeSize;
}

/**
 * Get the required water supply pipe size for a given GPM value
 */
export function getWaterPipeSize(gpm: number): number {
  for (const entry of WATER_PIPE_SIZING) {
    if (gpm <= entry.maxGPM) {
      return entry.pipeSize;
    }
  }
  return WATER_PIPE_SIZING[WATER_PIPE_SIZING.length - 1].pipeSize;
}

/**
 * Get the minimum required slope for a given pipe size
 */
export function getMinSlope(pipeSizeInches: number): number {
  for (const entry of DRAINAGE_SLOPES) {
    if (pipeSizeInches >= entry.minPipeSize && pipeSizeInches < entry.maxPipeSize) {
      return entry.minSlope;
    }
  }
  return DRAINAGE_SLOPES[DRAINAGE_SLOPES.length - 1].minSlope;
}

/**
 * Get DFU value for a fixture type
 */
export function getFixtureDFU(fixtureType: FixtureType): number {
  return DFU_TABLE[fixtureType] || 0;
}

/**
 * Get GPM values for a fixture type
 */
export function getFixtureGPM(fixtureType: FixtureType): { cold: number; hot: number } {
  return GPM_TABLE[fixtureType] || { cold: 0, hot: 0 };
}

/**
 * Get trap requirements for a fixture type
 */
export function getTrapRequirements(fixtureType: FixtureType): TrapRequirement | undefined {
  return TRAP_REQUIREMENTS.find(req => req.fixtureTypes.includes(fixtureType));
}

/**
 * Get clearance requirements for a fixture type
 */
export function getClearanceRequirements(fixtureType: FixtureType): ClearanceRequirement | undefined {
  return FIXTURE_CLEARANCES.find(req => req.fixtureType === fixtureType);
}

/**
 * Validate drainage slope
 */
export function validateSlope(actualSlope: number, pipeSizeInches: number): {
  isValid: boolean;
  minRequired: number;
  message: string;
} {
  const minSlope = getMinSlope(pipeSizeInches);
  const isValid = actualSlope >= minSlope;
  
  return {
    isValid,
    minRequired: minSlope,
    message: isValid 
      ? `Slope OK: ${actualSlope.toFixed(3)}" per foot (min: ${minSlope}")`
      : `Slope too shallow: ${actualSlope.toFixed(3)}" per foot (min required: ${minSlope}")`
  };
}
