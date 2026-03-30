/**
 * BlueprintBoxFixture Component
 * 
 * Animated blueprint-style placeholder box for fixtures.
 * Matches BlueprintBox styling for furniture with fixture-specific colors.
 * Features:
 * - Wireframe edges with animated dash effect
 * - Animated grid pattern on faces
 * - Dimension labels
 * - Corner markers with pulse animation
 * - Scan line effect
 * - Category-based coloring
 */

import React, { useRef, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { UnifiedFixture } from '@/types/fixture';
import { CM_TO_METERS } from '@/constants/units';

interface BlueprintBoxFixtureProps {
  fixture: UnifiedFixture;
  isSelected: boolean;
  isDragging?: boolean;
  hasCollision?: boolean;
  onSelect: (id: string) => void;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
}

// Category-based accent colors for fixtures
const getCategoryAccentColor = (category: string): string => {
  switch (category) {
    case 'bathroom': return '#00bfff';   // Cyan blue
    case 'kitchen': return '#ffa500';    // Orange
    case 'laundry': return '#00ff88';    // Green
    case 'utility': return '#a855f7';    // Purple
    case 'general': return '#00d4ff';    // Default cyan
    default: return '#00d4ff';
  }
};

// Custom shader material for animated grid
const BlueprintMaterial: React.FC<{ accentColor: string }> = ({ accentColor }) => {
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
        uColor: { value: new THREE.Color(accentColor) },
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
const CornerMarker: React.FC<{ position: [number, number, number]; color: string }> = ({ position, color }) => {
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
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
};

export const BlueprintBoxFixture: React.FC<BlueprintBoxFixtureProps> = ({
  fixture,
  isSelected,
  isDragging = false,
  hasCollision = false,
  onSelect,
  onDragStart,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  
  // Convert dimensions
  const width = fixture.dimensions.width * CM_TO_METERS;
  const height = fixture.dimensions.height * CM_TO_METERS;
  const depth = fixture.dimensions.depth * CM_TO_METERS;
  
  // Get category-based accent color
  const accentColor = getCategoryAccentColor(fixture.category);
  
  // Create box geometry and edges
  const { boxGeometry, edgesGeometry } = useMemo(() => {
    const box = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(box);
    return { boxGeometry: box, edgesGeometry: edges };
  }, [width, height, depth]);
  
  // Corner positions
  const corners = useMemo(() => {
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;
    return [
      [-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, -hd], [-hw, hh, hd],
      [hw, -hh, -hd], [hw, -hh, hd], [hw, hh, -hd], [hw, hh, hd],
    ] as [number, number, number][];
  }, [width, height, depth]);
  
  // Animated edges
  useFrame(({ clock }) => {
    if (edgesRef.current) {
      const material = edgesRef.current.material as THREE.LineDashedMaterial;
      // Animate line opacity for pulsing effect
      material.opacity = 0.7 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
    }
    
    if (groupRef.current) {
      // Subtle hover animation
      const baseY = height / 2;
      const hoverOffset = isSelected ? Math.sin(clock.getElapsedTime() * 2) * 0.01 : 0;
      const dragOffset = isDragging ? 0.08 : 0;
      groupRef.current.position.y = baseY + hoverOffset + dragOffset;
    }
  });
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(fixture.id);
  };
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isSelected && e.button === 0 && onDragStart) {
      onDragStart(e);
    }
  };
  
  // Edge color based on state
  const edgeColor = hasCollision ? '#ef4444' : isSelected ? '#67e8f9' : accentColor;
  
  // Convert rotation from degrees to radians
  const rotationRad = -fixture.rotation * (Math.PI / 180);
  
  return (
    <group
      position={[
        fixture.position.x * CM_TO_METERS,
        0,
        fixture.position.y * CM_TO_METERS,
      ]}
      rotation={[0, rotationRad, 0]}
    >
      <group
        ref={groupRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
      >
        {/* Semi-transparent faces with animated grid */}
        <mesh geometry={boxGeometry}>
          <BlueprintMaterial accentColor={accentColor} />
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
          <CornerMarker key={i} position={pos} color={accentColor} />
        ))}
        
        {/* Dimension labels */}
        <Text
          position={[0, height / 2 + 0.08, 0]}
          fontSize={0.06}
          color={accentColor}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {`${fixture.dimensions.width}×${fixture.dimensions.depth}×${fixture.dimensions.height}`}
        </Text>
        
        {/* Fixture name/type indicator */}
        <Text
          position={[0, 0, depth / 2 + 0.02]}
          fontSize={0.04}
          color={accentColor}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {fixture.name}
        </Text>
      </group>
      
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[width * 1.1, depth * 1.1]} />
        <meshBasicMaterial
          color={hasCollision ? '#ef4444' : accentColor}
          transparent
          opacity={isDragging ? 0.2 : 0.1}
        />
      </mesh>
    </group>
  );
};

export default BlueprintBoxFixture;
