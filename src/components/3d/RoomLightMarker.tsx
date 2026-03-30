/**
 * RoomLightMarker — draggable 3D marker for placing/editing room lights on the ceiling.
 * Visible in design mode, allows drag to reposition and shows a mini toolbar.
 */

import React, { useRef, useState, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RotateCcw, Trash2 } from 'lucide-react';
import type { RoomLight } from '@/types/floorPlan';

const SCALE = 0.01;

interface RoomLightMarkerProps {
  light: RoomLight;
  ceilingHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (cx: number, cy: number) => void;
  onRotate: (rotation: number) => void;
  onDelete: () => void;
  floorBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const RoomLightMarker: React.FC<RoomLightMarkerProps> = ({
  light,
  ceilingHeight,
  isSelected,
  onSelect,
  onMove,
  onRotate,
  onDelete,
  floorBounds,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragOffset = useRef({ x: 0, z: 0 });

  const posX = light.cx * SCALE;
  const posZ = light.cy * SCALE;
  const w = light.width * SCALE;
  const d = light.depth * SCALE;
  const rotRad = -(light.rotation * Math.PI) / 180;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragOffset.current = {
      x: posX - e.point.x,
      z: posZ - e.point.z,
    };
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    e.stopPropagation();
    const newX = e.point.x + dragOffset.current.x;
    const newZ = e.point.z + dragOffset.current.z;
    const clampedX = Math.max(floorBounds.minX, Math.min(floorBounds.maxX, newX));
    const clampedZ = Math.max(floorBounds.minZ, Math.min(floorBounds.maxZ, newZ));
    onMove(clampedX / SCALE, clampedZ / SCALE);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <group position={[posX, ceilingHeight - 0.02, posZ]} rotation={[0, rotRad, 0]}>
      {/* Visual outline of the light panel */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 0.02, d + 0.02]} />
        <meshStandardMaterial
          color={isSelected ? '#22d3ee' : '#fbbf24'}
          emissive={isSelected ? '#22d3ee' : '#fbbf24'}
          emissiveIntensity={isHovered || isSelected ? 0.8 : 0.3}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Invisible larger drag plane for easier interaction */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        visible={false}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => {
          setIsHovered(true);
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setIsHovered(false);
          if (!isDragging) document.body.style.cursor = 'default';
        }}
      >
        <planeGeometry args={[Math.max(w, 0.3) + 0.1, Math.max(d, 0.3) + 0.1]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Mini toolbar */}
      {isSelected && (
        <Html position={[0, 0.3, 0]} center distanceFactor={8} zIndexRange={[30, 0]}>
          <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 shadow-lg pointer-events-auto select-none whitespace-nowrap">
            <span className="text-[10px] text-muted-foreground font-medium mr-1">Light</span>
            <button
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-accent transition-colors text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onRotate((light.rotation + 45) % 360);
              }}
              title="Rotate 45°"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <button
              className="h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/20 transition-colors text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </Html>
      )}
    </group>
  );
};

export default RoomLightMarker;
