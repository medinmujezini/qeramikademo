/**
 * Door3D — Proper 3D door geometry with frame, panel, handle, and swing arc.
 * Supports: hinged-left, hinged-right, sliding, pocket, double door types.
 * Supports optional custom GLB model via modelUrl.
 */

import React, { useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { Door, DoorType } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';

interface Door3DProps {
  door: Door;
  wallAngle: number; // radians
  wallThickness: number; // cm
  wallStartX: number; // world cm
  wallStartY: number; // world cm
  wallEndX: number;
  wallEndY: number;
}

const FRAME_WIDTH = 5; // cm — trim around the opening
const FRAME_DEPTH_RATIO = 1.0; // frame depth = wall thickness
const HANDLE_RADIUS = 0.8; // cm
const HANDLE_LENGTH = 12; // cm
const HANDLE_HEIGHT_RATIO = 0.45; // position on door (from bottom)

const DOOR_COLOR = '#7a5230';
const FRAME_COLOR = '#e8e0d4';

export const Door3D: React.FC<Door3DProps> = ({
  door,
  wallAngle,
  wallThickness,
  wallStartX,
  wallStartY,
  wallEndX,
  wallEndY,
}) => {
  const scale = CM_TO_METERS;

  // Door position in world space
  const posX = (wallStartX + (wallEndX - wallStartX) * door.position) * scale;
  const posZ = (wallStartY + (wallEndY - wallStartY) * door.position) * scale;

  const doorW = door.width * scale;
  const doorH = door.height * scale;
  const frameW = FRAME_WIDTH * scale;
  const wallT = wallThickness * scale;
  const panelThickness = 0.04 * scale * 100; // 4cm panel

  const handleR = HANDLE_RADIUS * scale;
  const handleL = HANDLE_LENGTH * scale;
  const handleY = doorH * HANDLE_HEIGHT_RATIO;

  // Build frame pieces (4 pieces: left, right, top, threshold)
  const framePieces = useMemo(() => {
    const pieces: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const fd = wallT; // frame depth matches wall

    // Left frame
    pieces.push({
      pos: [-(doorW / 2 + frameW / 2), doorH / 2, 0],
      size: [frameW, doorH + frameW, fd],
    });
    // Right frame
    pieces.push({
      pos: [doorW / 2 + frameW / 2, doorH / 2, 0],
      size: [frameW, doorH + frameW, fd],
    });
    // Top frame (header)
    pieces.push({
      pos: [0, doorH + frameW / 2, 0],
      size: [doorW + frameW * 2, frameW, fd],
    });

    return pieces;
  }, [doorW, doorH, frameW, wallT]);

  // Door panel position depends on type
  const getPanelConfig = (type: DoorType) => {
    const pt = panelThickness;
    switch (type) {
      case 'hinged-left':
        return { offset: 0, rotation: -Math.PI / 4, pivotX: -doorW / 2 };
      case 'hinged-right':
        return { offset: 0, rotation: Math.PI / 4, pivotX: doorW / 2 };
      case 'sliding':
        return { offset: doorW * 0.4, rotation: 0, pivotX: 0 };
      case 'pocket':
        return { offset: doorW * 0.8, rotation: 0, pivotX: 0 };
      case 'double':
        return { offset: 0, rotation: 0, pivotX: 0, isDouble: true };
      default:
        return { offset: 0, rotation: 0, pivotX: 0 };
    }
  };

  const panelConfig = getPanelConfig(door.type);
  const isDouble = (panelConfig as any).isDouble;

  // Swing arc for hinged doors
  const swingArc = useMemo(() => {
    if (door.type !== 'hinged-left' && door.type !== 'hinged-right') return null;
    const segments = 32;
    const radius = doorW;
    const startAngle = door.type === 'hinged-left' ? 0 : Math.PI;
    const endAngle = door.type === 'hinged-left' ? -Math.PI / 2 : Math.PI + Math.PI / 2;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + (endAngle - startAngle) * t;
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return points;
  }, [door.type, doorW]);

  // If a custom model URL is provided, render it instead of procedural geometry
  if (door.modelUrl) {
    return (
      <group position={[posX, 0, posZ]} rotation={[0, -wallAngle, 0]}>
        <Suspense fallback={
          <mesh position={[0, doorH / 2, 0]}>
            <boxGeometry args={[doorW, doorH, panelThickness]} />
            <meshStandardMaterial color={DOOR_COLOR} />
          </mesh>
        }>
          <CustomDoorModel url={door.modelUrl} width={doorW} height={doorH} depth={wallT} />
        </Suspense>
      </group>
    );
  }

  return (
    <group
      position={[posX, 0, posZ]}
      rotation={[0, -wallAngle, 0]}
    >
      {/* Frame pieces */}
      {framePieces.map((piece, i) => (
        <mesh key={`frame-${i}`} position={piece.pos} castShadow receiveShadow>
          <boxGeometry args={piece.size} />
          <meshPhysicalMaterial
            color={FRAME_COLOR}
            roughness={0.5}
            metalness={0}
            clearcoat={0.1}
          />
        </mesh>
      ))}

      {/* Door panel(s) */}
      {isDouble ? (
        <>
          {/* Left panel — slightly open */}
          <group position={[-doorW / 4, 0, 0]}>
            <group position={[-doorW / 4, 0, 0]}>
              <group rotation={[0, -Math.PI / 6, 0]}>
                <group position={[doorW / 4, 0, 0]}>
                  <mesh position={[0, doorH / 2, 0]} castShadow>
                    <boxGeometry args={[doorW / 2 - 0.005, doorH - 0.005, panelThickness]} />
                    <meshPhysicalMaterial
                      color={DOOR_COLOR}
                      roughness={0.45}
                      metalness={0}
                      clearcoat={0.05}
                    />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
          {/* Right panel */}
          <group position={[doorW / 4, 0, 0]}>
            <group position={[doorW / 4, 0, 0]}>
              <group rotation={[0, Math.PI / 6, 0]}>
                <group position={[-doorW / 4, 0, 0]}>
                  <mesh position={[0, doorH / 2, 0]} castShadow>
                    <boxGeometry args={[doorW / 2 - 0.005, doorH - 0.005, panelThickness]} />
                    <meshPhysicalMaterial
                      color={DOOR_COLOR}
                      roughness={0.45}
                      metalness={0}
                      clearcoat={0.05}
                    />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </>
      ) : (
        /* Single panel */
        <group position={[panelConfig.pivotX, 0, 0]}>
          <group rotation={[0, panelConfig.rotation, 0]}>
            <group position={[-panelConfig.pivotX + panelConfig.offset, 0, 0]}>
              <mesh position={[0, doorH / 2, 0]} castShadow>
                <boxGeometry args={[doorW - 0.005, doorH - 0.005, panelThickness]} />
                <meshPhysicalMaterial
                  color={DOOR_COLOR}
                  roughness={0.45}
                  metalness={0}
                  clearcoat={0.05}
                />
              </mesh>

              {/* Handle — cylinder on the door face */}
              <mesh
                position={[
                  door.type === 'hinged-left' ? doorW / 2 - 0.08 : -doorW / 2 + 0.08,
                  handleY,
                  panelThickness / 2 + handleR,
                ]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[handleR, handleR, handleL * 0.3, 8]} />
                <meshPhysicalMaterial
                  color="#b0b0b0"
                  roughness={0.2}
                  metalness={0.9}
                />
              </mesh>
              {/* Handle backplate */}
              <mesh
                position={[
                  door.type === 'hinged-left' ? doorW / 2 - 0.08 : -doorW / 2 + 0.08,
                  handleY,
                  panelThickness / 2 + 0.001,
                ]}
              >
                <boxGeometry args={[0.03, handleL * 0.5, 0.003]} />
                <meshPhysicalMaterial
                  color="#a0a0a0"
                  roughness={0.3}
                  metalness={0.85}
                />
              </mesh>
            </group>
          </group>
        </group>
      )}

      {/* Swing arc line (on the floor) for hinged doors */}
      {swingArc && (
        <group position={[panelConfig.pivotX, 0.005, 0]}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={swingArc.length}
                array={new Float32Array(swingArc.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#c9a96e" transparent opacity={0.3} />
          </line>
        </group>
      )}

      {/* Threshold strip */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[doorW + frameW * 2, wallT + 0.02]} />
        <meshStandardMaterial color="#8a7e6e" roughness={0.6} />
      </mesh>
    </group>
  );
};

/**
 * Custom GLB door model loader — scales model to fit opening dimensions.
 */
const CustomDoorModel: React.FC<{ url: string; width: number; height: number; depth: number }> = ({ url, width, height, depth }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    // Compute bounding box and scale to fit
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scaleX = size.x > 0 ? width / size.x : 1;
    const scaleY = size.y > 0 ? height / size.y : 1;
    const scaleZ = size.z > 0 ? depth / size.z : 1;
    clone.scale.set(scaleX, scaleY, scaleZ);
    // Center horizontally, sit on floor
    const newBox = new THREE.Box3().setFromObject(clone);
    const center = newBox.getCenter(new THREE.Vector3());
    clone.position.x -= center.x;
    clone.position.y -= newBox.min.y;
    clone.position.z -= center.z;
    return clone;
  }, [scene, width, height, depth]);

  return <primitive object={clonedScene} />;
};

export default Door3D;
