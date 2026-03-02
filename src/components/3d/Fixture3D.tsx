/**
 * Fixture3D Component
 * 
 * Renders a single fixture in 3D with:
 * - BlueprintBox animated placeholder (matching furniture UX)
 * - Selection highlight
 * - Drag capability
 * - Collision feedback
 * - Category-based coloring
 * 
 * Uses unified fixture types and centralized dimension conversion.
 */

import React from 'react';
import { ThreeEvent } from '@react-three/fiber';
import type { UnifiedFixture } from '@/types/fixture';
import { BlueprintBoxFixture } from './BlueprintBoxFixture';

interface Fixture3DProps {
  fixture: UnifiedFixture;
  isSelected: boolean;
  isDragging?: boolean;
  hasCollision?: boolean;
  isRejecting?: boolean;
  rejectionProgress?: number;
  onSelect: (id: string) => void;
  onDragStart?: (e: ThreeEvent<PointerEvent>) => void;
}

/**
 * Fixture3D renders fixtures using the BlueprintBoxFixture for consistent
 * visual style with the furniture system.
 * 
 * In the future, this could be extended to load GLTF models similar to
 * how Furniture3D works, with BlueprintBox as a loading placeholder.
 */
export const Fixture3D: React.FC<Fixture3DProps> = ({
  fixture,
  isSelected,
  isDragging = false,
  hasCollision = false,
  // isRejecting and rejectionProgress are kept for API compatibility
  // but not currently used by BlueprintBoxFixture
  onSelect,
  onDragStart,
}) => {
  // For now, always render the BlueprintBoxFixture
  // This provides the animated placeholder effect matching furniture UX
  // 
  // Future enhancement: Add GLTF model loading support similar to Furniture3D:
  // if (fixture.modelUrl) {
  //   return (
  //     <ModelErrorBoundary fallback={blueprintPlaceholder}>
  //       <Suspense fallback={blueprintPlaceholder}>
  //         <GLTFModelWithFadeIn ... />
  //       </Suspense>
  //     </ModelErrorBoundary>
  //   );
  // }
  
  return (
    <BlueprintBoxFixture
      fixture={fixture}
      isSelected={isSelected}
      isDragging={isDragging}
      hasCollision={hasCollision}
      onSelect={onSelect}
      onDragStart={onDragStart}
    />
  );
};

export default Fixture3D;
