/**
 * Staircase3D — Renders realistic 3D staircase geometry.
 * Treads, risers, railing posts, handrail bars, and soffit underside.
 * When customGlbUrl is set, loads a custom GLB model instead.
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
  clipBelowY?: number;
  emissiveBoost?: number;
}

const TREAD_MATERIALS: Record<string, { color: string; roughness: number; metalness: number }> = {
  wood: { color: '#7a5c3a', roughness: 0.5, metalness: 0 },
  concrete: { color: '#9e9e9e', roughness: 0.85, metalness: 0 },
  metal: { color: '#b0b0b0', roughness: 0.3, metalness: 0.7 },
  marble: { color: '#e8e0d4', roughness: 0.2, metalness: 0.05 },
};

function darkenColor(hex: string, factor: number = 0.7): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return '#' + c.getHexString();
}

const StairMaterial: React.FC<{
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  clippingPlanes?: THREE.Plane[];
  emissiveIntensity?: number;
}> = ({ color, roughness, metalness, transparent = false, opacity = 1, clippingPlanes = [], emissiveIntensity = 0 }) => (
  <meshStandardMaterial
    color={color}
    roughness={roughness}
    metalness={metalness}
    transparent={transparent}
    opacity={opacity}
    clippingPlanes={clippingPlanes}
    clipShadows
    emissive={emissiveIntensity > 0 ? color : '#000000'}
    emissiveIntensity={emissiveIntensity}
  />
);

const CustomStaircase3D: React.FC<{
  url: string;
  posX: number;
  posZ: number;
  rotY: number;
  yOffset: number;
}> = ({ url, posX, posZ, rotY, yOffset }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);
  return (
    <group position={[posX, yOffset, posZ]} rotation={[0, rotY, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
};

/** Cylinder oriented between two 3D points */
const HandrailBar: React.FC<{
  seg: HandrailSegment;
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  clippingPlanes?: THREE.Plane[];
  emissiveIntensity?: number;
}> = ({ seg, color, roughness, metalness, transparent = false, opacity = 1, clippingPlanes = [], emissiveIntensity = 0 }) => {
  const data = useMemo(() => {
    const [sx, sy, sz] = seg.start;
    const [ex, ey, ez] = seg.end;
    const dx = ex - sx, dy = ey - sy, dz = ez - sz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 0.001) return null;
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return {
      pos: [(sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2] as [number, number, number],
      rot: [euler.x, euler.y, euler.z] as [number, number, number],
      len,
    };
  }, [seg]);

  if (!data) return null;
  return (
    <mesh position={data.pos} rotation={data.rot} castShadow>
      <cylinderGeometry args={[0.02, 0.02, data.len, 8]} />
      <StairMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent}
        opacity={opacity}
        clippingPlanes={clippingPlanes}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
};

const ProceduralStaircase3D: React.FC<{
  staircase: Staircase;
  posX: number;
  posZ: number;
  rotY: number;
  yOffset: number;
  clippingPlanes?: THREE.Plane[];
  emissiveBoost?: number;
}> = ({ staircase, posX, posZ, rotY, yOffset, clippingPlanes = [], emissiveBoost = 0 }) => {
  const geo = useMemo(() => generateStaircaseGeometry(staircase), [staircase]);
  const mat = TREAD_MATERIALS[staircase.treadMaterial] || TREAD_MATERIALS.wood;
  const riserColor = darkenColor(mat.color, 0.85);
  const soffitColor = darkenColor(mat.color, 0.55);

  const railMat = useMemo(() => {
    if (staircase.railing === 'metal') return { color: '#666', roughness: 0.25, metalness: 0.85, transparent: false, opacity: 1 };
    if (staircase.railing === 'glass') return { color: '#cde', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12 };
    return { color: '#5a4a38', roughness: 0.5, metalness: 0, transparent: false, opacity: 1 };
  }, [staircase.railing]);

  return (
    <group position={[posX, yOffset, posZ]} rotation={[0, rotY, 0]}>
      {geo.treads.map((t, i) => (
        <mesh key={`t${i}`} position={t.position} rotation={[0, t.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={t.size} />
          <StairMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clippingPlanes={clippingPlanes} emissiveIntensity={0.35 * emissiveBoost} />
        </mesh>
      ))}

      {geo.risers.map((r, i) => (
        <mesh key={`r${i}`} position={r.position} rotation={[0, r.rotation, 0]} receiveShadow>
          <boxGeometry args={r.size} />
          <StairMaterial color={riserColor} roughness={mat.roughness + 0.1} metalness={mat.metalness} clippingPlanes={clippingPlanes} emissiveIntensity={0.25 * emissiveBoost} />
        </mesh>
      ))}

      {geo.landingPlatforms.map((p, i) => (
        <mesh key={`l${i}`} position={p.position} rotation={[0, p.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={p.size} />
          <StairMaterial color={mat.color} roughness={mat.roughness} metalness={mat.metalness} clippingPlanes={clippingPlanes} emissiveIntensity={0.35 * emissiveBoost} />
        </mesh>
      ))}

      {staircase.railing !== 'none' && geo.railingPosts.map((post, i) => (
        <mesh key={`p${i}`} position={[post.position[0], post.position[1] + post.height / 2, post.position[2]]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, post.height, 8]} />
          <StairMaterial
            color={railMat.color}
            roughness={railMat.roughness}
            metalness={railMat.metalness}
            transparent={railMat.transparent}
            opacity={railMat.opacity}
            clippingPlanes={clippingPlanes}
            emissiveIntensity={0.3 * emissiveBoost}
          />
        </mesh>
      ))}

      {staircase.railing !== 'none' && geo.handrails.map((seg, i) => (
        <HandrailBar
          key={`h${i}`}
          seg={seg}
          color={railMat.color}
          roughness={railMat.roughness}
          metalness={railMat.metalness}
          transparent={railMat.transparent}
          opacity={railMat.opacity}
          clippingPlanes={clippingPlanes}
          emissiveIntensity={0.3 * emissiveBoost}
        />
      ))}

      {geo.soffits.map((soffit, i) => {
        const dx = soffit.end[0] - soffit.start[0];
        const dy = soffit.end[1] - soffit.start[1];
        const dz = soffit.end[2] - soffit.start[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 0.01) return null;
        const mx = (soffit.start[0] + soffit.end[0]) / 2;
        const my = (soffit.start[1] + soffit.end[1]) / 2;
        const mz = (soffit.start[2] + soffit.end[2]) / 2;
        const hLen = Math.sqrt(dx * dx + dz * dz);
        const pitch = -Math.atan2(dy, hLen);
        const yaw = Math.atan2(dx, dz);

        return (
          <mesh key={`s${i}`} position={[mx, my, mz]} rotation={[pitch, yaw, 0]} receiveShadow>
            <boxGeometry args={[soffit.width, soffit.thickness, len]} />
            <StairMaterial color={soffitColor} roughness={0.9} metalness={0} clippingPlanes={clippingPlanes} emissiveIntensity={0.15 * emissiveBoost} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Staircase3D: React.FC<Staircase3DProps> = ({ staircase, yOffset = 0, clipBelowY, emissiveBoost = 0 }) => {
  const posX = staircase.x * CM_TO_METERS;
  const posZ = staircase.y * CM_TO_METERS;
  const rotY = -(staircase.rotation * Math.PI) / 180;
  const clippingPlanes = useMemo(
    () => clipBelowY === undefined ? [] : [new THREE.Plane(new THREE.Vector3(0, 1, 0), -clipBelowY)],
    [clipBelowY],
  );

  if (staircase.customGlbUrl) {
    return <CustomStaircase3D url={staircase.customGlbUrl} posX={posX} posZ={posZ} rotY={rotY} yOffset={yOffset} />;
  }

  return (
    <ProceduralStaircase3D
      staircase={staircase}
      posX={posX}
      posZ={posZ}
      rotY={rotY}
      yOffset={yOffset}
      clippingPlanes={clippingPlanes}
      emissiveBoost={emissiveBoost}
    />
  );
};

export default Staircase3D;
