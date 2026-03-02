/**
 * MEP Trap System - Phase 4
 * 
 * P-trap visualization, trap arm validation, and S-trap detection.
 */

import { v4 as uuidv4 } from 'uuid';
import type { MEPFixture, MEPRoute, Point3D } from '@/types/mep';
import { getTrapRequirements } from '@/data/plumbingCodes';

// =============================================================================
// TYPES
// =============================================================================

export type TrapType = 'p-trap' | 's-trap' | 'drum-trap' | 'integral';

export interface TrapInfo {
  id: string;
  fixtureId: string;
  type: TrapType;
  size: number;                  // inches
  position: Point3D;
  armLength: number;             // feet - distance to vent
  maxArmLength: number;          // code limit
  sealDepth: number;             // inches (standard: 2-4")
  isViolation: boolean;
  violationType?: 'oversized-arm' | 's-trap-config' | 'insufficient-seal';
  message: string;
}

export interface TrapArmInfo {
  startPoint: Point3D;           // At trap weir
  endPoint: Point3D;             // At vent connection
  length: number;                // feet
  maxLength: number;             // code limit
  slope: number;                 // inches per foot
  isValid: boolean;
  violations: string[];
}

export interface TrapVisualization {
  trapPosition: Point3D;
  trapSize: number;
  armPath: Point3D[];
  type: TrapType;
  label: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STANDARD_SEAL_DEPTH = 2;   // 2" water seal minimum
const MAX_SEAL_DEPTH = 4;        // 4" maximum per code
const TRAP_ARM_SLOPE = 0.25;     // 1/4" per foot for trap arms

// Trap sizes by fixture type (inches)
const TRAP_SIZES: Record<string, number> = {
  'toilet': 3,         // Integral trap
  'sink': 1.25,
  'kitchen-sink': 1.5,
  'shower': 2,
  'bathtub': 1.5,
  'bidet': 1.25,
  'floor-drain': 2,
  'washing-machine': 2,
  'utility-sink': 1.5,
  'dishwasher': 1.5,
  'garbage-disposal': 1.5,
  'hose-bib': 0,       // No trap needed
};

// =============================================================================
// TRAP CREATION
// =============================================================================

/**
 * Create trap info for a fixture
 */
export function createTrapInfo(
  fixture: MEPFixture,
  drainRoute: MEPRoute | null,
  ventRoute: MEPRoute | null
): TrapInfo {
  const trapReq = getTrapRequirements(fixture.type);
  const trapSize = TRAP_SIZES[fixture.type] ?? 1.5;
  
  // Calculate trap arm length (distance from trap to vent)
  let armLength = 0;
  const drainSegments = drainRoute?.segments ?? [];
  if (drainSegments.length > 0) {
    // Measure horizontal distance of first segment(s) until vent connection
    for (const segment of drainSegments) {
      const dx = segment.endPoint.x - segment.startPoint.x;
      const dy = segment.endPoint.y - segment.startPoint.y;
      armLength += Math.sqrt(dx * dx + dy * dy) / 12; // Convert to feet
      
      // Stop at vent connection point if applicable
      if (ventRoute && segment.fittingAtEnd === 'sanitary-tee') {
        break;
      }
    }
  }
  
  const maxArmLength = trapReq?.maxTrapArmLength ?? 6;
  const isOverLength = armLength > maxArmLength;
  
  // Determine trap type
  let trapType: TrapType = 'p-trap';
  if (fixture.type === 'toilet') {
    trapType = 'integral';
  }
  
  // Check for S-trap configuration
  // S-trap = outlet drops directly vertical without horizontal trap arm to vent
  let isSTrap = false;
  if (drainSegments.length > 0) {
    // Check if there's a horizontal trap arm before any vertical drop
    const hasHorizontalTrapArm = drainSegments.some(seg => {
      const segDx = Math.abs(seg.endPoint.x - seg.startPoint.x);
      const segDy = Math.abs(seg.endPoint.y - seg.startPoint.y);
      // Need at least 12" horizontal run to count as trap arm
      return (segDx > 12 || segDy > 12);
    });
    
    // Check if a vent connects within acceptable distance
    const ventSegments = ventRoute?.segments ?? [];
    const hasVentConnection = ventSegments.length > 0;
    
    // Only flag as S-trap if:
    // 1. No horizontal trap arm exists, AND
    // 2. No vent connection exists
    // This prevents false positives when proper P-trap with vent is installed
    if (!hasHorizontalTrapArm && !hasVentConnection) {
      // Check if there's a significant vertical drop
      const firstSeg = drainSegments[0];
      const dz = firstSeg.startPoint.z - firstSeg.endPoint.z;
      if (dz > 12) {  // More than 12" drop without horizontal run = S-trap
        isSTrap = true;
        trapType = 's-trap';
      }
    }
  }
  
  // Get trap position
  const trapPosition: Point3D = drainSegments.length > 0
    ? { ...drainSegments[0].startPoint }
    : { x: fixture.position.x, y: fixture.position.y, z: 18 };
  
  // Determine violation
  let isViolation = false;
  let violationType: TrapInfo['violationType'];
  let message = '';
  
  if (isSTrap) {
    isViolation = true;
    violationType = 's-trap-config';
    message = 'S-trap configuration detected - causes trap siphoning';
  } else if (isOverLength) {
    isViolation = true;
    violationType = 'oversized-arm';
    message = `Trap arm too long: ${armLength.toFixed(1)} ft (max: ${maxArmLength} ft)`;
  } else {
    message = `P-trap ${trapSize}" with ${armLength.toFixed(1)} ft arm`;
  }
  
  return {
    id: uuidv4(),
    fixtureId: fixture.id,
    type: trapType,
    size: trapSize,
    position: trapPosition,
    armLength,
    maxArmLength,
    sealDepth: STANDARD_SEAL_DEPTH,
    isViolation,
    violationType,
    message,
  };
}

/**
 * Calculate trap arm details
 */
export function calculateTrapArm(
  fixture: MEPFixture,
  drainRoute: MEPRoute,
  ventConnectionPoint?: Point3D
): TrapArmInfo {
  const trapReq = getTrapRequirements(fixture.type);
  const maxLength = trapReq?.maxTrapArmLength ?? 6;
  const violations: string[] = [];
  
  // Start at fixture trap
  const startPoint: Point3D = drainRoute.segments.length > 0
    ? { ...drainRoute.segments[0].startPoint }
    : { x: fixture.position.x, y: fixture.position.y, z: 18 };
  
  // End at vent connection or first vertical drop
  let endPoint: Point3D = startPoint;
  let armLength = 0;
  let totalSlope = 0;
  
  for (const segment of drainRoute.segments) {
    const dx = segment.endPoint.x - segment.startPoint.x;
    const dy = segment.endPoint.y - segment.startPoint.y;
    const dz = segment.endPoint.z - segment.startPoint.z;
    const horizontalDist = Math.sqrt(dx * dx + dy * dy);
    
    // Stop if we hit a significant vertical drop (entering stack)
    if (dz < -12) {
      endPoint = { ...segment.startPoint };
      break;
    }
    
    armLength += horizontalDist / 12; // Convert to feet
    totalSlope = dz;
    endPoint = { ...segment.endPoint };
    
    // Stop at vent connection
    if (segment.fittingAtEnd === 'sanitary-tee' || segment.fittingAtEnd === 'wye') {
      break;
    }
  }
  
  // Validate arm length
  if (armLength > maxLength) {
    violations.push(`Trap arm exceeds maximum length: ${armLength.toFixed(1)} ft (max: ${maxLength} ft)`);
  }
  
  // Calculate slope
  const slopePerFoot = armLength > 0 ? Math.abs(totalSlope / (armLength * 12)) * 12 : 0;
  
  // Validate slope (should be 1/4" per foot)
  if (slopePerFoot < 0.2) {
    violations.push(`Trap arm slope too shallow: ${(slopePerFoot).toFixed(3)}"/ft (min: 1/4"/ft)`);
  }
  if (slopePerFoot > 0.5) {
    violations.push(`Trap arm slope too steep: ${(slopePerFoot).toFixed(3)}"/ft (risk of siphoning)`);
  }
  
  return {
    startPoint,
    endPoint,
    length: armLength,
    maxLength,
    slope: slopePerFoot,
    isValid: violations.length === 0,
    violations,
  };
}

// =============================================================================
// TRAP VISUALIZATION
// =============================================================================

/**
 * Get trap visualization data for 2D canvas
 */
export function getTrapVisualization(trapInfo: TrapInfo, fixture: MEPFixture): TrapVisualization {
  const armPath: Point3D[] = [];
  
  // P-trap shape points
  const trapPos = trapInfo.position;
  const size = trapInfo.size;
  
  // Trap inlet (from fixture)
  armPath.push({
    x: trapPos.x,
    y: trapPos.y - size * 4,
    z: trapPos.z,
  });
  
  // Trap curve down
  armPath.push({
    x: trapPos.x,
    y: trapPos.y,
    z: trapPos.z - size * 2,
  });
  
  // Trap bottom (water seal)
  armPath.push({
    x: trapPos.x,
    y: trapPos.y + size * 2,
    z: trapPos.z - size * 2,
  });
  
  // Trap curve up (weir)
  armPath.push({
    x: trapPos.x,
    y: trapPos.y + size * 4,
    z: trapPos.z,
  });
  
  // Trap arm (horizontal run to vent)
  armPath.push({
    x: trapPos.x,
    y: trapPos.y + size * 4 + trapInfo.armLength * 12,
    z: trapPos.z - trapInfo.armLength * TRAP_ARM_SLOPE,
  });
  
  return {
    trapPosition: trapPos,
    trapSize: size,
    armPath,
    type: trapInfo.type,
    label: trapInfo.isViolation ? `⚠ ${trapInfo.type.toUpperCase()}` : `${size}"`,
  };
}

/**
 * Draw P-trap symbol on 2D canvas
 */
export function drawTrapSymbol(
  ctx: CanvasRenderingContext2D,
  trapInfo: TrapInfo,
  scale: number,
  showViolation: boolean = true
): void {
  const { position, size, type, isViolation } = trapInfo;
  
  ctx.save();
  ctx.translate(position.x, position.y);
  
  const trapWidth = size * 8;
  const trapHeight = size * 4;
  
  // Trap body
  ctx.strokeStyle = isViolation ? '#EF4444' : '#22C55E';
  ctx.lineWidth = 2 / scale;
  ctx.fillStyle = isViolation ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
  
  // P-trap shape (U-curve)
  ctx.beginPath();
  ctx.moveTo(-trapWidth / 2, -trapHeight);
  ctx.lineTo(-trapWidth / 2, 0);
  ctx.bezierCurveTo(
    -trapWidth / 2, trapHeight,
    trapWidth / 2, trapHeight,
    trapWidth / 2, 0
  );
  ctx.lineTo(trapWidth / 2, -trapHeight / 2);
  ctx.stroke();
  
  // Water seal indicator
  ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
  ctx.beginPath();
  ctx.ellipse(0, trapHeight / 2, trapWidth / 3, trapHeight / 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Label
  if (showViolation && isViolation) {
    ctx.fillStyle = '#EF4444';
    ctx.font = `bold ${10 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚠ ' + type.toUpperCase(), 0, trapHeight + 12 / scale);
  } else {
    ctx.fillStyle = '#22C55E';
    ctx.font = `${8 / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${size}"`, 0, trapHeight + 10 / scale);
  }
  
  ctx.restore();
}

// =============================================================================
// S-TRAP DETECTION
// =============================================================================

/**
 * Detect S-trap configurations in all fixtures
 */
export function detectSTraps(
  fixtures: MEPFixture[],
  routes: MEPRoute[]
): Array<{ fixtureId: string; fixtureName: string; message: string }> {
  const sTraps: Array<{ fixtureId: string; fixtureName: string; message: string }> = [];
  
  for (const fixture of fixtures) {
    if (fixture.type === 'toilet' || fixture.type === 'hose-bib') continue;
    
    const drainRoute = routes.find(r => 
      r.destination.type === 'fixture' &&
      r.destination.id === fixture.id &&
      r.systemType === 'drainage'
    );
    
    const drainSegments = drainRoute?.segments ?? [];
    if (drainSegments.length === 0) continue;
    
    const trapInfo = createTrapInfo(fixture, drainRoute, null);
    
    if (trapInfo.type === 's-trap') {
      sTraps.push({
        fixtureId: fixture.id,
        fixtureName: fixture.name,
        message: 'S-trap configuration will cause trap siphoning and sewer gas entry',
      });
    }
  }
  
  return sTraps;
}
