// Collision Detection and Clearance Checking - Center-based coordinates

import type { Fixture, Wall, Point } from '@/types/floorPlan';

// Center-based bounding box for rotated rectangle collision
interface CenterBoundingBox {
  cx: number;       // Center X
  cy: number;       // Center Y
  width: number;
  height: number;
  rotation: number; // Degrees
}

// Get rotated bounding box corners from center-based box
function getRotatedCorners(box: CenterBoundingBox): { x: number; y: number }[] {
  const angle = (box.rotation * Math.PI) / 180;
  const hw = box.width / 2;
  const hh = box.height / 2;
  
  // Corners relative to center
  const corners = [
    { x: -hw, y: -hh },
    { x:  hw, y: -hh },
    { x:  hw, y:  hh },
    { x: -hw, y:  hh }
  ];
  
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  return corners.map(c => ({
    x: box.cx + c.x * cos - c.y * sin,
    y: box.cy + c.x * sin + c.y * cos
  }));
}

// Separating Axis Theorem for rotated rectangles
function projectPolygon(vertices: { x: number; y: number }[], axis: { x: number; y: number }): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  
  for (const vertex of vertices) {
    const projection = vertex.x * axis.x + vertex.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  
  return { min, max };
}

function getAxes(corners: { x: number; y: number }[]): { x: number; y: number }[] {
  const axes: { x: number; y: number }[] = [];
  
  for (let i = 0; i < corners.length; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % corners.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const length = Math.sqrt(edge.x * edge.x + edge.y * edge.y);
    if (length > 0) {
      axes.push({ x: -edge.y / length, y: edge.x / length }); // Perpendicular
    }
  }
  
  return axes;
}

export function checkBoxCollision(box1: CenterBoundingBox, box2: CenterBoundingBox): boolean {
  const corners1 = getRotatedCorners(box1);
  const corners2 = getRotatedCorners(box2);
  const axes = [...getAxes(corners1), ...getAxes(corners2)];
  
  for (const axis of axes) {
    const proj1 = projectPolygon(corners1, axis);
    const proj2 = projectPolygon(corners2, axis);
    
    if (proj1.max < proj2.min || proj2.max < proj1.min) {
      return false; // Separating axis found, no collision
    }
  }
  
  return true; // No separating axis, collision detected
}

// Convert fixture to center-based bounding box
function fixtureToBox(fixture: Fixture): CenterBoundingBox {
  return {
    cx: fixture.cx,
    cy: fixture.cy,
    width: fixture.width,
    height: fixture.depth,
    rotation: fixture.rotation
  };
}

export function checkFixtureCollisions(
  fixture: Fixture,
  allFixtures: Fixture[],
  excludeId?: string
): Fixture[] {
  const collisions: Fixture[] = [];
  const box1 = fixtureToBox(fixture);
  
  for (const other of allFixtures) {
    if (other.id === fixture.id || other.id === excludeId) continue;
    
    const box2 = fixtureToBox(other);
    
    if (checkBoxCollision(box1, box2)) {
      collisions.push(other);
    }
  }
  
  return collisions;
}

// Check if fixture overlaps with any wall
export function checkWallCollision(
  fixture: Fixture,
  walls: Wall[],
  points: Point[]
): boolean {
  const fixtureBox = fixtureToBox(fixture);
  
  for (const wall of walls) {
    const start = points.find(p => p.id === wall.startPointId);
    const end = points.find(p => p.id === wall.endPointId);
    if (!start || !end) continue;
    
    // Create wall bounding box (center-based)
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    
    const wallBox: CenterBoundingBox = {
      cx: (start.x + end.x) / 2,
      cy: (start.y + end.y) / 2,
      width: length,
      height: wall.thickness,
      rotation: (angle * 180) / Math.PI
    };
    
    if (checkBoxCollision(fixtureBox, wallBox)) {
      return true;
    }
  }
  
  return false;
}

// Define clearance requirements per fixture type
export const FIXTURE_CLEARANCES: Record<string, { front: number; sides: number; back: number }> = {
  toilet: { front: 60, sides: 15, back: 0 },
  bidet: { front: 50, sides: 15, back: 0 },
  sink: { front: 60, sides: 10, back: 0 },
  shower: { front: 70, sides: 0, back: 0 },
  bathtub: { front: 60, sides: 10, back: 0 },
  stove: { front: 90, sides: 5, back: 0 },
  refrigerator: { front: 90, sides: 5, back: 5 },
  dishwasher: { front: 90, sides: 0, back: 0 },
  'kitchen-sink': { front: 60, sides: 10, back: 0 },
  island: { front: 90, sides: 90, back: 90 },
  table: { front: 80, sides: 80, back: 80 },
  bed: { front: 60, sides: 50, back: 0 },
  sofa: { front: 80, sides: 30, back: 0 },
  wardrobe: { front: 90, sides: 0, back: 0 },
  cabinet: { front: 60, sides: 0, back: 0 },
  mirror: { front: 60, sides: 0, back: 0 },
  chair: { front: 40, sides: 20, back: 20 },
};

export function getClearanceZone(fixture: Fixture): CenterBoundingBox {
  const clearance = FIXTURE_CLEARANCES[fixture.type] || { front: 30, sides: 10, back: 0 };
  
  // Adjust center to account for asymmetric clearance (front vs back)
  const frontBackOffset = (clearance.front - clearance.back) / 2;
  
  // The clearance zone center is offset from fixture center in the "forward" direction
  const angle = (fixture.rotation * Math.PI) / 180;
  const offsetCx = fixture.cx + Math.sin(angle) * frontBackOffset;
  const offsetCy = fixture.cy + Math.cos(angle) * frontBackOffset;
  
  return {
    cx: offsetCx,
    cy: offsetCy,
    width: fixture.width + clearance.sides * 2,
    height: fixture.depth + clearance.front + clearance.back,
    rotation: fixture.rotation
  };
}

export function checkClearanceOverlap(
  fixture: Fixture,
  allFixtures: Fixture[],
  excludeId?: string
): Fixture[] {
  const overlaps: Fixture[] = [];
  const clearanceZone = getClearanceZone(fixture);
  
  for (const other of allFixtures) {
    if (other.id === fixture.id || other.id === excludeId) continue;
    
    const otherBox = fixtureToBox(other);
    
    if (checkBoxCollision(clearanceZone, otherBox)) {
      overlaps.push(other);
    }
  }
  
  return overlaps;
}
