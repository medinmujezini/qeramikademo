/**
 * Installation Guide Generator
 * 
 * Generates professional-grade plumbing installation instructions
 * from MEP data with product recommendations and cost estimates.
 */

import type { MEPRoute, MEPFixture, MEPNode, MEPSystemType } from '@/types/mep';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface ProductOption {
  name: string;
  brand: string;
  price: number;
  currency: string;
  purchaseUrl?: string;
  productCode?: string;
  supplier: string;
  notes?: string;
}

export interface MaterialRequirement {
  id: string;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  cheapestOption: ProductOption;
  durableOption: ProductOption;
  alternatives: ProductOption[];
}

export interface InstallationStep {
  id: string;
  phase: 'preparation' | 'rough-in' | 'finish' | 'testing';
  system: 'cold-water' | 'hot-water' | 'drainage' | 'vent' | 'general';
  order: number;
  title: string;
  description: string;
  materials: MaterialRequirement[];
  tools: string[];
  tips: string[];
  warnings: string[];
  estimatedTime: string;
  codeReferences: string[];
  routingReason?: string;
}

export interface InstallationGuide {
  id: string;
  projectName: string;
  generatedAt: Date;
  totalEstimatedTime: string;
  totalCostBudget: number;
  totalCostPremium: number;
  currency: string;
  phases: {
    preparation: InstallationStep[];
    roughIn: InstallationStep[];
    finish: InstallationStep[];
    testing: InstallationStep[];
  };
  materialsSummary: MaterialRequirement[];
  commonMistakes: CommonMistake[];
}

export interface CommonMistake {
  id: string;
  system: string;
  mistake: string;
  impact: string;
  prevention: string;
  codeRef?: string;
}

// =============================================================================
// PRODUCT DATABASE (EUROPEAN SUPPLIERS)
// =============================================================================

const EUROPEAN_SUPPLIERS = {
  hornbach: { name: 'Hornbach', baseUrl: 'https://hornbach.com' },
  bauhaus: { name: 'Bauhaus', baseUrl: 'https://bauhaus.info' },
  obi: { name: 'OBI', baseUrl: 'https://obi.de' },
  screwfix: { name: 'Screwfix', baseUrl: 'https://screwfix.eu' },
};

// Product catalog for common plumbing materials
const PRODUCT_CATALOG: Record<string, { cheap: ProductOption; durable: ProductOption }> = {
  'pex-16mm': {
    cheap: {
      name: 'PEX Pipe DN16',
      brand: 'Generic',
      price: 1.40,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'PEX-16-100',
      notes: 'Per meter, meets EN ISO 15875',
    },
    durable: {
      name: 'PEX-a Pipe DN16',
      brand: 'Rehau RAUTITAN',
      price: 2.85,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'RAUTITAN-16',
      notes: 'Premium cross-linked, 50-year warranty',
    },
  },
  'pex-20mm': {
    cheap: {
      name: 'PEX Pipe DN20',
      brand: 'Generic',
      price: 1.85,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'PEX-20-100',
    },
    durable: {
      name: 'PEX-a Pipe DN20',
      brand: 'Rehau RAUTITAN',
      price: 3.95,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'RAUTITAN-20',
    },
  },
  'copper-15mm': {
    cheap: {
      name: 'Copper Pipe 15mm',
      brand: 'Generic',
      price: 4.50,
      currency: 'EUR',
      supplier: 'OBI',
      productCode: 'CU-15-3M',
      notes: 'Per meter, EN 1057',
    },
    durable: {
      name: 'Copper Pipe 15mm',
      brand: 'Wieland Sanco',
      price: 6.20,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'SANCO-15',
    },
  },
  'pvc-50mm': {
    cheap: {
      name: 'PVC-U Drain Pipe DN50',
      brand: 'Generic',
      price: 3.20,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'PVC-50-2M',
      notes: 'Per meter, EN 1329',
    },
    durable: {
      name: 'PP-HT Silent Pipe DN50',
      brand: 'Geberit Silent-PP',
      price: 8.50,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'SILENT-50',
      notes: 'Noise-dampening',
    },
  },
  'pvc-110mm': {
    cheap: {
      name: 'PVC-U Drain Pipe DN110',
      brand: 'Generic',
      price: 6.80,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'PVC-110-2M',
    },
    durable: {
      name: 'PP-HT Silent Pipe DN110',
      brand: 'Geberit Silent-PP',
      price: 18.50,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'SILENT-110',
    },
  },
  'ball-valve-16mm': {
    cheap: {
      name: 'Ball Valve 16mm',
      brand: 'Generic Brass',
      price: 8.50,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'BV-16-BRASS',
    },
    durable: {
      name: 'Ball Valve 16mm Full Bore',
      brand: 'Giacomini',
      price: 18.00,
      currency: 'EUR',
      supplier: 'Screwfix',
      productCode: 'GIAC-R250',
    },
  },
  'elbow-90-16mm': {
    cheap: {
      name: '90° Elbow 16mm',
      brand: 'Generic Brass',
      price: 2.20,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'ELB-90-16',
    },
    durable: {
      name: '90° Press Elbow 16mm',
      brand: 'Viega Profipress',
      price: 5.80,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'VIEGA-90-16',
    },
  },
  'tee-16mm': {
    cheap: {
      name: 'Tee 16mm',
      brand: 'Generic Brass',
      price: 3.50,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'TEE-16-BRASS',
    },
    durable: {
      name: 'Press Tee 16mm',
      brand: 'Viega Profipress',
      price: 8.90,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'VIEGA-T-16',
    },
  },
  'p-trap-40mm': {
    cheap: {
      name: 'P-Trap 40mm',
      brand: 'Generic PP',
      price: 4.50,
      currency: 'EUR',
      supplier: 'OBI',
      productCode: 'TRAP-P-40',
    },
    durable: {
      name: 'P-Trap 40mm Chrome',
      brand: 'Hansgrohe',
      price: 28.00,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'HANS-TRAP-40',
    },
  },
  'supply-line-braided': {
    cheap: {
      name: 'Braided Supply Line 3/8"',
      brand: 'Generic',
      price: 5.50,
      currency: 'EUR',
      supplier: 'Hornbach',
      productCode: 'FLEX-38-50',
    },
    durable: {
      name: 'Stainless Braided Hose 3/8"',
      brand: 'Grohe',
      price: 14.00,
      currency: 'EUR',
      supplier: 'Bauhaus',
      productCode: 'GROHE-FLEX-38',
    },
  },
};

// =============================================================================
// COMMON MISTAKES DATABASE
// =============================================================================

export const COMMON_MISTAKES: CommonMistake[] = [
  // Cold Water
  {
    id: 'cw-1',
    system: 'cold-water',
    mistake: 'Insufficient pipe support spacing',
    impact: 'Sagging pipes cause joint stress and eventual leaks',
    prevention: 'Install support clips every 60cm horizontal, 120cm vertical',
    codeRef: 'EN 806-4 Section 7.2',
  },
  {
    id: 'cw-2',
    system: 'cold-water',
    mistake: 'Mixing incompatible pipe materials without transition fittings',
    impact: 'Galvanic corrosion leading to premature failure',
    prevention: 'Use dielectric unions when connecting copper to steel',
    codeRef: 'EN 806-2 Section 5.3',
  },
  {
    id: 'cw-3',
    system: 'cold-water',
    mistake: 'Over-tightening compression fittings',
    impact: 'Deformed olive causes leaks under pressure',
    prevention: 'Tighten 1-1.5 turns past hand-tight, test before covering',
    codeRef: 'Manufacturer specifications',
  },
  // Hot Water
  {
    id: 'hw-1',
    system: 'hot-water',
    mistake: 'No expansion compensation on long runs',
    impact: 'Pipe stress, joint failures, noise',
    prevention: 'Install expansion loops or compensators every 6m',
    codeRef: 'EN 806-4 Section 8.1',
  },
  {
    id: 'hw-2',
    system: 'hot-water',
    mistake: 'Insufficient insulation on hot water pipes',
    impact: 'Heat loss, condensation, increased energy costs',
    prevention: 'Insulate with minimum 13mm wall thickness, seal all joints',
    codeRef: 'EnEV / EN 12828',
  },
  // Drainage
  {
    id: 'dr-1',
    system: 'drainage',
    mistake: 'Incorrect slope (too flat or too steep)',
    impact: 'Too flat: slow flow causes clogs. Too steep: water outruns solids',
    prevention: 'Maintain 1-2% slope (10-20mm drop per meter)',
    codeRef: 'EN 12056-2 Section 5.4',
  },
  {
    id: 'dr-2',
    system: 'drainage',
    mistake: 'Using 90° elbows in horizontal drain runs',
    impact: 'Creates blockage points, difficult to rod',
    prevention: 'Use two 45° elbows or long-radius bends',
    codeRef: 'EN 12056-2 Section 6.2',
  },
  {
    id: 'dr-3',
    system: 'drainage',
    mistake: 'Missing cleanout access',
    impact: 'Cannot clear blockages without cutting pipe',
    prevention: 'Install cleanout at every direction change and every 15m',
    codeRef: 'EN 12056-2 Section 7.1',
  },
  // Venting
  {
    id: 'vt-1',
    system: 'vent',
    mistake: 'Vent pipe undersized or too long',
    impact: 'Trap siphonage, sewer gas entry',
    prevention: 'Size vent at minimum 50% of drain size, limit developed length',
    codeRef: 'EN 12056-2 Table 8',
  },
  {
    id: 'vt-2',
    system: 'vent',
    mistake: 'Horizontal vent runs with sags',
    impact: 'Condensation blocks airflow',
    prevention: 'Slope horizontal vents up toward stack at 1%',
    codeRef: 'EN 12056-2 Section 8.3',
  },
];

// =============================================================================
// GENERATOR FUNCTIONS
// =============================================================================

function getProductForPipe(systemType: MEPSystemType, sizeMm: number): { cheap: ProductOption; durable: ProductOption } {
  if (systemType === 'drainage' || systemType === 'vent') {
    if (sizeMm >= 100) return PRODUCT_CATALOG['pvc-110mm'];
    return PRODUCT_CATALOG['pvc-50mm'];
  }
  if (sizeMm >= 20) return PRODUCT_CATALOG['pex-20mm'];
  return PRODUCT_CATALOG['pex-16mm'];
}

function getRouteSize(route: MEPRoute): number {
  // Get size from first segment or use default
  return route.segments[0]?.size || route.requiredSize || 16;
}

function generateMaterialsForRoute(route: MEPRoute): MaterialRequirement[] {
  const materials: MaterialRequirement[] = [];
  const routeSize = getRouteSize(route);
  const pipeProduct = getProductForPipe(route.systemType, routeSize);
  
  // Calculate total pipe length from segments
  const totalLength = route.segments.reduce((sum, seg) => {
    const dx = seg.endPoint.x - seg.startPoint.x;
    const dy = seg.endPoint.y - seg.startPoint.y;
    const dz = (seg.endPoint.z || 0) - (seg.startPoint.z || 0);
    return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, 0) / 100; // Convert cm to m
  
  // Use route.totalLength if segments empty
  const pipeLength = totalLength > 0 ? totalLength : (route.totalLength / 100);
  
  // Pipe
  materials.push({
    id: uuidv4(),
    name: pipeProduct.cheap.name,
    specification: `DN${routeSize}mm, ${route.systemType}`,
    quantity: Math.ceil(pipeLength * 1.1) || 1, // 10% extra, min 1
    unit: 'm',
    cheapestOption: pipeProduct.cheap,
    durableOption: pipeProduct.durable,
    alternatives: [],
  });
  
  // Count direction changes for fittings
  let elbowCount = 0;
  for (let i = 1; i < route.segments.length; i++) {
    const prev = route.segments[i - 1];
    const curr = route.segments[i];
    // Check if direction changed
    const prevDx = prev.endPoint.x - prev.startPoint.x;
    const prevDy = prev.endPoint.y - prev.startPoint.y;
    const currDx = curr.endPoint.x - curr.startPoint.x;
    const currDy = curr.endPoint.y - curr.startPoint.y;
    if (Math.abs(prevDx * currDy - prevDy * currDx) > 0.01) {
      elbowCount++;
    }
  }
  
  if (elbowCount > 0) {
    const elbowProduct = PRODUCT_CATALOG['elbow-90-16mm'];
    materials.push({
      id: uuidv4(),
      name: elbowProduct.cheap.name,
      specification: `DN${routeSize}mm`,
      quantity: elbowCount,
      unit: 'pcs',
      cheapestOption: elbowProduct.cheap,
      durableOption: elbowProduct.durable,
      alternatives: [],
    });
  }
  
  return materials;
}

function generateStepsForFixture(
  fixture: MEPFixture,
  routes: MEPRoute[],
  stepOrder: { current: number }
): InstallationStep[] {
  const steps: InstallationStep[] = [];
  
  // Filter routes connected to this fixture
  const fixtureRoutes = routes.filter(r => 
    r.destination.id === fixture.id || 
    (r.source.type === 'node' && r.source.nodeId === fixture.id)
  );
  
  // Group by system type
  const coldWaterRoutes = fixtureRoutes.filter(r => r.systemType === 'cold-water');
  const hotWaterRoutes = fixtureRoutes.filter(r => r.systemType === 'hot-water');
  const drainageRoutes = fixtureRoutes.filter(r => r.systemType === 'drainage');
  const ventRoutes = fixtureRoutes.filter(r => r.systemType === 'vent');
  
  // Cold water connection
  if (coldWaterRoutes.length > 0) {
    const route = coldWaterRoutes[0];
    const materials = generateMaterialsForRoute(route);
    
    // Add valve
    const valveProduct = PRODUCT_CATALOG['ball-valve-16mm'];
    materials.push({
      id: uuidv4(),
      name: valveProduct.cheap.name,
      specification: 'Shut-off valve',
      quantity: 1,
      unit: 'pcs',
      cheapestOption: valveProduct.cheap,
      durableOption: valveProduct.durable,
      alternatives: [],
    });
    
    // Add supply line
    const supplyProduct = PRODUCT_CATALOG['supply-line-braided'];
    materials.push({
      id: uuidv4(),
      name: supplyProduct.cheap.name,
      specification: '50cm length',
      quantity: 1,
      unit: 'pcs',
      cheapestOption: supplyProduct.cheap,
      durableOption: supplyProduct.durable,
      alternatives: [],
    });
    
    steps.push({
      id: uuidv4(),
      phase: 'rough-in',
      system: 'cold-water',
      order: stepOrder.current++,
      title: `Cold Water Supply to ${fixture.type}`,
      description: `Connect cold water supply pipe from main distribution to ${fixture.type}. Route pipe through wall cavity maintaining proper support spacing.`,
      materials,
      tools: ['Pipe cutter', 'Deburring tool', 'Press tool or compression wrenches', 'Level', 'Pipe supports'],
      tips: [
        'Mark pipe route on wall before cutting into structure',
        'Install shut-off valve at accessible height (40-50cm from floor)',
        'Pressure test section before closing wall',
        'Take photos of pipe routing before covering',
      ],
      warnings: [
        'Do not bend PEX tighter than 5x pipe diameter',
        'Avoid running near heat sources or electrical cables',
        'Protect from freezing in exterior walls',
      ],
      estimatedTime: '30-45 min',
      codeReferences: ['EN 806-2', 'EN 806-4'],
      routingReason: `Direct route minimizes pressure loss. Pipe sized for ${(fixture.gpm * 0.6).toFixed(2)} L/s peak demand with adequate margin.`,
    });
  }
  
  // Hot water connection
  if (hotWaterRoutes.length > 0) {
    const route = hotWaterRoutes[0];
    const materials = generateMaterialsForRoute(route);
    
    const valveProduct = PRODUCT_CATALOG['ball-valve-16mm'];
    materials.push({
      id: uuidv4(),
      name: valveProduct.cheap.name,
      specification: 'Shut-off valve',
      quantity: 1,
      unit: 'pcs',
      cheapestOption: valveProduct.cheap,
      durableOption: valveProduct.durable,
      alternatives: [],
    });
    
    steps.push({
      id: uuidv4(),
      phase: 'rough-in',
      system: 'hot-water',
      order: stepOrder.current++,
      title: `Hot Water Supply to ${fixture.type}`,
      description: `Connect hot water supply from water heater/manifold to ${fixture.type}. Install pipe insulation for energy efficiency.`,
      materials,
      tools: ['Pipe cutter', 'Deburring tool', 'Press tool', 'Insulation knife', 'Pipe supports'],
      tips: [
        'Install hot water pipe on LEFT side (standard convention)',
        'Insulate entire run including fittings',
        'Allow for thermal expansion with loops or compensators',
      ],
      warnings: [
        'Hot water pipe MUST be insulated to prevent heat loss',
        'Keep parallel to cold water pipe with min 50mm spacing',
        'Do not mix with cold water insulation',
      ],
      estimatedTime: '35-50 min',
      codeReferences: ['EN 806-2', 'EnEV insulation requirements'],
      routingReason: `Routed to minimize heat loss. Sized for ${(fixture.gpm * 0.4).toFixed(2)} L/s flow rate.`,
    });
  }
  
  // Drainage connection
  if (drainageRoutes.length > 0) {
    const route = drainageRoutes[0];
    const materials = generateMaterialsForRoute(route);
    
    // Add trap
    const trapProduct = PRODUCT_CATALOG['p-trap-40mm'];
    materials.push({
      id: uuidv4(),
      name: trapProduct.cheap.name,
      specification: 'P-trap with inspection port',
      quantity: 1,
      unit: 'pcs',
      cheapestOption: trapProduct.cheap,
      durableOption: trapProduct.durable,
      alternatives: [],
    });
    
    steps.push({
      id: uuidv4(),
      phase: 'rough-in',
      system: 'drainage',
      order: stepOrder.current++,
      title: `Drainage Connection for ${fixture.type}`,
      description: `Install waste pipe from ${fixture.type} to main drain stack. Maintain proper slope and install P-trap to prevent sewer gas entry.`,
      materials,
      tools: ['Pipe cutter', 'Deburring tool', 'Level (for slope)', 'PVC cement and primer', 'Cleaning cloths'],
      tips: [
        'Dry-fit entire run before cementing',
        'Mark slope reference line on wall/joist',
        'Trap must have min 50mm water seal depth',
        'Install cleanout access where possible',
      ],
      warnings: [
        'NEVER use 90° elbows in horizontal runs - use 45° combinations',
        'Slope must be exactly 1-2% - too steep causes solid buildup',
        'Ensure trap is within max distance from vent (see code table)',
      ],
      estimatedTime: '40-60 min',
      codeReferences: ['EN 12056-2', 'EN 12056-5'],
      routingReason: `Gravity flow path to stack. ${fixture.dfu} DFU load, sized DN${getRouteSize(route)}mm per code tables. Slope: ${route.segments[0]?.slope ? (route.segments[0].slope * 100).toFixed(1) : '1-2'}%.`,
    });
  }
  
  // Vent connection
  if (ventRoutes.length > 0) {
    const route = ventRoutes[0];
    const materials = generateMaterialsForRoute(route);
    
    steps.push({
      id: uuidv4(),
      phase: 'rough-in',
      system: 'vent',
      order: stepOrder.current++,
      title: `Vent Connection for ${fixture.type}`,
      description: `Connect vent pipe from fixture trap arm to main vent stack. Ensures proper drainage flow and prevents trap siphonage.`,
      materials,
      tools: ['Pipe cutter', 'Deburring tool', 'PVC cement', 'Level'],
      tips: [
        'Vent must connect above trap weir (flood level)',
        'Rise vertically before any horizontal run',
        'Horizontal vents must slope UP toward stack',
      ],
      warnings: [
        'Vent cannot drop below fixture flood level rim',
        'Horizontal run cannot have any sags (condensation trap)',
        'Size vent at minimum 50% of drain size',
      ],
      estimatedTime: '25-35 min',
      codeReferences: ['EN 12056-2 Section 8'],
      routingReason: `Vent sized DN${getRouteSize(route)}mm for ${fixture.dfu} DFU. Connected within maximum developed length per code.`,
    });
  }
  
  return steps;
}

export function generateInstallationGuide(
  fixtures: MEPFixture[],
  routes: MEPRoute[],
  nodes: MEPNode[],
  projectName: string = 'Plumbing Project'
): InstallationGuide {
  const stepOrder = { current: 1 };
  
  // Preparation phase
  const preparationSteps: InstallationStep[] = [
    {
      id: uuidv4(),
      phase: 'preparation',
      system: 'general',
      order: stepOrder.current++,
      title: 'Pre-Installation Site Preparation',
      description: 'Before beginning any plumbing work, ensure all necessary preparations are complete.',
      materials: [],
      tools: ['Stud finder', 'Level', 'Tape measure', 'Marker', 'Safety glasses', 'Work gloves'],
      tips: [
        'Shut off main water supply before starting',
        'Identify all existing utility locations (electrical, gas)',
        'Mark all pipe routes on walls and floors',
        'Ensure adequate ventilation in work area',
      ],
      warnings: [
        'Check local permit requirements before starting',
        'Identify load-bearing walls - do not notch or drill without engineering approval',
        'Know the location of main water shutoff',
      ],
      estimatedTime: '30-60 min',
      codeReferences: ['Local building codes', 'EN 806-1'],
    },
    {
      id: uuidv4(),
      phase: 'preparation',
      system: 'general',
      order: stepOrder.current++,
      title: 'Verify Main Connections',
      description: 'Confirm water main pressure, drain stack locations, and vent stack access points.',
      materials: [],
      tools: ['Pressure gauge', 'Inspection camera (optional)', 'Notebook'],
      tips: [
        'Record incoming water pressure (should be 2-4 bar)',
        'Verify drain stack size matches fixture load requirements',
        'Check vent stack terminates properly above roofline',
      ],
      warnings: [
        'If water pressure exceeds 5 bar, a pressure reducing valve is required',
        'Undersized drain stacks will cause drainage issues - upgrade if needed',
      ],
      estimatedTime: '20-30 min',
      codeReferences: ['EN 806-2', 'EN 12056-2'],
    },
  ];
  
  // Generate rough-in steps for each fixture
  const roughInSteps: InstallationStep[] = [];
  for (const fixture of fixtures) {
    const fixtureSteps = generateStepsForFixture(fixture, routes, stepOrder);
    roughInSteps.push(...fixtureSteps);
  }
  
  // Finish phase
  const finishSteps: InstallationStep[] = [
    {
      id: uuidv4(),
      phase: 'finish',
      system: 'general',
      order: stepOrder.current++,
      title: 'Install Fixtures',
      description: 'With all rough-in plumbing complete and tested, install the final fixtures.',
      materials: [],
      tools: ['Basin wrench', 'Adjustable wrench', 'Silicone sealant', 'Plumber\'s putty', 'Level'],
      tips: [
        'Apply plumber\'s putty or silicone under fixture flanges',
        'Hand-tighten supply line connections first, then 1/4 turn with wrench',
        'Check for level on all visible fixtures',
      ],
      warnings: [
        'Do not over-tighten porcelain - it will crack',
        'Ensure trap water seal is maintained',
      ],
      estimatedTime: '30-60 min per fixture',
      codeReferences: ['Manufacturer instructions'],
    },
  ];
  
  // Testing phase
  const testingSteps: InstallationStep[] = [
    {
      id: uuidv4(),
      phase: 'testing',
      system: 'cold-water',
      order: stepOrder.current++,
      title: 'Pressure Test Water Supply',
      description: 'Test all water supply lines for leaks under pressure.',
      materials: [],
      tools: ['Pressure test pump', 'Pressure gauge', 'Test plugs', 'Towels'],
      tips: [
        'Pressurize to 1.5x working pressure (typically 6-8 bar)',
        'Hold pressure for minimum 15 minutes',
        'Check every joint, valve, and connection',
        'Document test results with photos and pressure readings',
      ],
      warnings: [
        'NEVER leave pressurized system unattended',
        'Repair any leaks before proceeding',
        'Do not cover pipes until test passed',
      ],
      estimatedTime: '30-60 min',
      codeReferences: ['EN 806-4 Section 11'],
    },
    {
      id: uuidv4(),
      phase: 'testing',
      system: 'drainage',
      order: stepOrder.current++,
      title: 'Test Drainage System',
      description: 'Verify all drain lines flow properly and have no leaks.',
      materials: [],
      tools: ['Test plugs', 'Garden hose', 'Bucket', 'Flashlight'],
      tips: [
        'Fill each fixture and check trap seal',
        'Run water for 2+ minutes to verify flow',
        'Check for proper venting (no gurgling)',
        'Inspect all joints from below if accessible',
      ],
      warnings: [
        'Slow drainage indicates slope or blockage issue',
        'Gurgling indicates venting problem',
        'Any visible leak requires repair before use',
      ],
      estimatedTime: '20-40 min',
      codeReferences: ['EN 12056-5 Section 8'],
    },
    {
      id: uuidv4(),
      phase: 'testing',
      system: 'general',
      order: stepOrder.current++,
      title: 'Final Inspection Checklist',
      description: 'Complete final walkthrough and documentation.',
      materials: [],
      tools: ['Checklist form', 'Camera', 'Label maker'],
      tips: [
        'Label all shut-off valves',
        'Photograph all hidden pipe runs before closing walls',
        'Create as-built drawings for future reference',
        'Explain system to homeowner/facility manager',
      ],
      warnings: [
        'Do not close walls until all inspections passed',
        'Keep records for warranty and insurance purposes',
      ],
      estimatedTime: '30 min',
      codeReferences: ['Local inspection requirements'],
    },
  ];
  
  // Compile all materials
  const allSteps = [...preparationSteps, ...roughInSteps, ...finishSteps, ...testingSteps];
  const materialsSummary: MaterialRequirement[] = [];
  const materialMap = new Map<string, MaterialRequirement>();
  
  for (const step of allSteps) {
    for (const mat of step.materials) {
      const key = `${mat.name}-${mat.specification}`;
      if (materialMap.has(key)) {
        const existing = materialMap.get(key)!;
        existing.quantity += mat.quantity;
      } else {
        materialMap.set(key, { ...mat, id: uuidv4() });
      }
    }
  }
  materialsSummary.push(...materialMap.values());
  
  // Calculate totals
  const totalCostBudget = materialsSummary.reduce((sum, m) => sum + m.quantity * m.cheapestOption.price, 0);
  const totalCostPremium = materialsSummary.reduce((sum, m) => sum + m.quantity * m.durableOption.price, 0);
  
  // Filter relevant mistakes
  const systemsUsed = new Set<string>();
  for (const route of routes) {
    if (route.systemType === 'cold-water') systemsUsed.add('cold-water');
    if (route.systemType === 'hot-water') systemsUsed.add('hot-water');
    if (route.systemType === 'drainage') systemsUsed.add('drainage');
    if (route.systemType === 'vent') systemsUsed.add('vent');
  }
  const relevantMistakes = COMMON_MISTAKES.filter(m => systemsUsed.has(m.system));
  
  return {
    id: uuidv4(),
    projectName,
    generatedAt: new Date(),
    totalEstimatedTime: `${Math.round(allSteps.length * 0.5)}-${allSteps.length} hours`,
    totalCostBudget: Math.round(totalCostBudget * 100) / 100,
    totalCostPremium: Math.round(totalCostPremium * 100) / 100,
    currency: 'EUR',
    phases: {
      preparation: preparationSteps,
      roughIn: roughInSteps,
      finish: finishSteps,
      testing: testingSteps,
    },
    materialsSummary,
    commonMistakes: relevantMistakes,
  };
}

// Helper to format guide as markdown for AI context
export function formatGuideForAI(guide: InstallationGuide): string {
  let text = `# Installation Guide: ${guide.projectName}\n\n`;
  text += `**Generated:** ${guide.generatedAt.toISOString()}\n`;
  text += `**Estimated Time:** ${guide.totalEstimatedTime}\n`;
  text += `**Cost Range:** €${guide.totalCostBudget.toFixed(2)} (budget) - €${guide.totalCostPremium.toFixed(2)} (premium)\n\n`;
  
  text += `## Materials Summary\n\n`;
  for (const mat of guide.materialsSummary) {
    text += `- ${mat.quantity} ${mat.unit} ${mat.name} (${mat.specification})\n`;
  }
  
  text += `\n## Installation Steps\n\n`;
  const allSteps = [
    ...guide.phases.preparation,
    ...guide.phases.roughIn,
    ...guide.phases.finish,
    ...guide.phases.testing,
  ];
  
  for (const step of allSteps) {
    text += `### Step ${step.order}: ${step.title}\n`;
    text += `**Phase:** ${step.phase} | **System:** ${step.system} | **Time:** ${step.estimatedTime}\n\n`;
    text += `${step.description}\n\n`;
    if (step.routingReason) {
      text += `**Routing Reason:** ${step.routingReason}\n\n`;
    }
  }
  
  return text;
}
