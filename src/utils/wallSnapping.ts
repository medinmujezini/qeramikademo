import type { Fixture, Wall, Point, FixtureType, FixtureAnchorMode } from '@/types/floorPlan';

// Per-fixture snap configuration
export interface FixtureSnapConfig {
  snapDistance: number;       // Distance to trigger snap (cm)
  requiresWall: boolean;      // Must be against wall
  anchorMode: FixtureAnchorMode;
  defaultOffset: number;      // Gap from wall face (cm)
  wallMountSide: 'back' | 'any';  // Which side touches wall
}

export const FIXTURE_SNAP_CONFIG: Record<FixtureType, FixtureSnapConfig> = {
  // Bathroom (wall-mounted)
  toilet:     { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  bidet:      { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  sink:       { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 2, wallMountSide: 'back' },
  shower:     { snapDistance: 20, requiresWall: true, anchorMode: 'corner', defaultOffset: 0, wallMountSide: 'back' },
  bathtub:    { snapDistance: 20, requiresWall: true, anchorMode: 'corner', defaultOffset: 0, wallMountSide: 'any' },
  mirror:     { snapDistance: 10, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  cabinet:    { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  // Kitchen
  stove:      { snapDistance: 15, requiresWall: false, anchorMode: 'single-wall', defaultOffset: 5, wallMountSide: 'back' },
  refrigerator: { snapDistance: 15, requiresWall: false, anchorMode: 'single-wall', defaultOffset: 5, wallMountSide: 'back' },
  dishwasher: { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  'kitchen-sink': { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  island:     { snapDistance: 30, requiresWall: false, anchorMode: 'free', defaultOffset: 0, wallMountSide: 'any' },
  // General (free-standing)
  table:      { snapDistance: 30, requiresWall: false, anchorMode: 'free', defaultOffset: 0, wallMountSide: 'any' },
  chair:      { snapDistance: 30, requiresWall: false, anchorMode: 'free', defaultOffset: 0, wallMountSide: 'any' },
  sofa:       { snapDistance: 20, requiresWall: false, anchorMode: 'single-wall', defaultOffset: 5, wallMountSide: 'back' },
  bed:        { snapDistance: 20, requiresWall: false, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
  wardrobe:   { snapDistance: 15, requiresWall: true, anchorMode: 'single-wall', defaultOffset: 0, wallMountSide: 'back' },
};

export interface WallFace {
  wallId: string;
  // Two parallel lines representing wall faces
  faceA: { start: Point; end: Point };  // One side
  faceB: { start: Point; end: Point };  // Other side
  normalA: { x: number; y: number };     // Outward normal for faceA
  normalB: { x: number; y: number };     // Outward normal for faceB
  length: number;
  wallAngle: number;  // Angle of wall in radians
}

export interface SnapResult {
  shouldSnap: boolean;
  ghostCx: number;
  ghostCy: number;
  ghostRotation: number;
  anchorWallId: string | null;
  secondaryWallId?: string;
  wallOffset: number;
  distanceToWall: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  isOnSegment: boolean;
  t: number;  // Parameter along segment (0-1)
}

// Normalize angle to 0-360 range
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

// Project a point onto a line segment
export function projectPointOntoLine(
  px: number, py: number,
  lineStart: Point, lineEnd: Point
): ProjectedPoint {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    return { x: lineStart.x, y: lineStart.y, isOnSegment: true, t: 0 };
  }
  
  const t = Math.max(0, Math.min(1, 
    ((px - lineStart.x) * dx + (py - lineStart.y) * dy) / lengthSq
  ));
  
  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy,
    isOnSegment: t >= 0 && t <= 1,
    t
  };
}

// Compute wall faces (parallel lines offset by wall thickness)
export function getWallFaces(wall: Wall, points: Point[]): WallFace | null {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return null;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;
  
  // Normal perpendicular to wall (normalized)
  const normalX = -dy / length;
  const normalY = dx / length;
  
  const halfThick = wall.thickness / 2;
  const wallAngle = Math.atan2(dy, dx);
  
  return {
    wallId: wall.id,
    faceA: {
      start: { id: '', x: start.x + normalX * halfThick, y: start.y + normalY * halfThick },
      end: { id: '', x: end.x + normalX * halfThick, y: end.y + normalY * halfThick }
    },
    faceB: {
      start: { id: '', x: start.x - normalX * halfThick, y: start.y - normalY * halfThick },
      end: { id: '', x: end.x - normalX * halfThick, y: end.y - normalY * halfThick }
    },
    normalA: { x: normalX, y: normalY },
    normalB: { x: -normalX, y: -normalY },
    length,
    wallAngle
  };
}

// Calculate snap preview for a fixture
export function calculateSnapPreview(
  cx: number,
  cy: number,
  currentRotation: number,
  fixtureType: FixtureType,
  fixtureWidth: number,
  fixtureDepth: number,
  walls: Wall[],
  points: Point[],
  shiftHeld: boolean = false
): SnapResult {
  const noSnap: SnapResult = {
    shouldSnap: false,
    ghostCx: cx,
    ghostCy: cy,
    ghostRotation: currentRotation,
    anchorWallId: null,
    wallOffset: 0,
    distanceToWall: Infinity
  };
  
  if (shiftHeld) return noSnap;
  
  const config = FIXTURE_SNAP_CONFIG[fixtureType];
  if (!config || config.anchorMode === 'free') return noSnap;
  
  let bestSnap: SnapResult | null = null;
  let bestDistance = Infinity;
  
  for (const wall of walls) {
    const faces = getWallFaces(wall, points);
    if (!faces) continue;
    
    // Check both faces, pick the one fixture is closer to
    const facesToCheck = [
      { face: faces.faceA, normal: faces.normalA },
      { face: faces.faceB, normal: faces.normalB }
    ];
    
    for (const { face, normal } of facesToCheck) {
      const projected = projectPointOntoLine(cx, cy, face.start, face.end);
      if (!projected.isOnSegment) continue;
      
      const distance = Math.sqrt((cx - projected.x) ** 2 + (cy - projected.y) ** 2);
      
      if (distance < config.snapDistance && distance < bestDistance) {
        // Calculate snapped position against wall face
        const offset = config.defaultOffset + fixtureDepth / 2;
        
        const snappedCx = projected.x + normal.x * offset;
        const snappedCy = projected.y + normal.y * offset;
        
        // Calculate rotation to face outward from wall (fixture back against wall)
        // Wall angle + 90 degrees so fixture faces away from wall
        let snappedRotation = (faces.wallAngle * 180 / Math.PI);
        // Determine which side we're on to add correct rotation offset
        if (normal.x === faces.normalA.x && normal.y === faces.normalA.y) {
          snappedRotation += 90;
        } else {
          snappedRotation -= 90;
        }
        
        bestSnap = {
          shouldSnap: true,
          ghostCx: snappedCx,
          ghostCy: snappedCy,
          ghostRotation: normalizeAngle(snappedRotation),
          anchorWallId: wall.id,
          wallOffset: config.defaultOffset,
          distanceToWall: distance
        };
        bestDistance = distance;
      }
    }
  }
  
  return bestSnap || noSnap;
}

// Find wall corners (where two walls meet)
interface WallCorner {
  x: number;
  y: number;
  wall1Id: string;
  wall2Id: string;
  wall1Angle: number;
  wall2Angle: number;
  pointId: string;
}

export function findWallCorners(walls: Wall[], points: Point[]): WallCorner[] {
  const corners: WallCorner[] = [];
  
  // Find points that have exactly 2 walls connected
  for (const point of points) {
    const connectedWalls = walls.filter(
      w => w.startPointId === point.id || w.endPointId === point.id
    );
    
    if (connectedWalls.length === 2) {
      const [wall1, wall2] = connectedWalls;
      
      // Get wall directions at this point
      const getWallAngle = (wall: Wall, atPointId: string): number => {
        const start = points.find(p => p.id === wall.startPointId);
        const end = points.find(p => p.id === wall.endPointId);
        if (!start || !end) return 0;
        
        // Direction pointing away from the corner point
        if (wall.startPointId === atPointId) {
          return Math.atan2(end.y - start.y, end.x - start.x);
        } else {
          return Math.atan2(start.y - end.y, start.x - end.x);
        }
      };
      
      corners.push({
        x: point.x,
        y: point.y,
        wall1Id: wall1.id,
        wall2Id: wall2.id,
        wall1Angle: getWallAngle(wall1, point.id),
        wall2Angle: getWallAngle(wall2, point.id),
        pointId: point.id
      });
    }
  }
  
  return corners;
}

// Calculate corner snap for fixtures that anchor to two walls
export function calculateCornerSnap(
  cx: number,
  cy: number,
  fixtureType: FixtureType,
  fixtureWidth: number,
  fixtureDepth: number,
  walls: Wall[],
  points: Point[]
): SnapResult | null {
  const config = FIXTURE_SNAP_CONFIG[fixtureType];
  if (!config || config.anchorMode !== 'corner') return null;
  
  const corners = findWallCorners(walls, points);
  const snapRadius = config.snapDistance * 1.5;  // Larger snap radius for corners
  
  for (const corner of corners) {
    const distance = Math.sqrt((cx - corner.x) ** 2 + (cy - corner.y) ** 2);
    
    if (distance < snapRadius) {
      // Calculate bisector angle of the corner (average of the two wall angles)
      const avgAngle = (corner.wall1Angle + corner.wall2Angle) / 2;
      
      // Rotation places the fixture facing into the room (opposite of bisector)
      const rotation = normalizeAngle((avgAngle * 180 / Math.PI) + 180);
      
      // Offset from corner point by half fixture dimensions
      const halfDiag = Math.sqrt((fixtureWidth / 2) ** 2 + (fixtureDepth / 2) ** 2);
      const offsetAngle = avgAngle + Math.PI;  // Point into the room
      
      const offsetCx = corner.x + Math.cos(offsetAngle) * halfDiag * 0.7;
      const offsetCy = corner.y + Math.sin(offsetAngle) * halfDiag * 0.7;
      
      return {
        shouldSnap: true,
        ghostCx: offsetCx,
        ghostCy: offsetCy,
        ghostRotation: rotation,
        anchorWallId: corner.wall1Id,
        secondaryWallId: corner.wall2Id,
        wallOffset: config.defaultOffset,
        distanceToWall: distance
      };
    }
  }
  
  return null;
}

// Get wall direction vector (normalized)
export function getWallDirection(wall: Wall, points: Point[]): { x: number; y: number } | null {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return null;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;
  
  return { x: dx / length, y: dy / length };
}

// Constrain movement to wall direction for anchored fixtures
export function constrainToWallLine(
  targetCx: number,
  targetCy: number,
  currentCx: number,
  currentCy: number,
  wallDir: { x: number; y: number },
  wall: Wall,
  points: Point[],
  fixtureDepth: number
): { cx: number; cy: number } {
  // Project desired movement onto wall direction
  const moveDx = targetCx - currentCx;
  const moveDy = targetCy - currentCy;
  const projectedMove = moveDx * wallDir.x + moveDy * wallDir.y;
  
  // Get wall bounds
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return { cx: currentCx, cy: currentCy };
  
  // Calculate new position along wall
  let newCx = currentCx + projectedMove * wallDir.x;
  let newCy = currentCy + projectedMove * wallDir.y;
  
  // Constrain to wall segment bounds (with some margin for fixture size)
  const margin = fixtureDepth / 2;
  const wallStartProject = start.x * wallDir.x + start.y * wallDir.y;
  const wallEndProject = end.x * wallDir.x + end.y * wallDir.y;
  const minProject = Math.min(wallStartProject, wallEndProject) + margin;
  const maxProject = Math.max(wallStartProject, wallEndProject) - margin;
  
  const newProject = newCx * wallDir.x + newCy * wallDir.y;
  const clampedProject = Math.max(minProject, Math.min(maxProject, newProject));
  
  // Adjust position if clamped
  if (clampedProject !== newProject) {
    const adjustment = clampedProject - newProject;
    newCx += adjustment * wallDir.x;
    newCy += adjustment * wallDir.y;
  }
  
  return { cx: newCx, cy: newCy };
}

// Get perpendicular distance from a point to a wall
export function getPerpendicularDistance(
  cx: number,
  cy: number,
  wall: Wall,
  points: Point[]
): number {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return Infinity;
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return Infinity;
  
  // Calculate perpendicular distance using cross product
  const perpDist = Math.abs((dy * cx - dx * cy + end.x * start.y - end.y * start.x)) / length;
  return perpDist;
}

// Get world position of a connection point (rotated with fixture)
export function getConnectionWorldPosition(
  fixture: Fixture,
  connection: { localX: number; localY: number }
): { x: number; y: number } {
  const rad = (fixture.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  // Rotate local position
  const rotatedX = connection.localX * cos - connection.localY * sin;
  const rotatedY = connection.localX * sin + connection.localY * cos;
  
  return {
    x: fixture.cx + rotatedX,
    y: fixture.cy + rotatedY
  };
}

// Check if a fixture type is wall-mounted
export function isWallMountedFixture(type: FixtureType): boolean {
  const config = FIXTURE_SNAP_CONFIG[type];
  return config?.requiresWall ?? false;
}
