import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { Curtain } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';

interface Curtain3DProps {
  curtain: Curtain;
  wallAngle: number;
  wallStartX: number;
  wallStartY: number;
  wallEndX: number;
  wallEndY: number;
  wallThickness: number;
  wallHeight: number;
}

const FABRIC_ROUGHNESS: Record<string, number> = {
  linen: 0.85,
  velvet: 0.95,
  cotton: 0.8,
  silk: 0.4,
  blackout: 0.9,
};

export const Curtain3D: React.FC<Curtain3DProps> = ({
  curtain,
  wallAngle,
  wallStartX,
  wallStartY,
  wallEndX,
  wallEndY,
  wallThickness,
  wallHeight,
}) => {
  const scale = CM_TO_METERS;
  const roughness = FABRIC_ROUGHNESS[curtain.fabricMaterial] || 0.8;
  const mountH = (curtain.mountHeight ?? wallHeight) * scale;
  const curtainH = curtain.height * scale;
  const curtainW = curtain.width * scale;
  const openAmount = curtain.openAmount;

  // Position along wall
  const posX = wallStartX + (wallEndX - wallStartX) * curtain.position;
  const posY = wallStartY + (wallEndY - wallStartY) * curtain.position;

  // Offset from wall center (inside face)
  const normalX = -Math.sin(wallAngle);
  const normalY = Math.cos(wallAngle);
  const offset = (wallThickness * scale / 2) + 0.02; // 2cm in front of wall

  const cx = posX * scale + normalX * offset;
  const cz = posY * scale + normalY * offset;
  const cy = mountH - curtainH / 2;

  const isTransparent = curtain.type === 'sheer' || curtain.opacity < 1;
  const materialOpacity = curtain.type === 'sheer' ? Math.min(curtain.opacity, 0.4) : curtain.opacity;

  // Generate panel geometry with sine wave folds
  const panelGeometry = useMemo(() => {
    const visibleW = curtainW * (1 - openAmount);
    if (visibleW < 0.01) return null;

    const segsX = 32;
    const segsY = 16;
    const geo = new THREE.PlaneGeometry(visibleW, curtainH, segsX, segsY);
    const pos = geo.attributes.position;
    const foldDepth = curtain.type === 'sheer' ? 0.01 : 0.025;
    const foldFreq = curtain.type === 'sheer' ? 12 : 8;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      // Sine wave folds along X
      const fold = Math.sin(x / visibleW * Math.PI * foldFreq) * foldDepth;
      // Slightly less fold at top (rod attachment)
      const yFactor = 1 - Math.pow(Math.max(0, (y / curtainH + 0.5)), 4) * 0.3;
      pos.setZ(i, fold * yFactor);
    }
    geo.computeVertexNormals();
    return geo;
  }, [curtainW, curtainH, openAmount, curtain.type]);

  // Rod geometry
  const rodRadius = 0.012; // 1.2cm radius
  const rodLength = curtainW + 0.06; // extend 3cm each side

  if (!panelGeometry && !curtain.rodVisible) return null;

  // Shift panel to account for open amount (panels bunch to the sides)
  const panelOffsetX = openAmount * curtainW / 2;

  return (
    <group
      position={[cx, cy, cz]}
      rotation={[0, -wallAngle, 0]}
    >
      {/* Curtain rod */}
      {(curtain.rodVisible !== false) && (
        <group position={[0, curtainH / 2 + rodRadius, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[rodRadius, rodRadius, rodLength, 12]} />
            <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Rod finials */}
          <mesh position={[-rodLength / 2, 0, 0]}>
            <sphereGeometry args={[rodRadius * 1.5, 8, 8]} />
            <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[rodLength / 2, 0, 0]}>
            <sphereGeometry args={[rodRadius * 1.5, 8, 8]} />
            <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      )}

      {/* Curtain panel */}
      {panelGeometry && (
        <mesh geometry={panelGeometry} position={[-panelOffsetX, 0, 0]}>
          <meshStandardMaterial
            color={curtain.fabricColor}
            roughness={roughness}
            metalness={0}
            side={THREE.DoubleSide}
            transparent={isTransparent}
            opacity={materialOpacity}
          />
        </mesh>
      )}

      {/* Second panel for panel type (split curtains) */}
      {panelGeometry && curtain.type === 'panel' && (
        <mesh geometry={panelGeometry} position={[panelOffsetX, 0, 0]}>
          <meshStandardMaterial
            color={curtain.fabricColor}
            roughness={roughness}
            metalness={0}
            side={THREE.DoubleSide}
            transparent={isTransparent}
            opacity={materialOpacity}
          />
        </mesh>
      )}

      {/* Bunched fabric at sides when open */}
      {openAmount > 0.1 && (
        <>
          <mesh position={[-curtainW / 2, 0, 0]}>
            <boxGeometry args={[0.06, curtainH * 0.95, 0.08]} />
            <meshStandardMaterial
              color={curtain.fabricColor}
              roughness={roughness}
              metalness={0}
              transparent={isTransparent}
              opacity={materialOpacity}
            />
          </mesh>
          {curtain.type === 'panel' && (
            <mesh position={[curtainW / 2, 0, 0]}>
              <boxGeometry args={[0.06, curtainH * 0.95, 0.08]} />
              <meshStandardMaterial
                color={curtain.fabricColor}
                roughness={roughness}
                metalness={0}
                transparent={isTransparent}
                opacity={materialOpacity}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
};
