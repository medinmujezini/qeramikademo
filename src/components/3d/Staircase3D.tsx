/**
 * Staircase3D — Renders 3D staircase geometry (treads, railings, landings).
 * Supports straight, L-shaped, U-shaped, and spiral types.
 * When customGlbUrl is set, loads and renders a custom GLB model instead.
 */

import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Staircase } from '@/types/multiFloor';
import { generateStaircaseGeometry } from '@/utils/staircaseGeometry';
import { CM_TO_METERS } from '@/constants/units';

interface Staircase3DProps {
  staircase: Staircase;
  /** Y offset in meters for the bottom of this staircase */
  yOffset?: number;
}

const TREAD_MATERIALS: Record<string, { color: string; roughness: number; metalness: number }> = {
  wood: { color: '#8B6F47', roughness: 0.55, metalness: 0 },
  concrete: { color: '#9e9e9e', roughness: 0.85, metalness: 0 },
  metal: { color: '#b0b0b0', roughness: 0.3, metalness: 0.7 },
  marble: { color: '#e8e0d4', roughness: 0.2, metalness: 0.05 },
};

/** Renders a custom GLB model for the staircase */
const CustomStaircase3D: React.FC<{ url: string; posX: number; posZ: number; rotY: number; yOffset: number }> = ({
  url, posX, posZ, rotY, yOffset,
}) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  return (
    <group position={[posX, yOffset, posZ]} rotation={[0, rotY, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
};

/** Renders procedural geometry for the staircase */
const ProceduralStaircase3D: React.FC<{
  staircase: Staircase;
  posX: number;
  posZ: number;
  rotY: number;
  yOffset: number;
}> = ({ staircase, posX, posZ, rotY, yOffset }) => {
  const geometry = useMemo(() => generateStaircaseGeometry(staircase), [staircase]);
  const mat = TREAD_MATERIALS[staircase.treadMaterial] || TREAD_MATERIALS.wood;

  return (
    <group position={[posX, yOffset, posZ]} rotation={[0, rotY, 0]}>
      {/* Treads */}
      {geometry.treads.map((tread, i) => (
        <mesh
          key={`tread-${i}`}
          position={tread.position}
          rotation={[0, tread.rotation, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={tread.size} />
          <meshPhysicalMaterial
            color={mat.color}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>
      ))}

      {/* Landing platforms */}
      {geometry.landingPlatforms.map((platform, i) => (
        <mesh
          key={`landing-${i}`}
          position={platform.position}
          rotation={[0, platform.rotation, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={platform.size} />
          <meshPhysicalMaterial
            color={mat.color}
            roughness={mat.roughness}
            metalness={mat.metalness}
          />
        </mesh>
      ))}

      {/* Railing posts */}
      {staircase.railing !== 'none' && geometry.railingPosts.map((post, i) => (
        <mesh
          key={`rail-${i}`}
          position={[post.position[0], post.position[1] + post.height / 2, post.position[2]]}
          castShadow
        >
          <cylinderGeometry args={[0.02, 0.02, post.height, 8]} />
          <meshPhysicalMaterial
            color={staircase.railing === 'metal' ? '#888' : staircase.railing === 'glass' ? '#ddd' : '#6b5b45'}
            roughness={staircase.railing === 'metal' ? 0.3 : 0.5}
            metalness={staircase.railing === 'metal' ? 0.8 : 0}
            transparent={staircase.railing === 'glass'}
            opacity={staircase.railing === 'glass' ? 0.3 : 1}
          />
        </mesh>
      ))}

      {/* Stringer sides — simple extruded lines */}
      {geometry.stringers.map((stringer, i) => {
        if (stringer.points.length < 2) return null;
        const [s, e] = stringer.points;
        const dx = e[0] - s[0];
        const dy = e[1] - s[1];
        const dz = e[2] - s[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const midX = (s[0] + e[0]) / 2;
        const midY = (s[1] + e[1]) / 2;
        const midZ = (s[2] + e[2]) / 2;
        const pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz));

        return (
          <mesh
            key={`stringer-${i}`}
            position={[midX, midY, midZ]}
            rotation={[pitch, 0, 0]}
            castShadow
          >
            <boxGeometry args={[stringer.width, 0.25, len]} />
            <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Staircase3D: React.FC<Staircase3DProps> = ({ staircase, yOffset = 0 }) => {
  const posX = staircase.x * CM_TO_METERS;
  const posZ = staircase.y * CM_TO_METERS;
  const rotY = -(staircase.rotation * Math.PI) / 180;

  if (staircase.customGlbUrl) {
    return (
      <CustomStaircase3D
        url={staircase.customGlbUrl}
        posX={posX}
        posZ={posZ}
        rotY={rotY}
        yOffset={yOffset}
      />
    );
  }

  return (
    <ProceduralStaircase3D
      staircase={staircase}
      posX={posX}
      posZ={posZ}
      rotY={rotY}
      yOffset={yOffset}
    />
  );
};

export default Staircase3D;
