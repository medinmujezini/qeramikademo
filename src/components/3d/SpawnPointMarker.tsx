/**
 * SpawnPointMarker — draggable 3D character marker to set walkthrough spawn position.
 * User places this in the scene before entering walkthrough mode.
 */

import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export interface SpawnPoint {
  position: { x: number; y: number };  // cm coordinates (like furniture)
  rotation: number; // degrees
}

interface SpawnPointMarkerProps {
  spawn: SpawnPoint;
  onMove: (position: { x: number; y: number }) => void;
  onRotate: (rotation: number) => void;
  visible: boolean;
  floorBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const SCALE = 0.01;
const EYE_HEIGHT = 1.6;
const BODY_HEIGHT = 1.75;
const BODY_RADIUS = 0.18;
const HEAD_RADIUS = 0.12;

export const SpawnPointMarker: React.FC<SpawnPointMarkerProps> = ({
  spawn,
  onMove,
  onRotate,
  visible,
  floorBounds,
  onDragStart,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragOffset = useRef({ x: 0, z: 0 });
  const pulseRef = useRef(0);

  // Animated pulse for the direction arrow
  useFrame((_, dt) => {
    pulseRef.current += dt * 2;
  });

  const posX = spawn.position.x * SCALE;
  const posZ = spawn.position.y * SCALE;
  const rotRad = -(spawn.rotation * Math.PI) / 180;

  // Direction arrow geometry
  const arrowShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.5);
    shape.lineTo(-0.15, 0.2);
    shape.lineTo(-0.05, 0.2);
    shape.lineTo(-0.05, -0.1);
    shape.lineTo(0.05, -0.1);
    shape.lineTo(0.05, 0.2);
    shape.lineTo(0.15, 0.2);
    shape.closePath();
    return shape;
  }, []);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(true);
    onDragStart?.();

    const floorPoint = e.point;
    dragOffset.current = {
      x: posX - floorPoint.x,
      z: posZ - floorPoint.z,
    };
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return;
    e.stopPropagation();

    const newX = e.point.x + dragOffset.current.x;
    const newZ = e.point.z + dragOffset.current.z;

    // Clamp to floor bounds
    const clampedX = Math.max(floorBounds.minX, Math.min(floorBounds.maxX, newX));
    const clampedZ = Math.max(floorBounds.minZ, Math.min(floorBounds.maxZ, newZ));

    onMove({
      x: clampedX / SCALE,
      y: clampedZ / SCALE,
    });
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleRotate45 = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRotate((spawn.rotation + 45) % 360);
  };

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[posX, 0, posZ]} rotation={[0, rotRad, 0]}>
      {/* Ground ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.25, 0.35, 32]} />
        <meshStandardMaterial
          color={isDragging ? '#22d3ee' : '#06b6d4'}
          emissive={isDragging ? '#22d3ee' : '#06b6d4'}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Body capsule */}
      <mesh position={[0, BODY_HEIGHT / 2, 0]}>
        <capsuleGeometry args={[BODY_RADIUS, BODY_HEIGHT - BODY_RADIUS * 2, 8, 16]} />
        <meshStandardMaterial
          color="#06b6d4"
          transparent
          opacity={isDragging ? 0.9 : isHovered ? 0.8 : 0.6}
          emissive="#06b6d4"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, BODY_HEIGHT + HEAD_RADIUS * 0.5, 0]}>
        <sphereGeometry args={[HEAD_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Direction arrow on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.5]}>
        <shapeGeometry args={[arrowShape]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#22d3ee"
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Invisible drag plane — large transparent plane for pointer events */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
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
        <planeGeometry args={[isDragging ? 100 : 0.8, isDragging ? 100 : 0.8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Mini toolbar */}
      <Html position={[0, BODY_HEIGHT + 0.5, 0]} center distanceFactor={8} zIndexRange={[30, 0]}>
        <div className="flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-2 py-1 shadow-lg pointer-events-auto select-none whitespace-nowrap">
          <span className="text-[10px] text-muted-foreground font-medium mr-1">Spawn</span>
          <button
            className="h-5 w-5 rounded flex items-center justify-center hover:bg-accent transition-colors text-foreground"
            onClick={handleRotate45}
            title="Rotate 45°"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <span className="text-[9px] text-muted-foreground">{spawn.rotation}°</span>
        </div>
      </Html>
    </group>
  );
};

export default SpawnPointMarker;
