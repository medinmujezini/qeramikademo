/**
 * MEP Node Wall Snapping
 * 
 * Provides wall snapping logic specifically for MEP infrastructure nodes.
 * Different node types have different snapping behaviors:
 * - Stacks (drain-stack, vent-stack): Snap to wall CENTERLINE (inside wall cavity)
 * - Water main/heater: Snap against walls or free placement
 * - Electrical panel: Snap flush to wall face (wall-mounted)
 */

import type { MEPNode, NodeType, Point3D } from '@/types/mep';
import type { Wall, Point } from '@/types/floorPlan';
import { projectPointOntoLine, getWallFaces } from './wallSnapping';

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface NodeSnapConfig {
  snapDistance: number;           // Distance to trigger snap (cm)
  snapMode: 'centerline' | 'face' | 'inside' | 'free';
  requiresWall: boolean;
  defaultZ: number;               // Default Z position (cm from floor)
}

// Full config for all NodeType values from mep.ts
export const NODE_SNAP_CONFIG: Partial<Record<NodeType, NodeSnapConfig>> = {
  // Water nodes - can be free or wall-adjacent
  'water-main': { snapDistance: 30, snapMode: 'face', requiresWall: false, defaultZ: 0 },
  'water-heater': { snapDistance: 30, snapMode: 'face', requiresWall: false, defaultZ: 0 },
  'water-manifold': { snapDistance: 25, snapMode: 'face', requiresWall: false, defaultZ: 120 },
  
  // Drainage stacks - run INSIDE wall cavities (centerline)
  'drain-stack': { snapDistance: 40, snapMode: 'centerline', requiresWall: true, defaultZ: 120 },
  'vent-stack': { snapDistance: 40, snapMode: 'centerline', requiresWall: true, defaultZ: 150 },
  'wet-vent-stack': { snapDistance: 40, snapMode: 'centerline', requiresWall: true, defaultZ: 120 },
  'stack-base': { snapDistance: 40, snapMode: 'centerline', requiresWall: true, defaultZ: 0 },
  'stack-through-roof': { snapDistance: 40, snapMode: 'centerline', requiresWall: true, defaultZ: 280 },
  'floor-cleanout': { snapDistance: 30, snapMode: 'inside', requiresWall: false, defaultZ: 0 },
  
  // Electrical - wall-mounted (face)
  'electrical-panel': { snapDistance: 30, snapMode: 'face', requiresWall: true, defaultZ: 120 },
  'junction-box': { snapDistance: 25, snapMode: 'face', requiresWall: true, defaultZ: 120 },
  'sub-panel': { snapDistance: 30, snapMode: 'face', requiresWall: true, defaultZ: 120 },
};

// Default config for any node type not explicitly listed
const DEFAULT_SNAP_CONFIG: NodeSnapConfig = {
  snapDistance: 30,
  snapMode: 'face',
  requiresWall: false,
  defaultZ: 0,
};

function getNodeSnapConfig(nodeType: NodeType): NodeSnapConfig {
  return NODE_SNAP_CONFIG[nodeType] || DEFAULT_SNAP_CONFIG;
}

// =============================================================================
// SNAP RESULT
// =============================================================================

export interface NodeSnapResult {
  shouldSnap: boolean;
  position: Point3D;
  anchorWallId: string | null;
  distanceToWall: number;
}

// =============================================================================
// SNAPPING FUNCTIONS
// =============================================================================

/**
 * Calculate snap preview for an MEP node being dragged
 */
export function calculateNodeSnap(
  worldX: number,
  worldY: number,
  nodeType: NodeType,
  walls: Wall[],
  points: Point[],
  currentZ: number = 0
): NodeSnapResult {
  const config = getNodeSnapConfig(nodeType);

  // Free placement mode - no snapping
  if (config.snapMode === 'free') {
    return {
      shouldSnap: false,
      position: { x: worldX, y: worldY, z: config.defaultZ || currentZ },
      anchorWallId: null,
      distanceToWall: Infinity,
    };
  }

  let bestSnap: NodeSnapResult | null = null;
  let bestDistance = Infinity;

  for (const wall of walls) {
    const faces = getWallFaces(wall, points);
    if (!faces) continue;

    // Get wall centerline (for stack snapping)
    const startPt = points.find(p => p.id === wall.startPointId);
    const endPt = points.find(p => p.id === wall.endPointId);
    if (!startPt || !endPt) continue;

    if (config.snapMode === 'centerline') {
      // Snap to wall CENTERLINE (inside the wall)
      const projected = projectPointOntoLine(worldX, worldY, startPt, endPt);
      if (!projected.isOnSegment) continue;

      const distance = Math.sqrt((worldX - projected.x) ** 2 + (worldY - projected.y) ** 2);

      if (distance < config.snapDistance && distance < bestDistance) {
        bestSnap = {
          shouldSnap: true,
          position: { 
            x: projected.x, 
            y: projected.y, 
            z: config.defaultZ || currentZ 
          },
          anchorWallId: wall.id,
          distanceToWall: distance,
        };
        bestDistance = distance;
      }
    } else if (config.snapMode === 'face' || config.snapMode === 'inside') {
      // Snap to wall FACE (against the wall surface)
      const facesToCheck = [
        { face: faces.faceA, normal: faces.normalA },
        { face: faces.faceB, normal: faces.normalB }
      ];

      for (const { face, normal } of facesToCheck) {
        const projected = projectPointOntoLine(worldX, worldY, face.start, face.end);
        if (!projected.isOnSegment) continue;

        const distance = Math.sqrt((worldX - projected.x) ** 2 + (worldY - projected.y) ** 2);

        if (distance < config.snapDistance && distance < bestDistance) {
          // For 'face' mode, position slightly away from wall
          // For 'inside' mode, position at the wall face
          const offset = config.snapMode === 'face' ? 5 : 0;
          
          bestSnap = {
            shouldSnap: true,
            position: { 
              x: projected.x + normal.x * offset, 
              y: projected.y + normal.y * offset, 
              z: config.defaultZ || currentZ 
            },
            anchorWallId: wall.id,
            distanceToWall: distance,
          };
          bestDistance = distance;
        }
      }
    }
  }

  // If snapping is required but no wall found, use world position
  if (!bestSnap) {
    return {
      shouldSnap: false,
      position: { x: worldX, y: worldY, z: config.defaultZ || currentZ },
      anchorWallId: null,
      distanceToWall: Infinity,
    };
  }

  return bestSnap;
}

/**
 * Check if a node type should snap to walls
 */
export function nodeRequiresWall(nodeType: NodeType): boolean {
  return getNodeSnapConfig(nodeType).requiresWall;
}

/**
 * Get the snap mode for a node type
 */
export function getNodeSnapMode(nodeType: NodeType): string {
  return getNodeSnapConfig(nodeType).snapMode;
}

/**
 * Hit test for clicking on a node
 */
export function hitTestNode(
  worldX: number,
  worldY: number,
  node: MEPNode,
  hitRadius: number = 15
): boolean {
  const dx = worldX - node.position.x;
  const dy = worldY - node.position.y;
  return (dx * dx + dy * dy) <= (hitRadius * hitRadius);
}
