/**
 * FurnitureDragPlane - Grid overlay shown during furniture dragging
 */

import React, { forwardRef } from 'react';
import * as THREE from 'three';

interface FurnitureDragPlaneProps {
  hasCollision?: boolean;
  floorCenter?: { x: number; z: number };
  floorSize?: { width: number; depth: number };
}

export const FurnitureDragPlane = forwardRef<THREE.Group, FurnitureDragPlaneProps>(
  ({ hasCollision = false, floorCenter = { x: 0, z: 0 }, floorSize = { width: 10, depth: 10 } }, ref) => {
    // Subtle grid - fewer divisions for cleaner look
    const gridSize = Math.max(floorSize.width, floorSize.depth);
    const divisions = Math.round(gridSize * 2); // 50cm grid for cleaner appearance
    
    // Subtle colors that don't overpower the scene
    const gridColor = hasCollision ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.1)';
    const highlightColor = hasCollision ? 'rgba(252, 165, 165, 0.08)' : 'rgba(226, 232, 240, 0.05)';
    
    return (
      <group ref={ref}>
        {/* Very subtle grid overlay */}
        <gridHelper 
          args={[gridSize, divisions, gridColor, highlightColor]} 
          position={[floorCenter.x, 0.001, floorCenter.z]}
        />
      </group>
    );
  }
);

FurnitureDragPlane.displayName = 'FurnitureDragPlane';

export default FurnitureDragPlane;
