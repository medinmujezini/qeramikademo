/**
 * BlueprintBox Component
 * 
 * Animated blueprint-style placeholder box shown while furniture models load.
 * Features:
 * - Wireframe edges with animated dash effect
 * - Animated grid pattern on faces
 * - Dimension labels
 * - Corner markers with pulse animation
 * - Scan line effect
 */

import React, { useRef, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import { CM_TO_METERS } from '@/utils/modelLoader';

interface BlueprintBoxProps {
  item: FurnitureItem;
  isSelected: boolean;
  isDragging?: boolean;
  hasCollision?: boolean;
  onSelect: (id: string) => void;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
}

// Custom shader material for animated grid
const BlueprintMaterial = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });
  
  return (
    <shaderMaterial
      ref={materialRef}
      transparent
      side={THREE.DoubleSide}
      uniforms={{
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#00d4ff') },
        uBaseColor: { value: new THREE.Color('#0a1628') },
      }}
      vertexShader={`
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={`
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uBaseColor;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Base color
          vec3 color = uBaseColor;
          float alpha = 0.4;
          
          // Grid lines
          float gridSize = 8.0;
          float lineWidth = 0.03;
          float gridX = smoothstep(lineWidth, 0.0, abs(fract(vUv.x * gridSize) - 0.5) * 2.0);
          float gridY = smoothstep(lineWidth, 0.0, abs(fract(vUv.y * gridSize) - 0.5) * 2.0);
          float grid = max(gridX, gridY) * 0.3;
          
          // Animated scan line
          float scanSpeed = 0.8;
          float scanY = fract(uTime * scanSpeed);
          float scanLine = smoothstep(0.02, 0.0, abs(vUv.y - scanY)) * 0.6;
          
          // Edge glow
          float edgeX = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          float edgeY = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
          float edge = 1.0 - edgeX * edgeY;
          
          // Combine effects
          color = mix(color, uColor, grid);
          color = mix(color, uColor, scanLine);
          color += uColor * edge * 0.2;
          
          // Pulsing alpha
          alpha += sin(uTime * 2.0) * 0.05;
          
          gl_FragColor = vec4(color, alpha);
        }
      `}
    />
  );
};

// Corner marker component
const CornerMarker: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      const pulse = 1 + Math.sin(t * 3) * 0.2;
      ref.current.scale.setScalar(pulse);
    }
  });
  
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.015, 0]} />
      <meshBasicMaterial color="#00d4ff" transparent opacity={0.9} />
    </mesh>
  );
};

export const BlueprintBox: React.FC<BlueprintBoxProps & { ceilingHeight?: number }> = ({
  item,
  isSelected,
  isDragging = false,
  hasCollision = false,
  onSelect,
  onDragStart,
  ceilingHeight = 280,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  
  // Convert dimensions
  const width = item.dimensions.width * CM_TO_METERS;
  const height = item.dimensions.height * CM_TO_METERS;
  const depth = item.dimensions.depth * CM_TO_METERS;
  
  const isCarpet = item.category === 'decor' && item.dimensions.height <= 5;
  const isLight = item.category === 'lighting';
  
  // Create geometry — flat plane for carpets, box for everything else
  const { boxGeometry, edgesGeometry } = useMemo(() => {
    if (isCarpet) {
      const plane = new THREE.BoxGeometry(width, 0.005, depth);
      const edges = new THREE.EdgesGeometry(plane);
      return { boxGeometry: plane, edgesGeometry: edges };
    }
    const box = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(box);
    return { boxGeometry: box, edgesGeometry: edges };
  }, [width, height, depth, isCarpet]);
  
  // Corner positions
  const corners = useMemo(() => {
    const hw = width / 2;
    const hh = isCarpet ? 0.0025 : height / 2;
    const hd = depth / 2;
    return [
      [-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, -hd], [-hw, hh, hd],
      [hw, -hh, -hd], [hw, -hh, hd], [hw, hh, -hd], [hw, hh, hd],
    ] as [number, number, number][];
  }, [width, height, depth, isCarpet]);
  
  // Y position: ceiling for lights, ground for everything else
  const baseY = isLight
    ? (ceilingHeight * CM_TO_METERS) - height / 2
    : isCarpet ? 0.003 : height / 2;
  
  // Animated edges
  useFrame(({ clock }) => {
    if (edgesRef.current) {
      const material = edgesRef.current.material as THREE.LineDashedMaterial;
      material.opacity = 0.7 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
    }
    
    if (groupRef.current) {
      const hoverOffset = isSelected ? Math.sin(clock.getElapsedTime() * 2) * 0.01 : 0;
      groupRef.current.position.y = baseY + hoverOffset;
    }
  });
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(item.id);
  };
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isSelected && e.button === 0 && onDragStart) {
      onDragStart(e);
    }
  };
  
  const edgeColor = hasCollision ? '#ef4444' : isSelected ? '#67e8f9' : isLight ? '#ffd700' : isCarpet ? '#c9a96e' : '#00d4ff';
  const shaderColor = isLight ? '#ffd700' : isCarpet ? '#c9a96e' : '#00d4ff';
  
  return (
    <group
      position={[
        item.position.x * CM_TO_METERS,
        0,
        item.position.y * CM_TO_METERS,
      ]}
      rotation={[0, -item.rotation * (Math.PI / 180), 0]}
    >
      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        {/* Semi-transparent faces with animated grid */}
        <mesh geometry={boxGeometry}>
          <BlueprintMaterial />
        </mesh>
        
        {/* Animated dashed edges */}
        <lineSegments ref={edgesRef} geometry={edgesGeometry}>
          <lineDashedMaterial
            color={edgeColor}
            linewidth={2}
            dashSize={0.05}
            gapSize={0.03}
            transparent
            opacity={0.9}
          />
        </lineSegments>
        
        {/* Corner markers */}
        {corners.map((pos, i) => (
          <CornerMarker key={i} position={pos} />
        ))}
        
        {/* Dimension labels */}
        <Text
          position={[0, (isCarpet ? 0.01 : height / 2) + 0.08, 0]}
          fontSize={0.06}
          color={shaderColor}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {`${item.dimensions.width}×${item.dimensions.depth}${!isCarpet ? `×${item.dimensions.height}` : ''}`}
        </Text>
        
        {/* Loading indicator text */}
        <Text
          position={[0, 0, depth / 2 + 0.02]}
          fontSize={0.04}
          color={shaderColor}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {isLight ? '💡' : isCarpet ? 'Carpet' : 'Loading...'}
        </Text>
        
        {/* Point light for lighting items */}
        {isLight && (
          <pointLight
            color={item.color || '#FFF8DC'}
            intensity={3}
            distance={5}
            decay={2}
            position={[0, -0.1, 0]}
          />
        )}
      </group>
      
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[width * 1.1, depth * 1.1]} />
        <meshBasicMaterial
          color={hasCollision ? '#ef4444' : isLight ? '#ffd700' : '#00d4ff'}
          transparent
          opacity={0.1}
        />
      </mesh>
    </group>
  );
};
