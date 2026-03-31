/**
 * Furniture3D Component
 * 
 * Renders a single furniture item in 3D with:
 * - Smooth 45° rotation animation (shortest path)
 * - Material-based highlight system (emissive glow)
 * - Rejection pulse animation
 * - Blueprint box placeholder while loading
 * - Fade-in with bounce effect when model loads
 */

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import { CM_TO_METERS } from '@/constants/units';
import { dimensionsCmToMeters, position2Dto3D } from '@/utils/dimensions';
import { ModelErrorBoundary } from './ModelErrorBoundary';
import { BlueprintBox } from './BlueprintBox';

// Easing functions for smooth animation
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const bounceScale = (t: number) => {
  const startScale = 0.85;
  const overshoot = 1.08;
  const endScale = 1.0;

  if (t < 0.6) {
    // Grow from 0.85 to 1.08
    const localT = t / 0.6;
    return startScale + (overshoot - startScale) * easeOutCubic(localT);
  } else {
    // Settle from 1.08 to 1.0
    const localT = (t - 0.6) / 0.4;
    return overshoot + (endScale - overshoot) * easeOutCubic(localT);
  }
};

/**
 * Hook for fade-in with bounce scale animation
 * Only starts when `ready` becomes true
 */
const useFadeInBounce = (ready: boolean) => {
  const [opacity, setOpacity] = useState(0);
  const [scale, setScale] = useState(0.85);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    // Only start animation once ready becomes true
    if (!ready || hasStarted.current) return;
    hasStarted.current = true;
    setIsAnimating(true);

    const duration = 800; // ms
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - (startTimeRef.current ?? Date.now());
      const t = Math.min(elapsed / duration, 1);

      // Opacity: smooth ease-out
      setOpacity(easeOutCubic(t));

      // Scale: bounce easing
      setScale(bounceScale(t));

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [ready]);

  return { opacity, scale, isAnimating };
};

interface Furniture3DProps {
  item: FurnitureItem;
  isSelected: boolean;
  isDragging?: boolean;
  hasCollision?: boolean;
  isRejecting?: boolean;
  rejectionProgress?: number;
  onSelect: (id: string) => void;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
  modelUrl?: string;
  ceilingHeight?: number;
}

// FallbackBox is now replaced by BlueprintBox imported above

/**
 * GLTF Model component with material-based highlights and error handling
 */
const GLTFModel: React.FC<{
  url: string;
  item: FurnitureItem;
  isSelected: boolean;
  isDragging?: boolean;
  hasCollision?: boolean;
  isRejecting?: boolean;
  rejectionProgress?: number;
  onSelect: (id: string) => void;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
  materialOpacity?: number;
  onScaleSettled?: () => void;
  castShadows?: boolean;
}> = ({ url, item, isSelected, isDragging = false, hasCollision = false, isRejecting = false, rejectionProgress = 0, onSelect, onDragStart, materialOpacity = 1, onScaleSettled, castShadows = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const scaleSettledRef = useRef(false);
  
  // Track all mesh materials for emissive updates
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const currentEmissiveIntensity = useRef(0);
  const currentEmissiveColor = useRef(new THREE.Color('#000000'));
  
  // Load the GLTF model - errors are caught by ErrorBoundary wrapper
  const { scene } = useGLTF(url);
  
  // Deep clone scene AND materials to prevent shared state between instances
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    // Deep clone all materials so each instance is independent
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });
    return clone;
  }, [scene]);
  
  // Calculate auto-scale, centering, and auto-orientation based on target dimensions
  const { scale, centerOffset, groundOffset, baseRotation } = useMemo(() => {
    // Get model's actual bounding box
    const box = new THREE.Box3().setFromObject(clonedScene);
    const modelSize = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Target dimensions in meters (item dimensions are in cm)
    const targetWidth = item.dimensions.width * CM_TO_METERS;
    const targetDepth = item.dimensions.depth * CM_TO_METERS;
    const targetHeight = item.dimensions.height * CM_TO_METERS;
    
    // Avoid division by zero
    const safeModelSize = {
      x: modelSize.x > 0.001 ? modelSize.x : 1,
      y: modelSize.y > 0.001 ? modelSize.y : 1,
      z: modelSize.z > 0.001 ? modelSize.z : 1,
    };
    
    // === AUTO-ORIENTATION DETECTION ===
    // Compare model's aspect ratio to target's aspect ratio to detect if model needs rotation
    const targetRatio = targetWidth / targetDepth;
    const modelRatioNormal = safeModelSize.x / safeModelSize.z;  // X=width, Z=depth
    const modelRatioRotated = safeModelSize.z / safeModelSize.x; // Z=width, X=depth
    
    // Which orientation matches the target better?
    const normalDiff = Math.abs(modelRatioNormal - targetRatio);
    const rotatedDiff = Math.abs(modelRatioRotated - targetRatio);
    
    // Need 90° rotation if rotated orientation matches better
    const needsBaseRotation = rotatedDiff < normalDiff;
    const baseRotation = needsBaseRotation ? Math.PI / 2 : 0;
    
    // Calculate scale factors based on detected orientation
    let scaleX, scaleZ;
    if (needsBaseRotation) {
      // Model's Z axis is actually the width, X axis is depth
      scaleX = targetDepth / safeModelSize.x;  // X → depth
      scaleZ = targetWidth / safeModelSize.z;  // Z → width
    } else {
      // Standard orientation: X=width, Z=depth
      scaleX = targetWidth / safeModelSize.x;
      scaleZ = targetDepth / safeModelSize.z;
    }
    const scaleY = targetHeight / safeModelSize.y;
    
    // Use uniform scale (smallest factor to maintain proportions)
    const uniformScale = Math.min(scaleX, scaleY, scaleZ);
    
    // Calculate offset to center the model at origin
    const centerOffset = new THREE.Vector3(-center.x, -center.y, -center.z);
    
    // After centering, model spans from -halfHeight to +halfHeight
    // Lift by scaled halfHeight so bottom sits at y=0
    const scaledHalfHeight = (modelSize.y / 2) * uniformScale;
    const groundOffset = scaledHalfHeight;
    
    return { scale: uniformScale, centerOffset, groundOffset, baseRotation };
  }, [clonedScene, item.dimensions]);
  
  // Apply centering offset to cloned scene
  useEffect(() => {
    clonedScene.position.copy(centerOffset);
  }, [clonedScene, centerOffset]);
  
  // Update shadow casting based on castShadows prop
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = castShadows;
        child.receiveShadow = true;
      }
    });
  }, [clonedScene, castShadows]);
  
  // Collect materials for emissive updates
  useEffect(() => {
    const materials: THREE.MeshStandardMaterial[] = [];
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material instanceof THREE.MeshStandardMaterial) {
          materials.push(child.material);
        }
      }
    });
    materialsRef.current = materials;
  }, [clonedScene]);
  
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    const time = performance.now() / 1000;
    
    // Calculate target emissive
    let targetEmissiveColor = new THREE.Color('#000000');
    let targetIntensity = 0;
    
    if (hasCollision) {
      targetEmissiveColor = new THREE.Color('#ef4444');
      targetIntensity = 0.6 + Math.sin(time * 8) * 0.3;
    } else if (isDragging) {
      targetEmissiveColor = new THREE.Color('#22c55e');
      targetIntensity = 0.4;
    } else if (isSelected) {
      targetEmissiveColor = new THREE.Color('#c9a96e');
      targetIntensity = 0.5;
    } else if (hovered) {
      targetEmissiveColor = new THREE.Color('#c9a96e');
      targetIntensity = 0.2;
    }
    
    // Lerp emissive
    currentEmissiveColor.current.lerp(targetEmissiveColor, delta * 10);
    currentEmissiveIntensity.current = THREE.MathUtils.lerp(
      currentEmissiveIntensity.current,
      targetIntensity,
      delta * 10
    );
    
    // Apply to all materials (including opacity for materialization effect)
    materialsRef.current.forEach((mat) => {
      mat.emissive.copy(currentEmissiveColor.current);
      mat.emissiveIntensity = currentEmissiveIntensity.current;
      mat.transparent = materialOpacity < 1;
      mat.opacity = materialOpacity;
    });
    
    // Rejection pulse
    let pulseScale = 1;
    if (isRejecting && rejectionProgress < 1) {
      const t = rejectionProgress;
      if (t < 0.2) {
        pulseScale = 1 - (t / 0.2) * 0.1;
      } else if (t < 0.5) {
        pulseScale = 0.9 + ((t - 0.2) / 0.3) * 0.25;
      } else {
        pulseScale = 1.15 - ((t - 0.5) / 0.5) * 0.15;
      }
    }
    
    // Apply base scale with pulse animation
    const finalScale = scale * pulseScale;
    const currentScale = groupRef.current.scale.x;
    const lerpedScale = THREE.MathUtils.lerp(currentScale, finalScale, delta * 12);
    groupRef.current.scale.setScalar(lerpedScale);
    
    // Check if scale has settled (within 1% of target)
    if (!scaleSettledRef.current && Math.abs(lerpedScale - finalScale) < finalScale * 0.01) {
      scaleSettledRef.current = true;
      onScaleSettled?.();
    }
  });
  
  // Ceiling lights render at ceiling height instead of ground
  const isLightingItem = item.category === 'lighting';
  const isCarpetItem = item.category === 'decor' && item.dimensions.height <= 5;
  const yPos = isLightingItem
    ? (280 * CM_TO_METERS) - (item.dimensions.height * CM_TO_METERS / 2)
    : isCarpetItem ? 0.003 : groundOffset;
  
  const position: [number, number, number] = [
    item.position.x * CM_TO_METERS,
    yPos,
    item.position.y * CM_TO_METERS,
  ];
  
  const rotation: [number, number, number] = [
    0,
    baseRotation + (-item.rotation * (Math.PI / 180)),
    0,
  ];
  
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(item.id);
  };
  
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (isSelected && e.button === 0 && onDragStart) {
      onDragStart(e);
    }
  };
  
  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={clonedScene} />
      {/* Attach point light to lighting category items */}
      {isLightingItem && (
        <pointLight
          color={item.color || '#FFF8DC'}
          intensity={4}
          distance={6}
          decay={2}
          position={[0, -0.15, 0]}
          castShadow
        />
      )}
    </group>
  );
};

/**
 * Main Furniture3D component
 */
export const Furniture3D: React.FC<Furniture3DProps> = ({
  item,
  isSelected,
  isDragging = false,
  hasCollision = false,
  isRejecting = false,
  rejectionProgress = 0,
  onSelect,
  onDragStart,
  modelUrl,
  ceilingHeight = 280,
}) => {
  // BlueprintBox is shown while model loads (animated placeholder)
  const blueprintPlaceholder = (
    <BlueprintBox 
      item={item} 
      isSelected={isSelected} 
      isDragging={isDragging} 
      hasCollision={hasCollision} 
      onSelect={onSelect} 
      onDragStart={onDragStart}
      ceilingHeight={ceilingHeight}
    />
  );

  if (modelUrl) {
    return (
      <ModelErrorBoundary fallback={blueprintPlaceholder}>
        <React.Suspense fallback={blueprintPlaceholder}>
          <GLTFModelWithFadeIn
            url={modelUrl}
            item={item}
            isSelected={isSelected}
            isDragging={isDragging}
            hasCollision={hasCollision}
            isRejecting={isRejecting}
            rejectionProgress={rejectionProgress}
            onSelect={onSelect}
            onDragStart={onDragStart}
          />
        </React.Suspense>
      </ModelErrorBoundary>
    );
  }
  
  // No model URL - show blueprint box as permanent placeholder
  return blueprintPlaceholder;
};

/**
 * GLTFModel wrapped with fade-in bounce animation
 * Waits for scale to settle before starting fade+bounce
 */
const GLTFModelWithFadeIn: React.FC<{
  url: string;
  item: FurnitureItem;
  isSelected: boolean;
  isDragging?: boolean;
  hasCollision?: boolean;
  isRejecting?: boolean;
  rejectionProgress?: number;
  onSelect: (id: string) => void;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
}> = (props) => {
  const [isScaleSettled, setIsScaleSettled] = useState(false);
  const { opacity, scale, isAnimating } = useFadeInBounce(isScaleSettled);
  
  // Only cast shadows after animation is complete
  const shouldCastShadows = !isAnimating && opacity >= 1;
  
  const handleScaleSettled = () => {
    setIsScaleSettled(true);
  };
  
  return (
    <group scale={scale}>
      <GLTFModel 
        {...props} 
        materialOpacity={opacity} 
        onScaleSettled={handleScaleSettled}
        castShadows={shouldCastShadows}
      />
    </group>
  );
};

export default Furniture3D;
