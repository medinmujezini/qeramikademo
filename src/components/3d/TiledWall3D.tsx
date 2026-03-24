/**
 * TiledWall3D - Renders a wall with animated 3D tile meshes
 * Supports all tile patterns: grid, staggered, herringbone, diagonal
 * Renders grout as a backing plane with properly spaced tiles on top
 * Supports PBR textures via TileTextureUrls
 */

import React, { useMemo, useState, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Tile3D } from './Tile3D';
import type { Wall, Point, Tile, TilePattern, TileOrientation, Door, Window as WindowType, TileTextureUrls } from '@/types/floorPlan';
import type { PBRTextureProps } from '@/utils/textureUtils';
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
  textureUrls?: TileTextureUrls;
  textureScaleCm?: number;
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
  jointWidth: number = 3,
  orientation: TileOrientation = 'horizontal',
  offsetX: number = 0,
  offsetY: number = 0,
  openings: OpeningZone[] = []
): TilePosition[] {
  const positions: TilePosition[] = [];
  
  const jointM = jointWidth * MM_TO_CM * CM_TO_METERS;
  let tileW = tile.width * CM_TO_METERS;
  let tileH = tile.height * CM_TO_METERS;
  const wallL = wallLength * CM_TO_METERS;
  const wallH = wallHeight * CM_TO_METERS;
  const offX = offsetX * CM_TO_METERS;
  const offY = offsetY * CM_TO_METERS;

  if (orientation === 'vertical') {
    [tileW, tileH] = [tileH, tileW];
  }

  const pitchX = tileW + jointM;
  const pitchY = tileH + jointM;

  const cols = Math.ceil(wallL / pitchX) + 2;
  const rows = Math.ceil(wallH / pitchY) + 2;

  if (pattern === 'herringbone') {
    const stepX = tileH;
    const stepY = tileW;
    
    for (let row = -2; row < Math.ceil(wallH / stepY) + 2; row++) {
      for (let col = -2; col < Math.ceil(wallL / stepX) + 2; col++) {
        const isEven = (row + col) % 2 === 0;
        
        let x = col * stepX - wallL / 2 + offX;
        let y = row * stepY + offY + wallH / 2;
        
        if (!isEven) {
          x += stepX / 2;
        }
        
        if (x + tileW > -wallL / 2 && x - tileW < wallL / 2 &&
            y + tileH > 0 && y - tileH < wallH &&
            !tileOverlapsOpening(x, y, tileW, tileH, openings)) {
          
          const normalizedX = (x + wallL / 2) / wallL;
          const normalizedY = y / wallH;
          const delay = (normalizedX * 0.3 + normalizedY * 0.5) * 0.8;
          
          positions.push({
            x, y,
            width: tileW - jointM,
            height: tileH - jointM,
            delay: Math.max(0, delay),
            rotation: isEven ? Math.PI / 4 : -Math.PI / 4,
          });
        }
      }
    }
  } else if (pattern === 'diagonal') {
    const diagPitch = pitchX * Math.SQRT2 * 0.5;
    
    for (let row = -2; row < Math.ceil(wallH / diagPitch) + 4; row++) {
      for (let col = -2; col < Math.ceil(wallL / diagPitch) + 4; col++) {
        const x = col * diagPitch - wallL / 2 + offX + (row % 2) * diagPitch * 0.5;
        const y = row * diagPitch * 0.5 + offY;
        
        if (x + tileW > -wallL / 2 && x - tileW < wallL / 2 &&
            y + tileH > 0 && y - tileH < wallH &&
            !tileOverlapsOpening(x, y, tileW, tileH, openings)) {
          
          const normalizedX = (x + wallL / 2) / wallL;
          const normalizedY = y / wallH;
          const delay = (normalizedX * 0.3 + normalizedY * 0.5) * 0.8;
          
          positions.push({
            x, y,
            width: tileW - jointM,
            height: tileH - jointM,
            delay: Math.max(0, delay),
            rotation: Math.PI / 4,
          });
        }
      }
    }
  } else {
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        let rowOffset = 0;
        
        if (pattern === 'staggered' && row % 2 === 1) {
          rowOffset = pitchX / 2;
        }
        
        const x = col * pitchX + rowOffset + offX - wallL / 2 + tileW / 2;
        const y = row * pitchY + offY + tileH / 2;
        
        if (x + tileW / 2 > -wallL / 2 && x - tileW / 2 < wallL / 2 &&
            y + tileH / 2 > 0 && y - tileH / 2 < wallH &&
            !tileOverlapsOpening(x, y, tileW, tileH, openings)) {
          
          const normalizedX = Math.max(0, Math.min(1, (x + wallL / 2) / wallL));
          const normalizedY = Math.max(0, Math.min(1, y / wallH));
          const delay = (normalizedX * 0.3 + normalizedY * 0.5) * 0.8;

          positions.push({
            x, y,
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

/**
 * Inner component that loads PBR textures unconditionally via useLoader.
 * Only rendered when textureUrls has at least one valid URL.
 */
const TextureLoader: React.FC<{
  urls: Record<string, string>;
  children: (textures: PBRTextureProps) => React.ReactNode;
}> = ({ urls, children }) => {
  // Load all textures — useLoader is called unconditionally with stable URL list
  const urlEntries = Object.entries(urls);
  const loadedTextures = useLoader(
    THREE.TextureLoader,
    urlEntries.map(([, url]) => url)
  );

  const textureProps = useMemo<PBRTextureProps>(() => {
    const props: PBRTextureProps = {};
    urlEntries.forEach(([key, ], idx) => {
      const tex = loadedTextures[idx];
      if (tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        // Albedo needs sRGB color space
        if (key === 'map') {
          tex.colorSpace = THREE.SRGBColorSpace;
        }
        (props as any)[key] = tex;
      }
    });
    return props;
  }, [loadedTextures, urlEntries]);

  return <>{children(textureProps)}</>;
};

/**
 * Resolves TileTextureUrls to a PBR map key → URL mapping for useLoader
 */
function resolveTextureUrlMap(textureUrls?: TileTextureUrls): Record<string, string> | null {
  if (!textureUrls) return null;
  const map: Record<string, string> = {};
  if (textureUrls.albedo) map.map = textureUrls.albedo;
  if (textureUrls.normal) map.normalMap = textureUrls.normal;
  if (textureUrls.roughness) map.roughnessMap = textureUrls.roughness;
  if (textureUrls.ao) map.aoMap = textureUrls.ao;
  if (textureUrls.height) map.displacementMap = textureUrls.height;
  if (textureUrls.metallic) map.metalnessMap = textureUrls.metallic;
  return Object.keys(map).length > 0 ? map : null;
}

/**
 * Inner wall rendering component — shared by both textured and non-textured paths
 */
const TiledWallInner: React.FC<{
  wall: Wall;
  start: Point;
  end: Point;
  tileConfig: TileConfig;
  tile: Tile;
  animationState: 'idle' | 'animating' | 'complete';
  onAnimationComplete?: () => void;
  doors: Door[];
  windows: WindowType[];
  textureProps?: PBRTextureProps;
}> = ({
  wall, start, end, tileConfig, tile,
  animationState, onAnimationComplete,
  doors, windows, textureProps,
}) => {
  const [animationProgress, setAnimationProgress] = useState(0);

  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2 * CM_TO_METERS;
  const midZ = (start.y + end.y) / 2 * CM_TO_METERS;
  const wallThicknessM = wall.thickness * CM_TO_METERS;
  const wallLengthM = length * CM_TO_METERS;
  const wallHeightM = wall.height * CM_TO_METERS;

  const openings = useMemo<OpeningZone[]>(() => {
    return createOpeningZones({ wallLength: wallLengthM, doors, windows, unitScale: CM_TO_METERS });
  }, [doors, windows, wallLengthM]);

  const wallShape = useMemo(() => {
    return createWallShapeWithOpenings({
      wallLength: wallLengthM, startHeight: wallHeightM, endHeight: wallHeightM,
      doors, windows, unitScale: CM_TO_METERS,
    });
  }, [wallLengthM, wallHeightM, doors, windows]);

  const clippingPlanes = useMemo(() => {
    const localPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), wallLengthM / 2),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), wallLengthM / 2),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), wallHeightM),
    ];
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3(midX, 0, midZ),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    return localPlanes.map(p => p.clone().applyMatrix4(matrix));
  }, [wallLengthM, wallHeightM, midX, midZ, angle]);

  const tilePositions = useMemo(() => {
    return calculateTilePositions(
      length, wall.height, tile,
      tileConfig.pattern, tileConfig.jointWidth ?? 3,
      tileConfig.orientation ?? 'horizontal',
      tileConfig.offsetX ?? 0, tileConfig.offsetY ?? 0,
      openings
    );
  }, [length, wall.height, tile, tileConfig.pattern, tileConfig.jointWidth,
      tileConfig.orientation, tileConfig.offsetX, tileConfig.offsetY, openings]);

  useFrame((state, delta) => {
    if (animationState === 'animating' && animationProgress < 1) {
      const newProgress = Math.min(animationProgress + delta * 0.8, 1);
      setAnimationProgress(newProgress);
      if (newProgress >= 1 && onAnimationComplete) onAnimationComplete();
    } else if ((animationState === 'complete' || animationState === 'idle') && animationProgress < 1) {
      setAnimationProgress(1);
    }
  });

  useEffect(() => {
    if (animationState === 'animating') {
      setAnimationProgress(0);
    } else if (animationState === 'idle') {
      setAnimationProgress(1);
    }
  }, [animationState]);

  const isAnimating = animationState === 'animating';

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      {/* Base wall / grout backing plane */}
      <mesh position={[0, 0, -wallThicknessM / 2 - 0.002]} castShadow receiveShadow>
        <extrudeGeometry args={[wallShape, { depth: wallThicknessM * 0.5, bevelEnabled: false }]} />
        <meshStandardMaterial color={tileConfig.groutColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Grout layer */}
      <mesh position={[0, 0, wallThicknessM / 2]} receiveShadow>
        <shapeGeometry args={[wallShape]} />
        <meshStandardMaterial color={tileConfig.groutColor} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Individual 3D tiles */}
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
          textureProps={textureProps}
        />
      ))}
    </group>
  );
};

export const TiledWall3D: React.FC<TiledWall3DProps> = (props) => {
  const { textureUrls, textureScaleCm, ...wallProps } = props;
  const urlMap = resolveTextureUrlMap(textureUrls);

  if (urlMap) {
    return (
      <Suspense fallback={
        <TiledWallInner {...wallProps} doors={wallProps.doors ?? []} windows={wallProps.windows ?? []} />
      }>
        <TextureLoader urls={urlMap}>
          {(textureProps) => (
            <TiledWallInner
              {...wallProps}
              doors={wallProps.doors ?? []}
              windows={wallProps.windows ?? []}
              textureProps={textureProps}
            />
          )}
        </TextureLoader>
      </Suspense>
    );
  }

  return <TiledWallInner {...wallProps} doors={wallProps.doors ?? []} windows={wallProps.windows ?? []} />;
};

export default TiledWall3D;
