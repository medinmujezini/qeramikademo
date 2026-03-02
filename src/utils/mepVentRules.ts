/**
 * MEP Vent Rules Engine - Phase 2
 * 
 * Implements proper venting rules per IPC/UPC code.
 * Vents must rise vertically above flood rim before any horizontal run.
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  MEPFixture, 
  MEPRoute, 
  MEPSegment, 
  MEPNode, 
  Point2D, 
  Point3D,
  FittingType 
} from '@/types/mep';
import { SYSTEM_COLORS, DEFAULT_PIPE_MATERIALS } from '@/types/mep';
import { getVentPipeSize, getTrapRequirements } from '@/data/plumbingCodes';
import { FLOOD_RIM_LEVELS, STANDARD_ELEVATIONS } from './mepSlopeEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface VentRequirement {
  fixtureId: string;
  fixtureName: string;
  requiredVentSize: number;        // inches
  maxTrapArmLength: number;        // feet
  floodRimLevel: number;           // inches from floor
  minVentRiseAboveRim: number;     // inches (typically 6")
}

export interface VentPath {
  points: Point3D[];
  segments: VentSegmentType[];
  isValid: boolean;
  violations: string[];
}

export type VentSegmentType = 'vertical-rise' | 'horizontal-run' | 'final-rise';

export interface VentViolation {
  type: 'horizontal-before-rise' | 'below-flood-rim' | 'trap-arm-too-long' | 's-trap-detected';
  message: string;
  severity: 'critical' | 'error' | 'warning';
  codeReference: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_VENT_RISE_ABOVE_FLOOD_RIM = 6;  // inches
const VENT_HORIZONTAL_SLOPE = 0.125;       // 1/8" per foot for horizontal vents
const MAX_VENT_OFFSET_LENGTH = 15;         // feet for horizontal offset

// =============================================================================
// VENT REQUIREMENTS
// =============================================================================

/**
 * Get vent requirements for a fixture
 */
export function getVentRequirements(fixture: MEPFixture): VentRequirement {
  const trapReq = getTrapRequirements(fixture.type);
  const floodRimLevel = FLOOD_RIM_LEVELS[fixture.type] ?? 30;
  
  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    requiredVentSize: getVentPipeSize(fixture.dfu),
    maxTrapArmLength: trapReq?.maxTrapArmLength ?? 6,
    floodRimLevel,
    minVentRiseAboveRim: MIN_VENT_RISE_ABOVE_FLOOD_RIM,
  };
}

// =============================================================================
// VENT PATH GENERATION
// =============================================================================

/**
 * Generate a code-compliant vent path for a fixture
 * 
 * Vent routing logic:
 * 1. Start at fixture trap connection
 * 2. Rise vertically to flood_rim + 6"
 * 3. Only then route horizontally toward vent stack
 * 4. Final vertical rise to roof penetration
 */
export function generateVentPath(
  fixture: MEPFixture,
  ventStack: MEPNode,
  existingRoutes: MEPRoute[]
): VentPath {
  const violations: string[] = [];
  const points: Point3D[] = [];
  const segments: VentSegmentType[] = [];
  
  const requirements = getVentRequirements(fixture);
  
  // Starting point: trap arm connection (near fixture drain)
  const startPoint: Point3D = {
    x: fixture.position.x,
    y: fixture.position.y,
    z: requirements.floodRimLevel - 10,  // Below flood rim (at trap)
  };
  points.push(startPoint);
  
  // Point 1: Vertical rise to above flood rim
  const risePoint: Point3D = {
    x: fixture.position.x,
    y: fixture.position.y,
    z: requirements.floodRimLevel + MIN_VENT_RISE_ABOVE_FLOOD_RIM,
  };
  points.push(risePoint);
  segments.push('vertical-rise');
  
  // Point 2: Horizontal run toward vent stack (with slight upward slope)
  const stackX = ventStack.position.x;
  const stackY = ventStack.position.y;
  
  // Calculate horizontal distance
  const dx = stackX - fixture.position.x;
  const dy = stackY - fixture.position.y;
  const horizontalDist = Math.sqrt(dx * dx + dy * dy);
  const horizontalFeet = horizontalDist / 12;
  
  // Check if horizontal run is too long
  if (horizontalFeet > MAX_VENT_OFFSET_LENGTH) {
    violations.push(`Horizontal vent run too long: ${horizontalFeet.toFixed(1)} ft (max: ${MAX_VENT_OFFSET_LENGTH} ft)`);
  }
  
  // Horizontal run must slope upward toward vent stack
  const horizontalRise = horizontalFeet * VENT_HORIZONTAL_SLOPE;
  
  const horizontalEndPoint: Point3D = {
    x: stackX,
    y: stackY,
    z: risePoint.z + horizontalRise,
  };
  points.push(horizontalEndPoint);
  segments.push('horizontal-run');
  
  // Point 3: Final vertical rise to vent stack (through roof)
  const roofPoint: Point3D = {
    x: stackX,
    y: stackY,
    z: STANDARD_ELEVATIONS.VENT_STACK_ROOF,
  };
  points.push(roofPoint);
  segments.push('final-rise');
  
  return {
    points,
    segments,
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Create a vent route from a vent path
 */
export function createVentRoute(
  fixture: MEPFixture,
  ventPath: VentPath,
  ventStack: MEPNode
): MEPRoute {
  const routeId = uuidv4();
  const segments: MEPSegment[] = [];
  const ventSize = getVentPipeSize(fixture.dfu);
  
  for (let i = 0; i < ventPath.points.length - 1; i++) {
    const segment: MEPSegment = {
      id: uuidv4(),
      routeId,
      segmentIndex: i,
      systemType: 'vent',
      startPoint: ventPath.points[i],
      endPoint: ventPath.points[i + 1],
      size: ventSize,
      material: DEFAULT_PIPE_MATERIALS['vent'],
      color: SYSTEM_COLORS['vent'],
    };
    
    // Add fittings at direction changes
    if (ventPath.segments[i] === 'vertical-rise' && ventPath.segments[i + 1] === 'horizontal-run') {
      segment.fittingAtEnd = 'elbow-90';
    }
    if (ventPath.segments[i] === 'horizontal-run' && ventPath.segments[i + 1] === 'final-rise') {
      segment.fittingAtEnd = 'sanitary-tee';  // Tying into vent stack
    }
    
    segments.push(segment);
  }
  
  const totalLength = segments.reduce((sum, seg) => {
    const dx = seg.endPoint.x - seg.startPoint.x;
    const dy = seg.endPoint.y - seg.startPoint.y;
    const dz = seg.endPoint.z - seg.startPoint.z;
    return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, 0);
  
  return {
    id: routeId,
    systemType: 'vent',
    segments,
    source: {
      type: 'node',
      nodeId: ventStack.id,
    },
    destination: {
      type: 'fixture',
      id: fixture.id,
    },
    totalLength,
    totalDFU: fixture.dfu,
    requiredSize: ventSize,
    elevation: {
      start: ventPath.points[0].z,
      end: ventPath.points[ventPath.points.length - 1].z,
    },
    isValid: ventPath.isValid,
    validationErrors: ventPath.violations,
  };
}

// =============================================================================
// VENT VALIDATION
// =============================================================================

/**
 * Validate a vent route against code requirements
 */
export function validateVentRoute(route: MEPRoute, fixture: MEPFixture): VentViolation[] {
  if (route.systemType !== 'vent') return [];
  
  const violations: VentViolation[] = [];
  const requirements = getVentRequirements(fixture);
  
  // Check first segment is vertical rise
  if (route.segments.length > 0) {
    const firstSeg = route.segments[0];
    const dx = Math.abs(firstSeg.endPoint.x - firstSeg.startPoint.x);
    const dy = Math.abs(firstSeg.endPoint.y - firstSeg.startPoint.y);
    const dz = firstSeg.endPoint.z - firstSeg.startPoint.z;
    
    // If horizontal movement before vertical rise
    if ((dx > 5 || dy > 5) && dz < MIN_VENT_RISE_ABOVE_FLOOD_RIM) {
      violations.push({
        type: 'horizontal-before-rise',
        message: 'Vent runs horizontal before rising above flood rim level',
        severity: 'critical',
        codeReference: 'IPC 905.2',
      });
    }
    
    // Check if vent rises above flood rim
    const maxZ = Math.max(...route.segments.map(s => 
      Math.max(s.startPoint.z, s.endPoint.z)
    ));
    
    if (maxZ < requirements.floodRimLevel + MIN_VENT_RISE_ABOVE_FLOOD_RIM) {
      violations.push({
        type: 'below-flood-rim',
        message: `Vent does not rise ${MIN_VENT_RISE_ABOVE_FLOOD_RIM}" above flood rim (${requirements.floodRimLevel}")`,
        severity: 'critical',
        codeReference: 'IPC 905.1',
      });
    }
  }
  
  return violations;
}

/**
 * Check for S-trap configuration (vertical drop after trap)
 */
export function detectSTrap(drainRoute: MEPRoute): VentViolation | null {
  if (drainRoute.systemType !== 'drainage') return null;
  
  // S-trap = vertical drop immediately after fixture (no horizontal trap arm)
  if (drainRoute.segments.length > 0) {
    const firstSeg = drainRoute.segments[0];
    const dx = Math.abs(firstSeg.endPoint.x - firstSeg.startPoint.x);
    const dy = Math.abs(firstSeg.endPoint.y - firstSeg.startPoint.y);
    const dz = firstSeg.startPoint.z - firstSeg.endPoint.z;
    
    // Pure vertical drop without horizontal trap arm
    if (dx < 5 && dy < 5 && dz > 6) {
      return {
        type: 's-trap-detected',
        message: 'S-trap configuration detected - will cause trap siphoning',
        severity: 'critical',
        codeReference: 'IPC 1002.1',
      };
    }
  }
  
  return null;
}

/**
 * Validate trap arm length
 */
export function validateTrapArmLength(
  fixture: MEPFixture,
  drainRoute: MEPRoute,
  ventRoute: MEPRoute | null
): VentViolation | null {
  const requirements = getVentRequirements(fixture);
  
  if (!ventRoute || drainRoute.segments.length === 0) {
    return null;
  }
  
  // Measure horizontal distance from trap to vent connection
  const trapPoint = drainRoute.segments[0].startPoint;
  const ventConnection = ventRoute.segments[0].startPoint;
  
  const dx = ventConnection.x - trapPoint.x;
  const dy = ventConnection.y - trapPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const distanceFeet = distance / 12;
  
  if (distanceFeet > requirements.maxTrapArmLength) {
    return {
      type: 'trap-arm-too-long',
      message: `Trap arm too long: ${distanceFeet.toFixed(1)} ft (max: ${requirements.maxTrapArmLength} ft)`,
      severity: 'error',
      codeReference: 'IPC Table 906.1',
    };
  }
  
  return null;
}

// =============================================================================
// WET VENTING
// =============================================================================

export interface WetVentCheck {
  isAllowed: boolean;
  maxDFU: number;
  currentDFU: number;
  message: string;
}

/**
 * Check if wet venting is allowed for a fixture group
 */
export function checkWetVentEligibility(
  fixtures: MEPFixture[],
  sharedVentPipeSize: number
): WetVentCheck {
  // Wet vent sizing per IPC Table 909.2
  const maxDFUBySize: Record<number, number> = {
    1.5: 1,
    2: 4,
    2.5: 6,
    3: 12,
    4: 32,
  };
  
  const maxDFU = maxDFUBySize[sharedVentPipeSize] ?? 0;
  const currentDFU = fixtures.reduce((sum, f) => sum + f.dfu, 0);
  
  return {
    isAllowed: currentDFU <= maxDFU,
    maxDFU,
    currentDFU,
    message: currentDFU <= maxDFU
      ? `Wet vent OK: ${currentDFU} DFU (max: ${maxDFU})`
      : `Wet vent overloaded: ${currentDFU} DFU (max: ${maxDFU})`,
  };
}
