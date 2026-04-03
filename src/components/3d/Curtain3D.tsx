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
  selected?: boolean;
  onClick?: (id: string) => void;
}

const FABRIC_ROUGHNESS: Record<string, number> = {
  linen: 0.85,
  velvet: 0.95,
  cotton: 0.8,
  silk: 0.4,
  blackout: 0.9,
};

// ── Roman shade: stacked horizontal fold layers ──
const RomanShade: React.FC<{
  width: number; height: number; openAmount: number;
  color: string; roughness: number; opacity: number; transparent: boolean;
}> = ({ width, height, openAmount, color, roughness, opacity, transparent }) => {
  const foldCount = 5;
  const visibleH = height * (1 - openAmount);
  if (visibleH < 0.01) return null;

  const foldH = visibleH / foldCount;
  const foldDepth = 0.025; // how far each fold sags

  return (
    <group>
      {Array.from({ length: foldCount }).map((_, i) => {
        const yCenter = visibleH / 2 - foldH * i - foldH / 2;
        const sag = foldDepth * (1 - Math.abs(i - foldCount / 2) / (foldCount / 2)) * 0.6 + foldDepth * 0.4;
        return (
          <group key={i} position={[0, yCenter, 0]}>
            {/* Main fold panel — slight curve via vertex displacement */}
            <mesh>
              <planeGeometry args={[width, foldH, 1, 6]} />
              <meshStandardMaterial
                color={color} roughness={roughness} metalness={0}
                side={THREE.DoubleSide} transparent={transparent} opacity={opacity}
              />
            </mesh>
            {/* Shadow crease at fold bottom */}
            <mesh position={[0, -foldH / 2 + 0.002, sag * 0.5]}>
              <planeGeometry args={[width * 0.98, 0.004]} />
              <meshStandardMaterial color="#00000030" transparent opacity={0.15} />
            </mesh>
          </group>
        );
      })}
      {/* Bunched fabric at top when open */}
      {openAmount > 0.1 && (
        <mesh position={[0, visibleH / 2 + (height - visibleH) / 2, 0.01]}>
          <boxGeometry args={[width, height - visibleH, 0.04]} />
          <meshStandardMaterial
            color={color} roughness={roughness} metalness={0}
            transparent={transparent} opacity={opacity}
          />
        </mesh>
      )}
    </group>
  );
};

// ── Roller shade: cylinder at top + hanging plane ──
const RollerShade: React.FC<{
  width: number; height: number; openAmount: number;
  color: string; roughness: number; opacity: number; transparent: boolean;
}> = ({ width, height, openAmount, color, roughness, opacity, transparent }) => {
  const visibleH = height * (1 - openAmount);
  const rollerRadius = 0.02 + openAmount * 0.015; // thicker when rolled up
  const rollerY = height / 2;

  return (
    <group>
      {/* Roller cylinder */}
      <mesh position={[0, rollerY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[rollerRadius, rollerRadius, width, 16]} />
        <meshStandardMaterial color="#666666" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* End caps */}
      <mesh position={[-width / 2 - 0.005, rollerY, 0]}>
        <cylinderGeometry args={[rollerRadius + 0.005, rollerRadius + 0.005, 0.01, 12]} />
        <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[width / 2 + 0.005, rollerY, 0]}>
        <cylinderGeometry args={[rollerRadius + 0.005, rollerRadius + 0.005, 0.01, 12]} />
        <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Hanging shade */}
      {visibleH > 0.01 && (
        <mesh position={[0, rollerY - rollerRadius - visibleH / 2, 0]}>
          <planeGeometry args={[width, visibleH]} />
          <meshStandardMaterial
            color={color} roughness={roughness} metalness={0}
            side={THREE.DoubleSide} transparent={transparent} opacity={opacity}
          />
        </mesh>
      )}
      {/* Bottom bar */}
      {visibleH > 0.01 && (
        <mesh position={[0, rollerY - rollerRadius - visibleH, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.005, 0.005, width, 8]} />
          <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
};

// ── Pleated shade: accordion zigzag ──
const PleatedShade: React.FC<{
  width: number; height: number; openAmount: number;
  color: string; roughness: number; opacity: number; transparent: boolean;
}> = ({ width, height, openAmount, color, roughness, opacity, transparent }) => {
  const visibleH = height * (1 - openAmount);
  if (visibleH < 0.01) return null;

  const pleatCount = Math.max(4, Math.round(visibleH / 0.04)); // ~4cm per pleat
  const pleatH = visibleH / pleatCount;
  const pleatDepth = 0.02;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfW = width / 2;

    for (let i = 0; i <= pleatCount; i++) {
      const y = visibleH / 2 - pleatH * i;
      const z = (i % 2 === 0) ? pleatDepth / 2 : -pleatDepth / 2;
      const nz = (i % 2 === 0) ? 1 : -1;
      const v = i / pleatCount;

      // Left and right vertices
      vertices.push(-halfW, y, z, halfW, y, z);
      normals.push(0, 0, nz, 0, 0, nz);
      uvs.push(0, v, 1, v);
    }

    for (let i = 0; i < pleatCount; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, d, a, d, c);
    }

    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }, [width, visibleH, pleatCount, pleatH, pleatDepth]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color} roughness={roughness} metalness={0}
          side={THREE.DoubleSide} transparent={transparent} opacity={opacity}
        />
      </mesh>
      {/* Top rail */}
      <mesh position={[0, visibleH / 2 + 0.008, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.016, width, 0.025]} />
        <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Bottom rail */}
      <mesh position={[0, -visibleH / 2 - 0.005, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.01, width, 0.02]} />
        <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Bunched pleats at top when open */}
      {openAmount > 0.1 && (
        <mesh position={[0, visibleH / 2 + (height - visibleH) / 2 + 0.016, 0]}>
          <boxGeometry args={[width, Math.min(height - visibleH, 0.08), 0.03]} />
          <meshStandardMaterial
            color={color} roughness={roughness} metalness={0}
            transparent={transparent} opacity={opacity}
          />
        </mesh>
      )}
    </group>
  );
};

// ── Main component ──
export const Curtain3D: React.FC<Curtain3DProps> = ({
  curtain,
  wallAngle,
  wallStartX,
  wallStartY,
  wallEndX,
  wallEndY,
  wallThickness,
  wallHeight,
  selected = false,
  onClick,
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

  // Offset from wall center — place curtain in front of interior window sill/frame
  const normalX = -Math.sin(wallAngle);
  const normalY = Math.cos(wallAngle);
  const wallFaceOffset = wallThickness * scale / 2;
  const interiorWindowProjection = 0.015 + 0.06 / 2; // sill starts at +1.5cm, depth 6cm
  const offset = wallFaceOffset + interiorWindowProjection + 0.004;

  const cx = posX * scale + normalX * offset;
  const cz = posY * scale + normalY * offset;
  const cy = mountH - curtainH / 2;

  const isTransparent = curtain.type === 'sheer' || curtain.opacity < 1;
  const materialOpacity = curtain.type === 'sheer' ? Math.min(curtain.opacity, 0.4) : curtain.opacity;

  // Rod geometry (for panel/sheer only)
  const rodRadius = 0.012;
  const rodLength = curtainW + 0.06;

  // Open mechanism: panels shrink and slide, but stay within wall ends
  const wallLength = Math.hypot(wallEndX - wallStartX, wallEndY - wallStartY) * scale;
  const curtainCenterOnWall = curtain.position * wallLength;
  const leftSpace = curtainCenterOnWall;
  const rightSpace = wallLength - curtainCenterOnWall;

  const desiredHalfW = (curtainW / 2) * (1 - openAmount * 0.8);
  const leftHalfW = Math.min(desiredHalfW, Math.max(leftSpace * 2, 0.05));
  const rightHalfW = Math.min(desiredHalfW, Math.max(rightSpace * 2, 0.05));
  const leftPanelCenterX = -(leftSpace - leftHalfW / 2);
  const rightPanelCenterX = rightSpace - rightHalfW / 2;
  const isPanelType = curtain.type === 'panel' || curtain.type === 'sheer';

  const panelTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = curtain.fabricColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const stripeCount = 18;
    for (let i = 0; i < stripeCount; i++) {
      const x = (i / stripeCount) * canvas.width;
      const stripeW = canvas.width / stripeCount;
      const grad = ctx.createLinearGradient(x, 0, x + stripeW, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.12)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.04)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.10)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, stripeW, canvas.height);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }, [curtain.fabricColor]);

  return (
    <group
      position={[cx, cy, cz]}
      rotation={[0, -wallAngle, 0]}
      onClick={(e) => { e.stopPropagation(); onClick?.(curtain.id); }}
    >
      {/* Selection highlight */}
      {selected && (
        <mesh>
          <boxGeometry args={[curtainW + 0.04, curtainH + 0.04, 0.06]} />
          <meshBasicMaterial color="#C9A96E" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      )}
      {/* Curtain rod — panel/sheer only */}
      {isPanelType && curtain.rodVisible !== false && (
        <group position={[0, curtainH / 2 + rodRadius, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[rodRadius, rodRadius, rodLength, 12]} />
            <meshStandardMaterial color="#8b7355" roughness={0.3} metalness={0.6} />
          </mesh>
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

      {/* ── Panel type: solid opaque panels with fabric texture ── */}
      {curtain.type === 'panel' && (
        <>
          <group position={[leftPanelCenterX, 0, 0]}>
            <mesh position={[0, 0, -0.004]}>
              <planeGeometry args={[leftHalfW + 0.06, curtainH + 0.02]} />
              <meshStandardMaterial
                color={curtain.fabricColor}
                roughness={roughness}
                metalness={0}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[leftHalfW, curtainH, 0.006]} />
              <meshStandardMaterial
                color={curtain.fabricColor}
                map={panelTexture ?? undefined}
                roughness={roughness}
                metalness={0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>

          <group position={[rightPanelCenterX, 0, 0]}>
            <mesh position={[0, 0, -0.004]}>
              <planeGeometry args={[rightHalfW + 0.06, curtainH + 0.02]} />
              <meshStandardMaterial
                color={curtain.fabricColor}
                roughness={roughness}
                metalness={0}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[rightHalfW, curtainH, 0.006]} />
              <meshStandardMaterial
                color={curtain.fabricColor}
                map={panelTexture ?? undefined}
                roughness={roughness}
                metalness={0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        </>
      )}

      {/* ── Sheer type: single flat transparent plane ── */}
      {curtain.type === 'sheer' && (
        <mesh position={[-(openAmount * curtainW / 4), 0, 0]}>
          <planeGeometry args={[curtainW * (1 - openAmount * 0.85), curtainH]} />
          <meshStandardMaterial
            color={curtain.fabricColor} roughness={roughness} metalness={0}
            side={THREE.DoubleSide} transparent opacity={0.3}
          />
        </mesh>
      )}
      {/* Bunched fabric at sides when open */}
      {isPanelType && openAmount > 0.15 && (
        <>
          <mesh position={[-curtainW / 2, 0, 0]}>
            <boxGeometry args={[0.02 + openAmount * 0.05, curtainH * 0.95, 0.035]} />
            <meshStandardMaterial
              color={curtain.fabricColor} roughness={roughness} metalness={0}
              map={panelTexture ?? undefined}
            />
          </mesh>
          {curtain.type === 'panel' && (
            <mesh position={[curtainW / 2, 0, 0]}>
              <boxGeometry args={[0.02 + openAmount * 0.05, curtainH * 0.95, 0.035]} />
              <meshStandardMaterial
                color={curtain.fabricColor} roughness={roughness} metalness={0}
                map={panelTexture ?? undefined}
              />
            </mesh>
          )}
        </>
      )}

      {/* ── Roman shade ── */}
      {curtain.type === 'roman' && (
        <RomanShade
          width={curtainW} height={curtainH} openAmount={openAmount}
          color={curtain.fabricColor} roughness={roughness}
          opacity={materialOpacity} transparent={isTransparent}
        />
      )}

      {/* ── Roller shade ── */}
      {curtain.type === 'roller' && (
        <RollerShade
          width={curtainW} height={curtainH} openAmount={openAmount}
          color={curtain.fabricColor} roughness={roughness}
          opacity={materialOpacity} transparent={isTransparent}
        />
      )}

      {/* ── Pleated shade ── */}
      {curtain.type === 'pleated' && (
        <PleatedShade
          width={curtainW} height={curtainH} openAmount={openAmount}
          color={curtain.fabricColor} roughness={roughness}
          opacity={materialOpacity} transparent={isTransparent}
        />
      )}
    </group>
  );
};
