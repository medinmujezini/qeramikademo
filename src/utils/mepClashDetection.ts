/**
 * MEP Clash Detection System
 * 
 * Detects collisions and clearance violations between MEP elements.
 * Provides detailed clash information for resolution.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  MEPFixture,
  MEPRoute,
  MEPNode,
  MEPClash,
  MEPSystemType,
  Point3D,
} from '@/types/mep';
import { MIN_CLEARANCES } from '@/types/mep';

// =============================================================================
// TYPES
// =============================================================================

export interface ClashCheckResult {
  clashes: MEPClash[];
  summary: {
    totalClashes: number;
    hardClashes: number;
    softClashes: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
}

interface BoundingBox {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

// =============================================================================
// BOUNDING BOX HELPERS
// =============================================================================

function getFixtureBoundingBox(fixture: MEPFixture): BoundingBox {
  const hw = fixture.dimensions.width / 2;
  const hd = fixture.dimensions.depth / 2;
  
  return {
    minX: fixture.position.x - hw,
    minY: fixture.position.y - hd,
    minZ: 0,
    maxX: fixture.position.x + hw,
    maxY: fixture.position.y + hd,
    maxZ: fixture.dimensions.height,
  };
}

function getRouteBoundingBox(route: MEPRoute): BoundingBox {
  if (route.segments.length === 0) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  }
  
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (const segment of route.segments) {
    minX = Math.min(minX, segment.startPoint.x, segment.endPoint.x);
    minY = Math.min(minY, segment.startPoint.y, segment.endPoint.y);
    minZ = Math.min(minZ, segment.startPoint.z, segment.endPoint.z);
    maxX = Math.max(maxX, segment.startPoint.x, segment.endPoint.x);
    maxY = Math.max(maxY, segment.startPoint.y, segment.endPoint.y);
    maxZ = Math.max(maxZ, segment.startPoint.z, segment.endPoint.z);
  }
  
  // Expand by pipe size
  const radius = (route.requiredSize || 2) / 2;
  return {
    minX: minX - radius,
    minY: minY - radius,
    minZ: minZ - radius,
    maxX: maxX + radius,
    maxY: maxY + radius,
    maxZ: maxZ + radius,
  };
}

function boxesIntersect(a: BoundingBox, b: BoundingBox, clearance: number = 0): boolean {
  return !(
    a.maxX + clearance < b.minX - clearance ||
    a.minX - clearance > b.maxX + clearance ||
    a.maxY + clearance < b.minY - clearance ||
    a.minY - clearance > b.maxY + clearance ||
    a.maxZ + clearance < b.minZ - clearance ||
    a.minZ - clearance > b.maxZ + clearance
  );
}

function getBoxCenter(box: BoundingBox): Point3D {
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    z: (box.minZ + box.maxZ) / 2,
  };
}

// =============================================================================
// SEGMENT INTERSECTION
// =============================================================================

function segmentsIntersect2D(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { intersects: boolean; point?: { x: number; y: number } } {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  
  const cross = d1x * d2y - d1y * d2x;
  
  if (Math.abs(cross) < 0.0001) {
    return { intersects: false };
  }
  
  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;
  
  const t = (dx * d2y - dy * d2x) / cross;
  const u = (dx * d1y - dy * d1x) / cross;
  
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      intersects: true,
      point: {
        x: p1.x + t * d1x,
        y: p1.y + t * d1y,
      },
    };
  }
  
  return { intersects: false };
}

function segmentToPointDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// =============================================================================
// CLASH DETECTION
// =============================================================================

/**
 * Check for clashes between all MEP elements
 */
export function detectClashes(
  fixtures: MEPFixture[],
  routes: MEPRoute[],
  nodes: MEPNode[]
): ClashCheckResult {
  const clashes: MEPClash[] = [];
  
  // 1. Check fixture-to-fixture collisions (clearance violations)
  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      const f1 = fixtures[i];
      const f2 = fixtures[j];
      
      const box1 = getFixtureBoundingBox(f1);
      const box2 = getFixtureBoundingBox(f2);
      
      // Check with clearance
      const clearance = Math.max(f1.clearance.sides, f2.clearance.sides);
      
      if (boxesIntersect(box1, box2, 0)) {
        // Hard clash - physical overlap
        clashes.push({
          id: uuidv4(),
          type: 'hard',
          element1: { type: 'fixture', id: f1.id, systemType: 'drainage' },
          element2: { type: 'fixture', id: f2.id, systemType: 'drainage' },
          position: getBoxCenter(box1),
          severity: 'critical',
          resolution: `Move ${f1.name} or ${f2.name} to eliminate overlap`,
          canAutoResolve: false,
        });
      } else if (boxesIntersect(box1, box2, clearance)) {
        // Soft clash - clearance violation
        clashes.push({
          id: uuidv4(),
          type: 'soft',
          element1: { type: 'fixture', id: f1.id, systemType: 'drainage' },
          element2: { type: 'fixture', id: f2.id, systemType: 'drainage' },
          position: getBoxCenter(box1),
          severity: 'warning',
          resolution: `Increase spacing between ${f1.name} and ${f2.name} to meet clearance requirements`,
          canAutoResolve: false,
        });
      }
    }
  }
  
  // 2. Check route-to-route clashes
  // Track clashes per route pair to avoid duplicates
  const routePairClashes = new Set<string>();
  
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const r1 = routes[i];
      const r2 = routes[j];
      
      // Skip if routes go to the same fixture (they naturally converge)
      if (r1.destination.type === 'fixture' && r2.destination.type === 'fixture' &&
          r1.destination.id === r2.destination.id) {
        continue;
      }
      
      // Skip if routes share same source node (intentional branching)
      if (r1.source.nodeId === r2.source.nodeId) {
        continue;
      }
      
      // Skip same system type routes that might be parallel runs
      if (r1.systemType === r2.systemType) {
        continue;
      }
      
      const pairKey = [r1.id, r2.id].sort().join('-');
      if (routePairClashes.has(pairKey)) continue;
      
      // Different system types need different clearances
      const minClear = Math.max(
        MIN_CLEARANCES[r1.systemType] || 5,
        MIN_CLEARANCES[r2.systemType] || 5
      );
      
      // Only check a sample of segments for efficiency (first, last, and midpoint)
      const seg1Sample = r1.segments.length > 3 
        ? [r1.segments[0], r1.segments[Math.floor(r1.segments.length / 2)], r1.segments[r1.segments.length - 1]]
        : r1.segments;
      const seg2Sample = r2.segments.length > 3
        ? [r2.segments[0], r2.segments[Math.floor(r2.segments.length / 2)], r2.segments[r2.segments.length - 1]]
        : r2.segments;
      
      for (const seg1 of seg1Sample) {
        for (const seg2 of seg2Sample) {
          const intersection = segmentsIntersect2D(
            seg1.startPoint, seg1.endPoint,
            seg2.startPoint, seg2.endPoint
          );
          
          if (intersection.intersects && intersection.point) {
            // Check Z-levels - if they're at different heights, it's OK (planned crossing)
            const z1 = (seg1.startPoint.z + seg1.endPoint.z) / 2;
            const z2 = (seg2.startPoint.z + seg2.endPoint.z) / 2;
            const zDiff = Math.abs(z1 - z2);
            
            const pipeRadius1 = (r1.requiredSize || 2) / 2;
            const pipeRadius2 = (r2.requiredSize || 2) / 2;
            
            // More lenient crossing tolerance - 6" typical crossing gap
            const CROSSING_TOLERANCE = 6;
            const minSeparation = pipeRadius1 + pipeRadius2 + CROSSING_TOLERANCE;
            
            // Only flag if pipes are truly at same level (within 2")
            if (zDiff < minSeparation && zDiff < 2) {
              routePairClashes.add(pairKey);
              clashes.push({
                id: uuidv4(),
                type: 'hard',
                element1: { type: 'route', id: r1.id, systemType: r1.systemType },
                element2: { type: 'route', id: r2.id, systemType: r2.systemType },
                position: { 
                  x: intersection.point.x, 
                  y: intersection.point.y, 
                  z: (z1 + z2) / 2 
                },
                severity: 'critical',
                resolution: `Re-route ${r1.systemType} or ${r2.systemType} to avoid intersection`,
                canAutoResolve: true,
              });
              break; // Only report one clash per route pair
            }
          }
        }
        if (routePairClashes.has(pairKey)) break;
      }
    }
  }
  
  // 3. Check route-to-fixture clashes
  for (const route of routes) {
    for (const fixture of fixtures) {
      const fixtureBox = getFixtureBoundingBox(fixture);
      const routeBox = getRouteBoundingBox(route);
      
      if (boxesIntersect(fixtureBox, routeBox, 0)) {
        // Check if route actually passes through fixture
        for (const segment of route.segments) {
          const distToFixture = segmentToPointDistance(
            fixture.position.x, fixture.position.y,
            segment.startPoint.x, segment.startPoint.y,
            segment.endPoint.x, segment.endPoint.y
          );
          
          const fixtureRadius = Math.max(fixture.dimensions.width, fixture.dimensions.depth) / 2;
          
          // Skip if this is a route TO this fixture
          if (route.destination.type === 'fixture' && route.destination.id === fixture.id) {
            continue;
          }
          
          if (distToFixture < fixtureRadius) {
            clashes.push({
              id: uuidv4(),
              type: 'hard',
              element1: { type: 'route', id: route.id, systemType: route.systemType },
              element2: { type: 'fixture', id: fixture.id, systemType: 'drainage' },
              position: {
                x: fixture.position.x,
                y: fixture.position.y,
                z: fixture.dimensions.height / 2,
              },
              severity: 'critical',
              resolution: `Re-route ${route.systemType} around ${fixture.name}`,
              canAutoResolve: true,
            });
            break; // Only report one clash per route-fixture pair
          }
        }
      }
    }
  }
  
  // Calculate summary
  const summary = {
    totalClashes: clashes.length,
    hardClashes: clashes.filter(c => c.type === 'hard').length,
    softClashes: clashes.filter(c => c.type === 'soft').length,
    criticalCount: clashes.filter(c => c.severity === 'critical').length,
    warningCount: clashes.filter(c => c.severity === 'warning').length,
    infoCount: clashes.filter(c => c.severity === 'info').length,
  };
  
  return { clashes, summary };
}

/**
 * Check clearance zones for a single fixture
 */
export function checkFixtureClearance(
  fixture: MEPFixture,
  allFixtures: MEPFixture[],
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Calculate fixture bounding box with clearances
  const hw = fixture.dimensions.width / 2;
  const hd = fixture.dimensions.depth / 2;
  
  const clearanceBox = {
    minX: fixture.position.x - hw - fixture.clearance.sides,
    maxX: fixture.position.x + hw + fixture.clearance.sides,
    minY: fixture.position.y - hd - fixture.clearance.rear,
    maxY: fixture.position.y + hd + fixture.clearance.front,
  };
  
  // Check against other fixtures
  for (const other of allFixtures) {
    if (other.id === fixture.id) continue;
    
    const otherHw = other.dimensions.width / 2;
    const otherHd = other.dimensions.depth / 2;
    
    const otherBox = {
      minX: other.position.x - otherHw,
      maxX: other.position.x + otherHw,
      minY: other.position.y - otherHd,
      maxY: other.position.y + otherHd,
    };
    
    // Check if clearance zone intersects other fixture
    if (
      clearanceBox.maxX > otherBox.minX &&
      clearanceBox.minX < otherBox.maxX &&
      clearanceBox.maxY > otherBox.minY &&
      clearanceBox.minY < otherBox.maxY
    ) {
      violations.push(`Clearance violation with ${other.name}`);
    }
  }
  
  // Check against walls - front clearance especially important
  for (const wall of walls) {
    const distToWall = segmentToPointDistance(
      fixture.position.x, fixture.position.y,
      wall.x1, wall.y1, wall.x2, wall.y2
    );
    
    // Simple check - if any wall is within clearance zone
    if (distToWall < fixture.clearance.front && distToWall > fixture.dimensions.depth / 2 + 10) {
      violations.push(`Front clearance blocked by wall`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Get visual representation of clashes for canvas rendering
 */
export function getClashMarkers(clashes: MEPClash[]): Array<{
  x: number;
  y: number;
  radius: number;
  color: string;
  type: 'hard' | 'soft';
}> {
  return clashes.map(clash => ({
    x: clash.position.x,
    y: clash.position.y,
    radius: clash.type === 'hard' ? 15 : 10,
    color: clash.severity === 'critical' ? '#EF4444' : 
           clash.severity === 'warning' ? '#F59E0B' : '#3B82F6',
    type: clash.type,
  }));
}
