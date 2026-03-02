/**
 * Fixture Library
 * 
 * Comprehensive fixture definitions with all MEP data.
 * Includes dimensions, connection points, DFU/GPM/wattage values,
 * and code-required clearances.
 */

import type { 
  MEPFixture, 
  FixtureType, 
  FixtureCategory,
  FixtureConnection,
  Dimensions 
} from '@/types/mep';
import { DFU_TABLE, GPM_TABLE } from './plumbingCodes';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// FIXTURE TEMPLATES
// =============================================================================

export interface FixtureTemplate {
  type: FixtureType;
  category: FixtureCategory;
  name: string;
  dimensions: Dimensions;        // cm
  clearance: {
    front: number;
    sides: number;
    rear: number;
  };
  requiresWall: boolean;
  wallOffset: number;            // cm from wall
  trapHeight: number;            // cm from floor (drainage)
  supplyHeight: number;          // cm from floor (water supply)
  wattage: number;               // electrical load
  connectionTemplates: Array<{
    systemType: 'cold-water' | 'hot-water' | 'drainage' | 'vent' | 'power';
    localPosition: { x: number; y: number; z: number };  // Relative to center
    isRequired: boolean;
  }>;
  icon?: string;                 // Lucide icon name
}

// =============================================================================
// BATHROOM FIXTURES
// =============================================================================

const TOILET_TEMPLATE: FixtureTemplate = {
  type: 'toilet',
  category: 'bathroom',
  name: 'Toilet',
  dimensions: { width: 40, depth: 70, height: 40 },
  clearance: { front: 53, sides: 38, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 0,                 // Floor-mounted
  supplyHeight: 20,              // Water supply at ~20cm
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: -15, y: 25, z: 20 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 15, z: 0 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 15, z: 40 }, isRequired: true },
  ],
  icon: 'toilet',
};

const SINK_TEMPLATE: FixtureTemplate = {
  type: 'sink',
  category: 'bathroom',
  name: 'Bathroom Sink',
  dimensions: { width: 50, depth: 45, height: 20 },
  clearance: { front: 53, sides: 10, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 45,                // Trap at ~45cm
  supplyHeight: 55,              // Supply above trap
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: -10, y: 15, z: 55 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 10, y: 15, z: 55 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 15, z: 45 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 15, z: 65 }, isRequired: true },
  ],
  icon: 'sink',
};

const SHOWER_TEMPLATE: FixtureTemplate = {
  type: 'shower',
  category: 'bathroom',
  name: 'Shower',
  dimensions: { width: 90, depth: 90, height: 220 },
  clearance: { front: 60, sides: 0, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 0,                 // Floor drain
  supplyHeight: 200,             // Showerhead height
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: 0, y: 35, z: 120 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 0, y: 35, z: 120 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 0, z: 0 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 35, z: 80 }, isRequired: true },
  ],
  icon: 'shower',
};

const BATHTUB_TEMPLATE: FixtureTemplate = {
  type: 'bathtub',
  category: 'bathroom',
  name: 'Bathtub',
  dimensions: { width: 75, depth: 170, height: 60 },
  clearance: { front: 53, sides: 0, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 10,
  supplyHeight: 45,
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: 30, y: 75, z: 45 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 30, y: 75, z: 45 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 40, z: 10 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 75, z: 50 }, isRequired: true },
  ],
  icon: 'bathtub',
};

const BIDET_TEMPLATE: FixtureTemplate = {
  type: 'bidet',
  category: 'bathroom',
  name: 'Bidet',
  dimensions: { width: 40, depth: 60, height: 40 },
  clearance: { front: 53, sides: 38, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 25,
  supplyHeight: 35,
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: -15, y: 25, z: 35 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 15, y: 25, z: 35 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 20, z: 25 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 25, z: 40 }, isRequired: true },
  ],
  icon: 'bidet',
};

// =============================================================================
// KITCHEN FIXTURES
// =============================================================================

const KITCHEN_SINK_TEMPLATE: FixtureTemplate = {
  type: 'kitchen-sink',
  category: 'kitchen',
  name: 'Kitchen Sink',
  dimensions: { width: 80, depth: 55, height: 25 },
  clearance: { front: 76, sides: 15, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 45,
  supplyHeight: 55,
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: -25, y: 20, z: 55 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 25, y: 20, z: 55 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 20, z: 45 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 20, z: 70 }, isRequired: true },
  ],
  icon: 'sink',
};

const DISHWASHER_TEMPLATE: FixtureTemplate = {
  type: 'dishwasher',
  category: 'kitchen',
  name: 'Dishwasher',
  dimensions: { width: 60, depth: 60, height: 85 },
  clearance: { front: 90, sides: 0, rear: 0 },
  requiresWall: false,
  wallOffset: 5,
  trapHeight: 10,
  supplyHeight: 15,
  wattage: 1800,
  connectionTemplates: [
    { systemType: 'hot-water', localPosition: { x: -25, y: 25, z: 15 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 25, y: 25, z: 10 }, isRequired: true },
    { systemType: 'power', localPosition: { x: 0, y: 25, z: 10 }, isRequired: true },
  ],
  icon: 'dishwasher',
};

const GARBAGE_DISPOSAL_TEMPLATE: FixtureTemplate = {
  type: 'garbage-disposal',
  category: 'kitchen',
  name: 'Garbage Disposal',
  dimensions: { width: 15, depth: 15, height: 35 },
  clearance: { front: 0, sides: 0, rear: 0 },
  requiresWall: false,
  wallOffset: 0,
  trapHeight: 30,
  supplyHeight: 0,
  wattage: 750,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: 0, y: 5, z: 20 }, isRequired: false },
    { systemType: 'drainage', localPosition: { x: 0, y: 5, z: 30 }, isRequired: true },
    { systemType: 'power', localPosition: { x: 0, y: 5, z: 10 }, isRequired: true },
  ],
  icon: 'trash',
};

// =============================================================================
// LAUNDRY FIXTURES
// =============================================================================

const WASHING_MACHINE_TEMPLATE: FixtureTemplate = {
  type: 'washing-machine',
  category: 'laundry',
  name: 'Washing Machine',
  dimensions: { width: 60, depth: 65, height: 85 },
  clearance: { front: 90, sides: 5, rear: 5 },
  requiresWall: true,
  wallOffset: 5,
  trapHeight: 80,                // Standpipe height
  supplyHeight: 105,             // Valves above machine
  wattage: 500,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: -20, y: 30, z: 105 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 20, y: 30, z: 105 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 30, z: 80 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 30, z: 110 }, isRequired: true },
    { systemType: 'power', localPosition: { x: 0, y: 30, z: 30 }, isRequired: true },
  ],
  icon: 'washingMachine',
};

const UTILITY_SINK_TEMPLATE: FixtureTemplate = {
  type: 'utility-sink',
  category: 'laundry',
  name: 'Utility Sink',
  dimensions: { width: 60, depth: 55, height: 90 },
  clearance: { front: 60, sides: 10, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 45,
  supplyHeight: 55,
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: -20, y: 20, z: 55 }, isRequired: true },
    { systemType: 'hot-water', localPosition: { x: 20, y: 20, z: 55 }, isRequired: true },
    { systemType: 'drainage', localPosition: { x: 0, y: 20, z: 45 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 20, z: 70 }, isRequired: true },
  ],
  icon: 'sink',
};

// =============================================================================
// UTILITY FIXTURES
// =============================================================================

const FLOOR_DRAIN_TEMPLATE: FixtureTemplate = {
  type: 'floor-drain',
  category: 'utility',
  name: 'Floor Drain',
  dimensions: { width: 15, depth: 15, height: 10 },
  clearance: { front: 30, sides: 30, rear: 30 },
  requiresWall: false,
  wallOffset: 0,
  trapHeight: 0,
  supplyHeight: 0,
  wattage: 0,
  connectionTemplates: [
    { systemType: 'drainage', localPosition: { x: 0, y: 0, z: 0 }, isRequired: true },
    { systemType: 'vent', localPosition: { x: 0, y: 0, z: 30 }, isRequired: false },
  ],
  icon: 'circle',
};

const HOSE_BIB_TEMPLATE: FixtureTemplate = {
  type: 'hose-bib',
  category: 'utility',
  name: 'Hose Bib / Outdoor Faucet',
  dimensions: { width: 10, depth: 15, height: 15 },
  clearance: { front: 30, sides: 0, rear: 0 },
  requiresWall: true,
  wallOffset: 0,
  trapHeight: 0,
  supplyHeight: 45,
  wattage: 0,
  connectionTemplates: [
    { systemType: 'cold-water', localPosition: { x: 0, y: 5, z: 45 }, isRequired: true },
  ],
  icon: 'droplet',
};

// =============================================================================
// FIXTURE LIBRARY
// =============================================================================

export const FIXTURE_TEMPLATES: FixtureTemplate[] = [
  // Bathroom
  TOILET_TEMPLATE,
  SINK_TEMPLATE,
  SHOWER_TEMPLATE,
  BATHTUB_TEMPLATE,
  BIDET_TEMPLATE,
  // Kitchen
  KITCHEN_SINK_TEMPLATE,
  DISHWASHER_TEMPLATE,
  GARBAGE_DISPOSAL_TEMPLATE,
  // Laundry
  WASHING_MACHINE_TEMPLATE,
  UTILITY_SINK_TEMPLATE,
  // Utility
  FLOOR_DRAIN_TEMPLATE,
  HOSE_BIB_TEMPLATE,
];

/**
 * Get fixtures grouped by category
 */
export function getFixturesByCategory(): Record<FixtureCategory, FixtureTemplate[]> {
  return {
    bathroom: FIXTURE_TEMPLATES.filter(f => f.category === 'bathroom'),
    kitchen: FIXTURE_TEMPLATES.filter(f => f.category === 'kitchen'),
    laundry: FIXTURE_TEMPLATES.filter(f => f.category === 'laundry'),
    utility: FIXTURE_TEMPLATES.filter(f => f.category === 'utility'),
  };
}

/**
 * Get a fixture template by type
 */
export function getFixtureTemplate(type: FixtureType): FixtureTemplate | undefined {
  return FIXTURE_TEMPLATES.find(f => f.type === type);
}

/**
 * Create a new MEPFixture instance from a template
 */
export function createFixtureFromTemplate(
  template: FixtureTemplate,
  position: { x: number; y: number },
  rotation: number = 0
): MEPFixture {
  const fixtureId = uuidv4();
  
  const connections: FixtureConnection[] = template.connectionTemplates.map(ct => ({
    id: uuidv4(),
    systemType: ct.systemType,
    localPosition: ct.localPosition,
    isRequired: ct.isRequired,
  }));
  
  const gpmData = GPM_TABLE[template.type] || { cold: 0, hot: 0 };
  
  return {
    id: fixtureId,
    type: template.type,
    category: template.category,
    name: template.name,
    position,
    rotation,
    dimensions: { ...template.dimensions },
    dfu: DFU_TABLE[template.type] || 0,
    gpm: gpmData.cold + gpmData.hot,
    wattage: template.wattage,
    clearance: { ...template.clearance },
    requiresWall: template.requiresWall,
    wallOffset: template.wallOffset,
    connections,
    trapHeight: template.trapHeight,
    supplyHeight: template.supplyHeight,
  };
}

/**
 * Get the world position of a connection point
 */
export function getConnectionWorldPosition(
  fixture: MEPFixture,
  connection: FixtureConnection
): { x: number; y: number; z: number } {
  const rad = (fixture.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Rotate local position around fixture center
  const rotatedX = connection.localPosition.x * cos - connection.localPosition.y * sin;
  const rotatedY = connection.localPosition.x * sin + connection.localPosition.y * cos;
  
  return {
    x: fixture.position.x + rotatedX,
    y: fixture.position.y + rotatedY,
    z: connection.localPosition.z,
  };
}
