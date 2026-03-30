/**
 * Ceiling3D — renders a ceiling plane at wall height with optional opacity.
 * Also renders RoomLight3D instances for each light in the floor plan.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { FloorPlan, RoomLight } from '@/types/floorPlan';

const SCALE = 0.01; // cm to meters

interface Ceiling3DProps {
  floorPlan: FloorPlan;
  visible: boolean;
}

export const Ceiling3D: React.FC<Ceiling3DProps> = ({ floorPlan, visible }) => {
  const bounds = useMemo(() => {
    if (floorPlan.points.length === 0) return { minX: 0, maxX: 8, minY: 0, maxY: 6 };
    const xs = floorPlan.points.map(p => p.x);
    const ys = floorPlan.points.map(p => p.y);
    return {
      minX: Math.min(...xs) * SCALE,
      maxX: Math.max(...xs) * SCALE,
      minY: Math.min(...ys) * SCALE,
      maxY: Math.max(...ys) * SCALE,
    };
  }, [floorPlan.points]);

  const floorWidth = bounds.maxX - bounds.minX;
  const floorDepth = bounds.maxY - bounds.minY;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minY + bounds.maxY) / 2;

  // Use wall height (first wall or default 280cm)
  const ceilingHeight = (floorPlan.walls[0]?.height ?? 280) * SCALE;

  if (!visible) return null;

  return (
    <group>
      {/* Ceiling plane */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[centerX, ceilingHeight, centerZ]}
        name="ceiling"
      >
        <planeGeometry args={[floorWidth, floorDepth]} />
        <meshStandardMaterial
          color="#e8e8e8"
          roughness={0.9}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Room lights */}
      {(floorPlan.roomLights ?? []).map(light => (
        <RoomLight3D key={light.id} light={light} ceilingHeight={ceilingHeight} />
      ))}
    </group>
  );
};

/** A single rect light rendered on the ceiling */
const RoomLight3D: React.FC<{ light: RoomLight; ceilingHeight: number }> = ({ light, ceilingHeight }) => {
  const posX = light.cx * SCALE;
  const posZ = light.cy * SCALE;
  const w = light.width * SCALE;
  const d = light.depth * SCALE;
  const rotRad = -(light.rotation * Math.PI) / 180;

  return (
    <group position={[posX, ceilingHeight - 0.005, posZ]} rotation={[0, rotRad, 0]}>
      {/* Light panel mesh (slightly recessed into ceiling) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} name={`__roomlight_${light.id}`}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={light.color}
          emissive={light.enabled ? light.color : '#000000'}
          emissiveIntensity={light.enabled ? Math.min(light.intensity * 0.5, 3) : 0}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Actual rect area light */}
      {light.enabled && (
        <rectAreaLight
          color={light.color}
          intensity={light.intensity}
          width={w}
          height={d}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
        />
      )}
    </group>
  );
};

export default Ceiling3D;
