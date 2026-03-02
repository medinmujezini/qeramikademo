/**
 * MEP Bill of Materials Generator
 * 
 * Calculates pipe lengths, fittings, materials, and estimated costs
 * from MEP routes and fixtures.
 */

import type { MEPRoute, MEPFixture, MEPNode, MEPSystemType, PlumbingSystemType } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';

// =============================================================================
// TYPES
// =============================================================================

export interface MaterialItem {
  id: string;
  category: 'pipe' | 'fitting' | 'fixture' | 'accessory';
  name: string;
  description: string;
  systemType: MEPSystemType;
  size: number; // Diameter in inches or wire gauge
  material: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface BOMSummary {
  items: MaterialItem[];
  totalPipeLength: number; // In feet
  totalFittings: number;
  totalFixtures: number;
  subtotal: number;
  laborEstimate: number;
  contingency: number;
  grandTotal: number;
  bySystem: Record<MEPSystemType, {
    pipeLength: number;
    fittings: number;
    cost: number;
  }>;
}

// =============================================================================
// COST DATA (Rough estimates in USD)
// =============================================================================

const PIPE_COSTS_PER_FOOT: Record<string, Record<number, number>> = {
  'PVC': {
    1.5: 1.50,
    2: 2.00,
    3: 3.50,
    4: 5.00,
    6: 10.00,
  },
  'ABS': {
    1.5: 1.75,
    2: 2.25,
    3: 4.00,
    4: 5.50,
    6: 11.00,
  },
  'Copper': {
    0.5: 3.00,
    0.75: 4.50,
    1: 6.00,
    1.5: 9.00,
    2: 14.00,
  },
  'PEX': {
    0.5: 0.75,
    0.75: 1.00,
    1: 1.50,
    1.5: 2.50,
  },
  'CPVC': {
    0.5: 1.00,
    0.75: 1.25,
    1: 1.75,
    1.5: 2.75,
  },
  'THHN': { // Electrical wire per foot
    14: 0.15,
    12: 0.25,
    10: 0.40,
    8: 0.65,
    6: 1.00,
  },
};

const FITTING_COSTS: Record<string, Record<number, number>> = {
  'elbow-90': {
    0.5: 2.00,
    0.75: 2.50,
    1: 3.00,
    1.5: 4.00,
    2: 5.00,
    3: 8.00,
    4: 12.00,
  },
  'elbow-45': {
    0.5: 1.75,
    0.75: 2.25,
    1: 2.75,
    1.5: 3.50,
    2: 4.50,
    3: 7.00,
    4: 10.00,
  },
  'tee': {
    0.5: 3.00,
    0.75: 3.75,
    1: 4.50,
    1.5: 6.00,
    2: 8.00,
    3: 12.00,
    4: 18.00,
  },
  'coupling': {
    0.5: 1.00,
    0.75: 1.25,
    1: 1.50,
    1.5: 2.00,
    2: 2.50,
    3: 4.00,
    4: 6.00,
  },
  'wye': {
    1.5: 5.00,
    2: 7.00,
    3: 12.00,
    4: 18.00,
  },
  'cleanout': {
    2: 8.00,
    3: 12.00,
    4: 16.00,
  },
  'p-trap': {
    1.25: 8.00,
    1.5: 10.00,
    2: 14.00,
  },
};

const LABOR_RATE_PER_HOUR = 75; // USD
const LABOR_HOURS_PER_100FT_PIPE = 2;
const LABOR_HOURS_PER_FITTING = 0.25;
const LABOR_HOURS_PER_FIXTURE = 1.5;
const CONTINGENCY_PERCENT = 0.15;

// =============================================================================
// BOM GENERATION
// =============================================================================

export function generateBillOfMaterials(
  routes: MEPRoute[],
  fixtures: MEPFixture[],
  nodes: MEPNode[]
): BOMSummary {
  const items: MaterialItem[] = [];
  let itemId = 0;

  const bySystem: BOMSummary['bySystem'] = {
    'cold-water': { pipeLength: 0, fittings: 0, cost: 0 },
    'hot-water': { pipeLength: 0, fittings: 0, cost: 0 },
    'drainage': { pipeLength: 0, fittings: 0, cost: 0 },
    'vent': { pipeLength: 0, fittings: 0, cost: 0 },
    'power': { pipeLength: 0, fittings: 0, cost: 0 },
    'dedicated': { pipeLength: 0, fittings: 0, cost: 0 },
    'lighting': { pipeLength: 0, fittings: 0, cost: 0 },
  };

  // Aggregate pipe lengths by system, size, and material
  const pipeAggregates: Record<string, { length: number; material: string; size: number; systemType: MEPSystemType }> = {};
  const fittingAggregates: Record<string, { count: number; type: string; size: number; systemType: MEPSystemType }> = {};

  for (const route of routes) {
    for (const segment of route.segments) {
      // Calculate segment length
      const dx = segment.endPoint.x - segment.startPoint.x;
      const dy = segment.endPoint.y - segment.startPoint.y;
      const dz = segment.endPoint.z - segment.startPoint.z;
      const lengthInches = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const lengthFeet = lengthInches / 12;

      // Aggregate by material + size
      const pipeKey = `${segment.material}-${segment.size}-${segment.systemType}`;
      if (!pipeAggregates[pipeKey]) {
        pipeAggregates[pipeKey] = {
          length: 0,
          material: segment.material,
          size: segment.size,
          systemType: segment.systemType,
        };
      }
      pipeAggregates[pipeKey].length += lengthFeet;
      bySystem[segment.systemType].pipeLength += lengthFeet;

      // Count fittings
      if (segment.fittingAtStart) {
        const fittingKey = `${segment.fittingAtStart}-${segment.size}-${segment.systemType}`;
        if (!fittingAggregates[fittingKey]) {
          fittingAggregates[fittingKey] = {
            count: 0,
            type: segment.fittingAtStart,
            size: segment.size,
            systemType: segment.systemType,
          };
        }
        fittingAggregates[fittingKey].count++;
        bySystem[segment.systemType].fittings++;
      }

      if (segment.fittingAtEnd) {
        const fittingKey = `${segment.fittingAtEnd}-${segment.size}-${segment.systemType}`;
        if (!fittingAggregates[fittingKey]) {
          fittingAggregates[fittingKey] = {
            count: 0,
            type: segment.fittingAtEnd,
            size: segment.size,
            systemType: segment.systemType,
          };
        }
        fittingAggregates[fittingKey].count++;
        bySystem[segment.systemType].fittings++;
      }
    }
  }

  // Create pipe items
  for (const [key, data] of Object.entries(pipeAggregates)) {
    const unitCost = getPipeCostPerFoot(data.material, data.size);
    const totalCost = data.length * unitCost;

    items.push({
      id: `pipe-${itemId++}`,
      category: 'pipe',
      name: `${data.material} Pipe`,
      description: `${data.size}" ${data.material} pipe for ${formatSystemName(data.systemType)}`,
      systemType: data.systemType,
      size: data.size,
      material: data.material,
      quantity: Math.ceil(data.length),
      unit: 'ft',
      unitCost,
      totalCost,
    });

    bySystem[data.systemType].cost += totalCost;
  }

  // Create fitting items
  for (const [key, data] of Object.entries(fittingAggregates)) {
    const unitCost = getFittingCost(data.type, data.size);
    const totalCost = data.count * unitCost;

    items.push({
      id: `fitting-${itemId++}`,
      category: 'fitting',
      name: formatFittingName(data.type),
      description: `${data.size}" ${formatFittingName(data.type)} for ${formatSystemName(data.systemType)}`,
      systemType: data.systemType,
      size: data.size,
      material: '',
      quantity: data.count,
      unit: 'ea',
      unitCost,
      totalCost,
    });

    bySystem[data.systemType].cost += totalCost;
  }

  // Add fixtures
  for (const fixture of fixtures) {
    const fixtureItem = createFixtureItem(fixture, itemId++);
    items.push(fixtureItem);
    
    const primarySystem = fixture.connections[0]?.systemType || 'cold-water';
    bySystem[primarySystem].cost += fixtureItem.totalCost;
  }

  // Calculate totals
  const totalPipeLength = Object.values(pipeAggregates).reduce((sum, p) => sum + p.length, 0);
  const totalFittings = Object.values(fittingAggregates).reduce((sum, f) => sum + f.count, 0);
  const totalFixtures = fixtures.length;
  const subtotal = items.reduce((sum, item) => sum + item.totalCost, 0);

  // Labor estimate
  const laborHours = 
    (totalPipeLength / 100) * LABOR_HOURS_PER_100FT_PIPE +
    totalFittings * LABOR_HOURS_PER_FITTING +
    totalFixtures * LABOR_HOURS_PER_FIXTURE;
  const laborEstimate = laborHours * LABOR_RATE_PER_HOUR;

  // Contingency
  const contingency = (subtotal + laborEstimate) * CONTINGENCY_PERCENT;
  const grandTotal = subtotal + laborEstimate + contingency;

  return {
    items,
    totalPipeLength: Math.round(totalPipeLength * 10) / 10,
    totalFittings,
    totalFixtures,
    subtotal: Math.round(subtotal * 100) / 100,
    laborEstimate: Math.round(laborEstimate * 100) / 100,
    contingency: Math.round(contingency * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    bySystem,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getPipeCostPerFoot(material: string, size: number): number {
  const materialCosts = PIPE_COSTS_PER_FOOT[material];
  if (!materialCosts) return 2.00; // Default

  // Find closest size
  const sizes = Object.keys(materialCosts).map(Number).sort((a, b) => a - b);
  const closestSize = sizes.reduce((prev, curr) => 
    Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
  );

  return materialCosts[closestSize] || 2.00;
}

function getFittingCost(fittingType: string, size: number): number {
  const fittingCosts = FITTING_COSTS[fittingType];
  if (!fittingCosts) return 5.00; // Default

  // Find closest size
  const sizes = Object.keys(fittingCosts).map(Number).sort((a, b) => a - b);
  const closestSize = sizes.reduce((prev, curr) => 
    Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
  );

  return fittingCosts[closestSize] || 5.00;
}

function formatFittingName(type: string): string {
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSystemName(systemType: MEPSystemType): string {
  const names: Record<MEPSystemType, string> = {
    'cold-water': 'Cold Water',
    'hot-water': 'Hot Water',
    'drainage': 'Drainage',
    'vent': 'Vent',
    'power': 'Power',
    'dedicated': 'Dedicated Circuit',
    'lighting': 'Lighting',
  };
  return names[systemType] || systemType;
}

function createFixtureItem(fixture: MEPFixture, id: number): MaterialItem {
  // Estimate fixture costs
  const fixtureCosts: Record<string, number> = {
    'toilet': 200,
    'lavatory': 150,
    'sink': 180,
    'shower': 350,
    'bathtub': 500,
    'dishwasher': 0, // Usually appliance, not plumbing cost
    'washing-machine': 0,
    'floor-drain': 80,
    'water-heater': 800,
    'utility-sink': 120,
  };

  const cost = fixtureCosts[fixture.type] || 200;
  const primarySystem = fixture.connections[0]?.systemType || 'cold-water';

  return {
    id: `fixture-${id}`,
    category: 'fixture',
    name: fixture.name,
    description: `${fixture.type} fixture - ${fixture.dfu} DFU`,
    systemType: primarySystem,
    size: 0,
    material: '',
    quantity: 1,
    unit: 'ea',
    unitCost: cost,
    totalCost: cost,
  };
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

export function exportBOMToCSV(bom: BOMSummary): string {
  const headers = ['Item', 'Category', 'Description', 'System', 'Size', 'Material', 'Qty', 'Unit', 'Unit Cost', 'Total'];
  const rows = bom.items.map(item => [
    item.name,
    item.category,
    item.description,
    formatSystemName(item.systemType),
    item.size ? `${item.size}"` : '-',
    item.material || '-',
    item.quantity.toString(),
    item.unit,
    `$${item.unitCost.toFixed(2)}`,
    `$${item.totalCost.toFixed(2)}`,
  ]);

  // Add summary rows
  rows.push([]);
  rows.push(['', '', '', '', '', '', '', '', 'Subtotal:', `$${bom.subtotal.toFixed(2)}`]);
  rows.push(['', '', '', '', '', '', '', '', 'Labor:', `$${bom.laborEstimate.toFixed(2)}`]);
  rows.push(['', '', '', '', '', '', '', '', 'Contingency (15%):', `$${bom.contingency.toFixed(2)}`]);
  rows.push(['', '', '', '', '', '', '', '', 'GRAND TOTAL:', `$${bom.grandTotal.toFixed(2)}`]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

export function downloadBOMAsCSV(bom: BOMSummary, filename: string = 'mep-bill-of-materials.csv') {
  const csvContent = exportBOMToCSV(bom);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
