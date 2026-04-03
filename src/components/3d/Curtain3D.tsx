import React, { useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Curtain } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';
import { ModelErrorBoundary } from './ModelErrorBoundary';

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

// GLB curtain model loader — same pattern as Furniture3D
const CurtainGLTFModel: React.FC<{
  url: string;
  targetWidth: number;
  targetHeight: number;
  fabricColor: string;
  roughness: number;
  openAmount: number;
}> = ({ url, targetWidth, targetHeight, fabricColor, roughness, openAmount }) => {
  const { scene } = useGLTF(url);
  const { gl } = useThree();

  // Enable local clipping on the renderer
  useMemo(() => { gl.localClippingEnabled = true; }, [gl]);

  // Clipping planes: left half keeps X < 0, right half keeps X > 0
  const leftClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), []);
  const rightClipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);

  const createHalf = (clipPlane: THREE.Plane) => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scaleX = size.x > 0 ? targetWidth / size.x : 1;
    const scaleY = size.y > 0 ? targetHeight / size.y : 1;
    const scaleZ = size.z > 0 ? 0.03 / size.z : 1;
    clone.scale.set(scaleX, scaleY, scaleZ);

    const newBox = new THREE.Box3().setFromObject(clone);
    const newCenter = newBox.getCenter(new THREE.Vector3());

    clone.position.set(-newCenter.x, -newBox.min.y, -newBox.min.z);

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mesh.material = mat.map(m => {
            const newMat = (m as THREE.MeshStandardMaterial).clone();
            newMat.metalness = 0;
            newMat.clippingPlanes = [clipPlane];
            newMat.clipShadows = true;
            return newMat;
          });
        } else {
          const newMat = (mat as THREE.MeshStandardMaterial).clone();
          newMat.metalness = 0;
          newMat.clippingPlanes = [clipPlane];
          newMat.clipShadows = true;
          mesh.material = newMat;
        }
      }
    });

    return clone;
  };

  const leftHalf = useMemo(() => createHalf(leftClipPlane), [scene, targetWidth, targetHeight, leftClipPlane]);
  const rightHalf = useMemo(() => createHalf(rightClipPlane), [scene, targetWidth, targetHeight, rightClipPlane]);

  const openOffset = openAmount * (targetWidth / 2);

  return (
    <group>
      <group position={[-openOffset, 0, 0]}>
        <primitive object={leftHalf} />
      </group>
      <group position={[openOffset, 0, 0]}>
        <primitive object={rightHalf} />
      </group>
    </group>
  );
};

// Fallback box used during loading and as error fallback
const FallbackBox: React.FC<{
  width: number;
  height: number;
  color: string;
  roughness: number;
}> = ({ width, height, color, roughness }) => (
  <mesh>
    <boxGeometry args={[width, height, 0.03]} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={0} transparent opacity={0.5} />
  </mesh>
);

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

  // Position along wall (0-1)
  const posX = wallStartX + (wallEndX - wallStartX) * curtain.position;
  const posY = wallStartY + (wallEndY - wallStartY) * curtain.position;

  // Offset: push curtain to the inside face of the wall, flush
  const normalX = -Math.sin(wallAngle);
  const normalY = Math.cos(wallAngle);
  const hasModel = !!curtain.modelUrl;
  const offset = (wallThickness * scale / 2) + (hasModel ? 0.02 : 0.005);

  const cx = posX * scale + normalX * offset;
  const cz = posY * scale + normalY * offset;
  const cy = hasModel ? (mountH - curtainH) : (mountH - curtainH / 2);

  // Simple open/close: two halves slide apart from center
  const panelWidth = (curtainW / 2) * (1 - openAmount * 0.7);
  const panelPosX = curtainW / 2 - panelWidth / 2;
  
  const isTransparent = curtain.type === 'sheer' || curtain.opacity < 1;
  const materialOpacity = curtain.type === 'sheer' ? Math.min(curtain.opacity, 0.4) : curtain.opacity;
  const isPanelType = curtain.type === 'panel' || curtain.type === 'sheer';

  // Rod
  const rodRadius = 0.012;
  const rodLength = curtainW + 0.06;


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

      {/* Curtain rod */}
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

      {/* ── GLB Model rendering ── */}
      {hasModel && (
        <ModelErrorBoundary fallback={<FallbackBox width={curtainW} height={curtainH} color={curtain.fabricColor} roughness={roughness} />}>
          <Suspense fallback={<FallbackBox width={curtainW} height={curtainH} color={curtain.fabricColor} roughness={roughness} />}>
            <CurtainGLTFModel
              url={curtain.modelUrl!}
              targetWidth={curtainW}
              targetHeight={curtainH}
              fabricColor={curtain.fabricColor}
              roughness={roughness}
              openAmount={openAmount}
            />
          </Suspense>
        </ModelErrorBoundary>
      )}

      {/* ── Fallback: Panel — two solid box halves that slide apart ── */}
      {!hasModel && curtain.type === 'panel' && (
        <>
          <mesh position={[-panelPosX, 0, 0]}>
            <boxGeometry args={[panelWidth, curtainH, 0.03]} />
            <meshStandardMaterial color={curtain.fabricColor} roughness={roughness} metalness={0} />
          </mesh>
          <mesh position={[(panelPosX), 0, 0]}>
            <boxGeometry args={[panelWidth, curtainH, 0.03]} />
            <meshStandardMaterial color={curtain.fabricColor} roughness={roughness} metalness={0} />
          </mesh>
        </>
      )}

      {/* ── Fallback: Sheer — single transparent flat plane ── */}
      {!hasModel && curtain.type === 'sheer' && (
        <mesh position={[-(openAmount * curtainW / 4), 0, 0]}>
          <planeGeometry args={[curtainW, curtainH]} />
          <meshStandardMaterial
            color={curtain.fabricColor} roughness={roughness} metalness={0}
            side={THREE.DoubleSide} transparent opacity={0.3}
          />
        </mesh>
      )}

      {/* Bunched fabric at sides when open */}
      {!hasModel && isPanelType && openAmount > 0.15 && (
        <>
          <mesh position={[-curtainW / 2, 0, 0]}>
            <boxGeometry args={[0.03 + openAmount * 0.08, curtainH * 0.95, 0.06]} />
            <meshStandardMaterial color={curtain.fabricColor} roughness={roughness} metalness={0} />
          </mesh>
          {curtain.type === 'panel' && (
            <mesh position={[curtainW / 2, 0, 0]}>
              <boxGeometry args={[0.03 + openAmount * 0.08, curtainH * 0.95, 0.06]} />
              <meshStandardMaterial color={curtain.fabricColor} roughness={roughness} metalness={0} />
            </mesh>
          )}
        </>
      )}

      {/* ── Roman shade ── */}
      {!hasModel && curtain.type === 'roman' && (
        <RomanShade
          width={curtainW} height={curtainH} openAmount={openAmount}
          color={curtain.fabricColor} roughness={roughness}
          opacity={materialOpacity} transparent={isTransparent}
        />
      )}

      {/* ── Roller shade ── */}
      {!hasModel && curtain.type === 'roller' && (
        <RollerShade
          width={curtainW} height={curtainH} openAmount={openAmount}
          color={curtain.fabricColor} roughness={roughness}
          opacity={materialOpacity} transparent={isTransparent}
        />
      )}

      {/* ── Pleated shade ── */}
      {!hasModel && curtain.type === 'pleated' && (
        <PleatedShade
          width={curtainW} height={curtainH} openAmount={openAmount}
          color={curtain.fabricColor} roughness={roughness}
          opacity={materialOpacity} transparent={isTransparent}
        />
      )}
    </group>
  );
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

  return (
    <group>
      {Array.from({ length: foldCount }).map((_, i) => (
        <mesh key={i} position={[0, visibleH / 2 - foldH * i - foldH / 2, 0]}>
          <boxGeometry args={[width, foldH - 0.002, 0.02]} />
          <meshStandardMaterial
            color={color} roughness={roughness} metalness={0}
            transparent={transparent} opacity={opacity}
          />
        </mesh>
      ))}
      {openAmount > 0.1 && (
        <mesh position={[0, visibleH / 2 + (height - visibleH) / 2, 0]}>
          <boxGeometry args={[width, height - visibleH, 0.04]} />
          <meshStandardMaterial color={color} roughness={roughness} metalness={0} transparent={transparent} opacity={opacity} />
        </mesh>
      )}
    </group>
  );
};

// ── Roller shade: cylinder at top + flat hanging plane ──
const RollerShade: React.FC<{
  width: number; height: number; openAmount: number;
  color: string; roughness: number; opacity: number; transparent: boolean;
}> = ({ width, height, openAmount, color, roughness, opacity, transparent }) => {
  const visibleH = height * (1 - openAmount);
  const rollerRadius = 0.02 + openAmount * 0.015;
  const rollerY = height / 2;

  return (
    <group>
      <mesh position={[0, rollerY, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[rollerRadius, rollerRadius, width, 16]} />
        <meshStandardMaterial color="#666666" roughness={0.4} metalness={0.3} />
      </mesh>
      {visibleH > 0.01 && (
        <mesh position={[0, rollerY - rollerRadius - visibleH / 2, 0]}>
          <boxGeometry args={[width, visibleH, 0.005]} />
          <meshStandardMaterial
            color={color} roughness={roughness} metalness={0}
            transparent={transparent} opacity={opacity}
          />
        </mesh>
      )}
    </group>
  );
};

// ── Pleated shade: simple stacked angled panels ──
const PleatedShade: React.FC<{
  width: number; height: number; openAmount: number;
  color: string; roughness: number; opacity: number; transparent: boolean;
}> = ({ width, height, openAmount, color, roughness, opacity, transparent }) => {
  const visibleH = height * (1 - openAmount);
  if (visibleH < 0.01) return null;
  const pleatCount = Math.max(4, Math.round(visibleH / 0.04));
  const pleatH = visibleH / pleatCount;

  return (
    <group>
      {Array.from({ length: pleatCount }).map((_, i) => (
        <mesh key={i} position={[0, visibleH / 2 - pleatH * i - pleatH / 2, (i % 2 === 0 ? 0.01 : -0.01)]}>
          <boxGeometry args={[width, pleatH - 0.001, 0.003]} />
          <meshStandardMaterial
            color={color} roughness={roughness} metalness={0}
            transparent={transparent} opacity={opacity}
          />
        </mesh>
      ))}
      {openAmount > 0.1 && (
        <mesh position={[0, visibleH / 2 + (height - visibleH) / 2, 0]}>
          <boxGeometry args={[width, Math.min(height - visibleH, 0.08), 0.03]} />
          <meshStandardMaterial color={color} roughness={roughness} metalness={0} transparent={transparent} opacity={opacity} />
        </mesh>
      )}
    </group>
  );
};

export default Curtain3D;
