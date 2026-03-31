/**
 * Ceiling3D — renders a ceiling plane at wall height with optional opacity.
 * Also renders RoomLight3D instances for each light in the floor plan.
 * Includes CeilingEmitterGrid for invisible auto-lights.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { FloorPlan, RoomLight, CeilingEmitterConfig } from '@/types/floorPlan';
import { DEFAULT_CEILING_EMITTER_CONFIG } from '@/types/floorPlan';

const SCALE = 0.01; // cm to meters

interface Ceiling3DProps {
  floorPlan: FloorPlan;
  visible: boolean;
}

/** Seeded pseudo-random for deterministic jitter */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface EmitterPosition {
  x: number;
  y: number;
  z: number;
  intensity: number;
}

/** Generates an even grid of invisible light positions across the ceiling */
function generateEmitterGrid(
  minX: number, maxX: number,
  minZ: number, maxZ: number,
  ceilingHeight: number,
  config: CeilingEmitterConfig,
): EmitterPosition[] {
  const floorWidth = maxX - minX;
  const floorDepth = maxZ - minZ;
  const area = floorWidth * floorDepth;

  if (area < 0.01) return [];

  // Spacing based on density
  const spacingMap: Record<string, number> = { sparse: 3.0, normal: 2.0, dense: 1.2 };
  const spacing = spacingMap[config.density] ?? 2.0;

  const cols = Math.max(1, Math.round(floorWidth / spacing));
  const rows = Math.max(1, Math.round(floorDepth / spacing));

  // Scale per-light intensity so total illumination is proportional to area
  // Target: ~0.8 total intensity per m² at config.intensity=1
  const totalLights = cols * rows;
  const perLight = (config.intensity * area) / (totalLights * 1.2);

  const positions: EmitterPosition[] = [];
  const stepX = floorWidth / (cols + 1);
  const stepZ = floorDepth / (rows + 1);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = r * 97 + c * 31;
      const jitterX = (seededRandom(seed) - 0.5) * stepX * 0.3;
      const jitterZ = (seededRandom(seed + 1) - 0.5) * stepZ * 0.3;

      positions.push({
        x: minX + stepX * (c + 1) + jitterX,
        y: ceilingHeight - 0.02, // just below ceiling
        z: minZ + stepZ * (r + 1) + jitterZ,
        intensity: Math.max(0.1, perLight),
      });
    }
  }

  return positions;
}

/** Invisible auto-light grid on the ceiling */
const CeilingEmitterGrid: React.FC<{
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  ceilingHeight: number;
  config: CeilingEmitterConfig;
}> = ({ minX, maxX, minZ, maxZ, ceilingHeight, config }) => {
  const emitters = useMemo(
    () => generateEmitterGrid(minX, maxX, minZ, maxZ, ceilingHeight, config),
    [minX, maxX, minZ, maxZ, ceilingHeight, config.intensity, config.density, config.color],
  );

  if (!config.enabled) return null;

  return (
    <group name="__ceiling_emitters">
      {emitters.map((em, i) => (
        <pointLight
          key={i}
          position={[em.x, em.y, em.z]}
          color={config.color}
          intensity={em.intensity}
          distance={8}
          decay={2}
          castShadow={false}
          userData={{ editorOnly: false, emitterIndex: i }}
        />
      ))}
    </group>
  );
};

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
  const ceilingHeight = (floorPlan.walls[0]?.height ?? 280) * SCALE;

  const emitterConfig: CeilingEmitterConfig = floorPlan.ceilingEmitterConfig ?? DEFAULT_CEILING_EMITTER_CONFIG;

  return (
    <group>
      {/* Emitter grid always renders (even when ceiling mesh hidden) */}
      <CeilingEmitterGrid
        minX={bounds.minX}
        maxX={bounds.maxX}
        minZ={bounds.minY}
        maxZ={bounds.maxY}
        ceilingHeight={ceilingHeight}
        config={emitterConfig}
      />

      {visible && (
        <>
          {/* Ceiling slab */}
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[centerX, ceilingHeight, centerZ]}
            name="ceiling"
            castShadow
            receiveShadow
          >
            <boxGeometry args={[floorWidth, floorDepth, 0.2]} />
            <meshStandardMaterial
              color="#e8e8e8"
              roughness={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Room lights */}
          {(floorPlan.roomLights ?? []).map(light => (
            <RoomLight3D key={light.id} light={light} ceilingHeight={ceilingHeight} />
          ))}
        </>
      )}
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
