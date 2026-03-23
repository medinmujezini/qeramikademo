/**
 * TiledWall3D - Renders a wall with animated 3D tile meshes
 * Supports all tile patterns: grid, staggered, herringbone, diagonal
 * Renders grout as a backing plane with properly spaced tiles on top
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Tile3D } from './Tile3D';
import type { Wall, Point, Tile, TilePattern, TileOrientation, Door, Window as WindowType } from '@/types/floorPlan';
import { CM_TO_METERS, MM_TO_CM } from '@/constants/units';
import { createOpeningZones, createWallShapeWithOpenings, type OpeningZone } from '@/utils/wallOpeningGeometry';

// Tile config passed from WallFinish
interface TileConfig {
  tileId: string;
  groutColor: string;
  pattern: TilePattern;
  jointWidth?: number;      // in mm, defaults to 3
  orientation?: TileOrientation;
  offsetX?: number;         // in cm
  offsetY?: number;         // in cm
}

interface TiledWall3DProps {
  wall: Wall;
  start: Point;
  end: Point;
  tileConfig: TileConfig;
  tile: Tile;
  scale: number;
  animationState: 'idle' | 'animating' | 'complete';
  onAnimationComplete?: () => void;
  doors?: Door[];
  windows?: WindowType[];
}

interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  rotation: number; // Z-axis rotation in radians
}

// Check if a tile overlaps any wall opening (door/window)
function tileOverlapsOpening(
  tileX: number, tileY: number, tileW: number, tileH: number,
  openings: OpeningZone[]
): boolean {
  for (const op of openings) {
    const overlapX = Math.abs(tileX - op.xCenter) < (tileW / 2 + op.halfWidth);
    const overlapY = Math.abs(tileY - (op.yBottom + op.halfHeight)) < (tileH / 2 + op.halfHeight);
    if (overlapX && overlapY) return true;
  }
  return false;
}

// Calculate tile positions for a wall with proper joint spacing and patterns
function calculateTilePositions(
  wallLength: number,
  wallHeight: number,
  tile: Tile,
  pattern: TilePattern = 'grid',
  jointWidth: number = 3,      // in mm
  orientation: TileOrientation = 'horizontal',
  offsetX: number = 0,         // in cm
  offsetY: number = 0,         // in cm
  openings: OpeningZone[] = []
): TilePosition[] {
  const positions: TilePosition[] = [];
  
  // Convert units using centralized constants
  const jointM = jointWidth * MM_TO_CM * CM_TO_METERS;   // mm to meters
  let tileW = tile.width * CM_TO_METERS;                  // cm to meters
  let tileH = tile.height * CM_TO_METERS;                 // cm to meters
  const wallL = wallLength * CM_TO_METERS;                // cm to meters
  const wallH = wallHeight * CM_TO_METERS;                // cm to meters
  const offX = offsetX * CM_TO_METERS;                    // cm to meters
  const offY = offsetY * CM_TO_METERS;                    // cm to meters

  // Swap dimensions for vertical orientation
  if (orientation === 'vertical') {
    [tileW, tileH] = [tileH, tileW];
  }

  // Calculate pitch (tile + joint)
  const pitchX = tileW + jointM;
  const pitchY = tileH + jointM;

  // Number of tiles needed (with some extra for offsets and partial edge tiles)
  const cols = Math.ceil(wallL / pitchX) + 2;
  const rows = Math.ceil(wallH / pitchY) + 2;

  // Pattern-specific calculations
  // All patterns use y=0 as wall bottom, y=wallH as wall top (matching grout plane)
  if (pattern === 'herringbone') {
    const stepX = tileH;
    const stepY = tileW;
    
    let index = 0;
    for (let row = -2; row < Math.ceil(wallH / stepY) + 2; row++) {
      for (let col = -2; col < Math.ceil(wallL / stepX) + 2; col++) {
        const isEven = (row + col) % 2 === 0;
        
        let x = col * stepX - wallL / 2 + offX;
        let y = row * stepY + offY + wallH / 2; // Center vertically on wall
        
        if (!isEven) {
          x += stepX / 2;
        }
        
        // Only include tiles that overlap the wall bounds and don't overlap openings
        if (x + tileW > -wallL / 2 && x - tileW < wallL / 2 &&
            y + tileH > 0 && y - tileH < wallH &&
            !tileOverlapsOpening(x, y, tileW, tileH, openings)) {
          
          const normalizedX = (x + wallL / 2) / wallL;
          const normalizedY = y / wallH;
          const delay = (normalizedX * 0.3 + normalizedY * 0.5) * 0.8;
          
          positions.push({
            x,
            y,
            width: tileW - jointM,
            height: tileH - jointM,
            delay: Math.max(0, delay),
            rotation: isEven ? Math.PI / 4 : -Math.PI / 4,
          });
          index++;
        }
      }
    }
  } else if (pattern === 'diagonal') {
    const diagPitch = pitchX * Math.SQRT2 * 0.5;
    
    let index = 0;
    for (let row = -2; row < Math.ceil(wallH / diagPitch) + 4; row++) {
      for (let col = -2; col < Math.ceil(wallL / diagPitch) + 4; col++) {
        const x = col * diagPitch - wallL / 2 + offX + (row % 2) * diagPitch * 0.5;
        const y = row * diagPitch * 0.5 + offY;
        
        // Only include tiles that overlap the wall bounds
        if (x + tileW > -wallL / 2 && x - tileW < wallL / 2 &&
            y + tileH > 0 && y - tileH < wallH &&
            !tileOverlapsOpening(x, y, tileW, tileH, openings)) {
          
          const normalizedX = (x + wallL / 2) / wallL;
          const normalizedY = y / wallH;
          const delay = (normalizedX * 0.3 + normalizedY * 0.5) * 0.8;
          
          positions.push({
            x,
            y,
            width: tileW - jointM,
            height: tileH - jointM,
            delay: Math.max(0, delay),
            rotation: Math.PI / 4,
          });
          index++;
        }
      }
    }
  } else {
    // Grid and Staggered patterns
    // y goes from 0 (floor) to wallH (top), matching grout plane at wallH/2 center
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        let rowOffset = 0;
        
        // Staggered pattern: offset every other row by 50%
        if (pattern === 'staggered' && row % 2 === 1) {
          rowOffset = pitchX / 2;
        }
        
        const x = col * pitchX + rowOffset + offX - wallL / 2 + tileW / 2;
        const y = row * pitchY + offY + tileH / 2;
        
        // Only include tiles that overlap the wall bounds
        if (x + tileW / 2 > -wallL / 2 && x - tileW / 2 < wallL / 2 &&
            y + tileH / 2 > 0 && y - tileH / 2 < wallH &&
            !tileOverlapsOpening(x, y, tileW, tileH, openings)) {
          
          // Calculate animation delay based on position (wave from bottom-left)
          const normalizedX = Math.max(0, Math.min(1, (x + wallL / 2) / wallL));
          const normalizedY = Math.max(0, Math.min(1, y / wallH));
          const delay = (normalizedX * 0.3 + normalizedY * 0.5) * 0.8;

          positions.push({
            x,
            y,
            width: tileW - jointM,
            height: tileH - jointM,
            delay,
            rotation: 0,
          });
        }
      }
    }
  }

  return positions;
}

export const TiledWall3D: React.FC<TiledWall3DProps> = ({
  wall,
  start,
  end,
  tileConfig,
  tile,
  scale,
  animationState,
  onAnimationComplete,
  doors = [],
  windows = [],
}) => {
  const [animationProgress, setAnimationProgress] = useState(0);

  // Calculate wall geometry using centralized constants
  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2 * CM_TO_METERS;
  const midZ = (start.y + end.y) / 2 * CM_TO_METERS;
  const wallThicknessM = wall.thickness * CM_TO_METERS;
  const wallLengthM = length * CM_TO_METERS;
  const wallHeightM = wall.height * CM_TO_METERS;

  const openings = useMemo<OpeningZone[]>(() => {
    return createOpeningZones({
      wallLength: wallLengthM,
      doors,
      windows,
      unitScale: CM_TO_METERS,
    });
  }, [doors, windows, wallLengthM]);

  const wallShape = useMemo(() => {
    return createWallShapeWithOpenings({
      wallLength: wallLengthM,
      startHeight: wallHeightM,
      endHeight: wallHeightM,
      doors,
      windows,
      unitScale: CM_TO_METERS,
    });
  }, [wallLengthM, wallHeightM, doors, windows]);

  // Create clipping planes in world space to cut tiles at all 4 wall boundaries
  // THREE.js clipping planes operate in world space, so we must transform from local
  const clippingPlanes = useMemo(() => {
    const localPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), wallLengthM / 2),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), wallLengthM / 2),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), wallHeightM),
    ];
    // Build the wall group's world transform matrix
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3(midX, 0, midZ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    // Transform planes from local to world space
    return localPlanes.map(p => p.clone().applyMatrix4(matrix));
  }, [wallLengthM, wallHeightM, midX, midZ, angle]);

  // Generate tile positions with all config options
  const tilePositions = useMemo(() => {
    return calculateTilePositions(
      length,
      wall.height,
      tile,
      tileConfig.pattern,
      tileConfig.jointWidth ?? 3,
      tileConfig.orientation ?? 'horizontal',
      tileConfig.offsetX ?? 0,
      tileConfig.offsetY ?? 0,
      openings
    );
  }, [
    length, 
    wall.height, 
    tile, 
    tileConfig.pattern, 
    tileConfig.jointWidth,
    tileConfig.orientation,
    tileConfig.offsetX,
    tileConfig.offsetY,
    openings
  ]);

  // Handle animation progress
  useFrame((state, delta) => {
    if (animationState === 'animating' && animationProgress < 1) {
      const newProgress = Math.min(animationProgress + delta * 0.8, 1);
      setAnimationProgress(newProgress);
      
      if (newProgress >= 1 && onAnimationComplete) {
        onAnimationComplete();
      }
    } else if ((animationState === 'complete' || animationState === 'idle') && animationProgress < 1) {
      // If complete or idle (tiles exist but weren't animated), show immediately
      setAnimationProgress(1);
    }
  });

  // Reset animation when state changes to animating
  useEffect(() => {
    if (animationState === 'animating') {
      setAnimationProgress(0);
    } else if (animationState === 'idle') {
      // Show immediately for idle state (tiles already exist)
      setAnimationProgress(1);
    }
  }, [animationState]);

  const isAnimating = animationState === 'animating';

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      {/* Base wall / grout backing plane */}
      <mesh 
        position={[0, 0, -wallThicknessM / 2 - 0.002]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[wallShape, { depth: wallThicknessM * 0.5, bevelEnabled: false }]} />
        <meshStandardMaterial color={tileConfig.groutColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Grout layer - slightly in front of wall base */}
      <mesh 
        position={[0, 0, wallThicknessM / 2]}
        receiveShadow
      >
        <shapeGeometry args={[wallShape]} />
        <meshStandardMaterial color={tileConfig.groutColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Individual 3D tiles on top of grout */}
      {tilePositions.map((pos, idx) => (
        <Tile3D
          key={`tile-${idx}`}
          position={[pos.x, pos.y, wallThicknessM / 2 + 0.005]}
          size={[pos.width, pos.height]}
          color={tile.color}
          tileRotation={pos.rotation}
          delay={pos.delay}
          isAnimating={isAnimating}
          animationProgress={animationProgress}
          clippingPlanes={clippingPlanes}
        />
      ))}
    </group>
  );
};

export default TiledWall3D;
