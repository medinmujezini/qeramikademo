/**
 * Tile3D - Individual 3D tile mesh with animation support
 * Renders a single tile with proper thickness and optional rotation for patterns
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PBRTextureProps } from '@/utils/textureUtils';

interface Tile3DProps {
  position: [number, number, number];
  size: [number, number]; // width, height in meters
  color: string;
  tileRotation?: number; // Z-axis rotation in radians (for herringbone/diagonal)
  delay: number; // Animation stagger delay in seconds
  isAnimating: boolean;
  animationProgress: number; // 0-1, overall animation progress
  clippingPlanes?: THREE.Plane[]; // Optional clipping planes for wall boundaries
  textureProps?: PBRTextureProps; // Optional PBR textures
}

const TILE_THICKNESS = 0.008; // 8mm tile thickness

export const Tile3D: React.FC<Tile3DProps> = ({
  position,
  size,
  color,
  tileRotation = 0,
  delay,
  isAnimating,
  animationProgress,
  clippingPlanes,
  textureProps,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Animation state
  const startTime = useRef<number | null>(null);
  const animatedScale = useRef(1); // Start at 1 for immediate visibility
  const animatedOffset = useRef(0); // Start at wall surface

  useFrame((state) => {
    if (!meshRef.current) return;

    if (isAnimating) {
      if (startTime.current === null) {
        startTime.current = state.clock.elapsedTime;
      }

      const elapsed = state.clock.elapsedTime - startTime.current - delay;
      
      if (elapsed > 0) {
        // Ease-out cubic animation
        const duration = 0.4;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        
        animatedScale.current = eased;
        animatedOffset.current = 0.5 * (1 - eased);
      } else {
        animatedScale.current = 0;
        animatedOffset.current = 0.5;
      }
    } else {
      // Reset or complete
      animatedScale.current = animationProgress >= 1 ? 1 : animatedScale.current;
      animatedOffset.current = animationProgress >= 1 ? 0 : animatedOffset.current;
      startTime.current = null;
    }

    // Apply scale animation
    const scale = animatedScale.current;
    meshRef.current.scale.set(scale, scale, 1);
    
    // Apply offset animation (tiles fly in from away from wall)
    meshRef.current.position.z = position[2] + animatedOffset.current;
  });

  const [width, height] = size;

  // When a texture map exists, omit the color prop so the texture is visible
  const hasTextureMap = !!textureProps?.map;

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[0, 0, tileRotation]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, TILE_THICKNESS]} />
      <meshStandardMaterial 
        {...(hasTextureMap ? {} : { color })}
        roughness={0.4}
        metalness={0.1}
        clippingPlanes={clippingPlanes}
        {...textureProps}
      />
    </mesh>
  );
};

export default Tile3D;
