/**
 * Window3D — Proper 3D window geometry with frame, glass pane with refraction,
 * optional mullion grid, and exterior daylight plane.
 * Supports: casement, sliding, fixed, double-hung window types.
 * Supports optional custom GLB model via modelUrl.
 */

import React, { useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { Window as FloorPlanWindow, WindowType } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';

interface Window3DProps {
  window: FloorPlanWindow;
  wallAngle: number;
  wallThickness: number;
  wallStartX: number;
  wallStartY: number;
  wallEndX: number;
  wallEndY: number;
}

const FRAME_WIDTH = 4; // cm
const MULLION_WIDTH = 2; // cm
const FRAME_COLOR = '#d4cfc8';
const MULLION_COLOR = '#c8c2b8';

// Mullion grid based on window type
function getMullionGrid(type: WindowType): { cols: number; rows: number } {
  switch (type) {
    case 'casement': return { cols: 1, rows: 1 };
    case 'sliding': return { cols: 2, rows: 1 };
    case 'fixed': return { cols: 2, rows: 2 };
    case 'double-hung': return { cols: 1, rows: 2 };
    default: return { cols: 1, rows: 1 };
  }
}

export const Window3D: React.FC<Window3DProps> = ({
  window: win,
  wallAngle,
  wallThickness,
  wallStartX,
  wallStartY,
  wallEndX,
  wallEndY,
}) => {
  const s = CM_TO_METERS;

  const posX = (wallStartX + (wallEndX - wallStartX) * win.position) * s;
  const posZ = (wallStartY + (wallEndY - wallStartY) * win.position) * s;
  const sillY = win.sillHeight * s;

  const winW = win.width * s;
  const winH = win.height * s;
  const frameW = FRAME_WIDTH * s;
  const mullionW = MULLION_WIDTH * s;
  const wallT = wallThickness * s;

  const { cols, rows } = getMullionGrid(win.type);

  // Frame pieces: outer frame around the opening
  const framePieces = useMemo(() => {
    const pieces: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    // Left
    pieces.push({ pos: [-(winW / 2 + frameW / 2), winH / 2, 0], size: [frameW, winH + frameW * 2, wallT] });
    // Right
    pieces.push({ pos: [winW / 2 + frameW / 2, winH / 2, 0], size: [frameW, winH + frameW * 2, wallT] });
    // Top
    pieces.push({ pos: [0, winH + frameW / 2, 0], size: [winW, frameW, wallT] });
    // Bottom (sill)
    pieces.push({ pos: [0, -frameW / 2, 0], size: [winW + frameW * 2, frameW, wallT * 1.3] });
    return pieces;
  }, [winW, winH, frameW, wallT]);

  // Mullion bars
  const mullions = useMemo(() => {
    const bars: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    // Vertical mullions
    for (let i = 1; i < cols; i++) {
      const x = -winW / 2 + (winW / cols) * i;
      bars.push({ pos: [x, winH / 2, 0], size: [mullionW, winH, mullionW] });
    }
    // Horizontal mullions
    for (let i = 1; i < rows; i++) {
      const y = (winH / rows) * i;
      bars.push({ pos: [0, y, 0], size: [winW, mullionW, mullionW] });
    }
    return bars;
  }, [winW, winH, cols, rows, mullionW]);

  // If a custom model URL is provided, render it instead
  if (win.modelUrl) {
    return (
      <group position={[posX, sillY, posZ]} rotation={[0, -wallAngle, 0]}>
        <Suspense fallback={
          <mesh position={[0, winH / 2, 0]}>
            <boxGeometry args={[winW, winH, 0.01]} />
            <meshStandardMaterial color="#a0c0e0" transparent opacity={0.3} />
          </mesh>
        }>
          <CustomWindowModel url={win.modelUrl} width={winW} height={winH} depth={wallT} />
        </Suspense>
        {/* Still add the rect area light for illumination */}
        <rectAreaLight
          color="#fff8e7"
          intensity={2}
          width={winW}
          height={winH}
          position={[0, winH / 2, wallT / 2 + 0.01]}
        />
      </group>
    );
  }

  return (
    <group
      position={[posX, sillY, posZ]}
      rotation={[0, -wallAngle, 0]}
    >
      {/* Outer frame */}
      {framePieces.map((piece, i) => (
        <mesh key={`wf-${i}`} position={piece.pos} castShadow receiveShadow>
          <boxGeometry args={piece.size} />
          <meshPhysicalMaterial
            color={FRAME_COLOR}
            roughness={0.5}
            metalness={0.05}
            clearcoat={0.15}
          />
        </mesh>
      ))}

      {/* Glass pane — physical material with transmission for refraction */}
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[winW - 0.002, winH - 0.002, 0.006]} />
        <meshPhysicalMaterial
          color="#e8f4f8"
          roughness={0.05}
          metalness={0}
          transmission={0.92}
          ior={1.5}
          thickness={0.5}
          transparent
          opacity={0.15}
          envMapIntensity={1.5}
        />
      </mesh>

      {/* Mullion bars */}
      {mullions.map((bar, i) => (
        <mesh key={`mul-${i}`} position={bar.pos}>
          <boxGeometry args={bar.size} />
          <meshPhysicalMaterial
            color={MULLION_COLOR}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Exterior daylight plane — bright warm white behind the window */}
      <mesh position={[0, winH / 2, -wallT / 2 - 0.01]}>
        <planeGeometry args={[winW, winH]} />
        <meshStandardMaterial
          color="#fffbe6"
          emissive="#fffbe6"
          emissiveIntensity={0.8}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Rect area light from the window — simulates exterior illumination */}
      <rectAreaLight
        color="#fff8e7"
        intensity={2}
        width={winW}
        height={winH}
        position={[0, winH / 2, wallT / 2 + 0.01]}
        rotation={[0, 0, 0]}
      />

      {/* Window sill ledge — slight protrusion inside */}
      <mesh position={[0, -0.005, wallT / 2 + 0.015]} castShadow>
        <boxGeometry args={[winW + frameW, 0.02, 0.06]} />
        <meshPhysicalMaterial
          color="#e0dbd2"
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
};

/**
 * Custom GLB window model loader — scales model to fit opening dimensions.
 */
const CustomWindowModel: React.FC<{ url: string; width: number; height: number; depth: number }> = ({ url, width, height, depth }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scaleX = size.x > 0 ? width / size.x : 1;
    const scaleY = size.y > 0 ? height / size.y : 1;
    const scaleZ = size.z > 0 ? depth / size.z : 1;
    clone.scale.set(scaleX, scaleY, scaleZ);
    const newBox = new THREE.Box3().setFromObject(clone);
    const center = newBox.getCenter(new THREE.Vector3());
    clone.position.x -= center.x;
    clone.position.y -= newBox.min.y;
    clone.position.z -= center.z;
    return clone;
  }, [scene, width, height, depth]);

  return <primitive object={clonedScene} />;
};

export default Window3D;
