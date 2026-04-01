/**
 * Staircase3D — Renders 3D staircase geometry (treads, risers, railings, handrails, soffit).
 * Supports straight, L-shaped, U-shaped, and spiral types.
 * When customGlbUrl is set, loads and renders a custom GLB model instead.
 */

import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Staircase } from '@/types/multiFloor';
import { generateStaircaseGeometry } from '@/utils/staircaseGeometry';
import type { HandrailSegment } from '@/utils/staircaseGeometry';
import { CM_TO_METERS } from '@/constants/units';

interface Staircase3DProps {
  staircase: Staircase;
  yOffset?: number;
}

const TREAD_MATERIALS: Record<string, { color: string; roughness: number; metalness: number }> = {
  wood: { color: '#8B6F47', roughness: 0.55, metalness: 0 },
  concrete: { color: '#9e9e9e', roughness: 0.85, metalness: 0 },
  metal: { color: '#b0b0b0', roughness: 0.3, metalness: 0.7 },
  marble: { color: '#e8e0d4', roughness: 0.2, metalness: 0.05 },
};

/** Darkened soffit color */
function darkenColor(hex: string, factor: number = 0.7): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return '#' + c.getHexString();
}

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

/** Handrail cylinder between two points */
const HandrailCylinder: React.FC<{ segment: HandrailSegment; color: string; roughness: number; metalness: number }> = ({
  segment, color, roughness, metalness,
}) => {
  const { position, rotation, length } = useMemo(() => {
    const [sx, sy, sz] = segment.start;
    const [ex, ey, ez] = segment.end;
    const dx = ex - sx;
    const dy = ey - sy;
    const dz = ez - sz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const mz = (sz + ez) / 2;

    // Direction vector
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    // Default cylinder axis is Y
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const euler = new THREE.Euler().setFromQuaternion(quat);

    return {
      position: [mx, my, mz] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
      length: len,
    };
  }, [segment]);

  if (length < 0.001) return null;

  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={[0.025, 0.025, length, 8]} />
      <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
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
  const soffitColor = darkenColor(mat.color, 0.6);
  
  const railingMat = useMemo(() => {
    if (staircase.railing === 'metal') return { color: '#888', roughness: 0.3, metalness: 0.8, transparent: false, opacity: 1 };
    if (staircase.railing === 'glass') return { color: '#ddd', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.3 };
    return { color: '#6b5b45', roughness: 0.5, metalness: 0, transparent: false, opacity: 1 };
  }, [staircase.railing]);

  return (
    <group position={[posX, yOffset, posZ]} rotation={[0, rotY, 0]}>
      {/* Treads */}
      {geometry.treads.map((tread, i) => (
        <mesh key={`tread-${i}`} position={tread.position} rotation={[0, tread.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={tread.size} />
          <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} />
        </mesh>
      ))}

      {/* Risers */}
      {geometry.risers.map((riser, i) => (
        <mesh key={`riser-${i}`} position={riser.position} rotation={[0, riser.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={riser.size} />
          <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} />
        </mesh>
      ))}

      {/* Landing platforms */}
      {geometry.landingPlatforms.map((platform, i) => (
        <mesh key={`landing-${i}`} position={platform.position} rotation={[0, platform.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={platform.size} />
          <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} />
        </mesh>
      ))}

      {/* Railing posts */}
      {staircase.railing !== 'none' && geometry.railingPosts.map((post, i) => (
        <mesh key={`rail-${i}`} position={[post.position[0], post.position[1] + post.height / 2, post.position[2]]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, post.height, 8]} />
          <meshPhysicalMaterial
            color={railingMat.color}
            roughness={railingMat.roughness}
            metalness={railingMat.metalness}
            transparent={railingMat.transparent}
            opacity={railingMat.opacity}
          />
        </mesh>
      ))}

      {/* Handrails connecting post tops */}
      {staircase.railing !== 'none' && geometry.handrails.map((segment, i) => (
        <HandrailCylinder
          key={`handrail-${i}`}
          segment={segment}
          color={railingMat.color}
          roughness={railingMat.roughness}
          metalness={railingMat.metalness}
        />
      ))}

      {/* Stringers */}
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
        const horizontalLen = Math.sqrt(dx * dx + dz * dz);
        const pitch = -Math.atan2(dy, horizontalLen);
        const yaw = Math.atan2(dx, dz);

        return (
          <mesh key={`stringer-${i}`} position={[midX, midY, midZ]} rotation={[pitch, yaw, 0]} castShadow>
            <boxGeometry args={[stringer.width, 0.25, len]} />
            <meshPhysicalMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} />
          </mesh>
        );
      })}

      {/* Soffit (underside solid slab) */}
      {geometry.soffits.map((soffit, i) => {
        const dx = soffit.end[0] - soffit.start[0];
        const dy = soffit.end[1] - soffit.start[1];
        const dz = soffit.end[2] - soffit.start[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const midX = (soffit.start[0] + soffit.end[0]) / 2;
        const midY = (soffit.start[1] + soffit.end[1]) / 2;
        const midZ = (soffit.start[2] + soffit.end[2]) / 2;
        const horizontalLen = Math.sqrt(dx * dx + dz * dz);
        const pitch = -Math.atan2(dy, horizontalLen);
        const yaw = Math.atan2(dx, dz);

        return (
          <mesh key={`soffit-${i}`} position={[midX, midY, midZ]} rotation={[pitch, yaw, 0]} receiveShadow>
            <boxGeometry args={[soffit.width, soffit.thickness, len]} />
            <meshPhysicalMaterial color={soffitColor} roughness={0.9} metalness={0} />
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
