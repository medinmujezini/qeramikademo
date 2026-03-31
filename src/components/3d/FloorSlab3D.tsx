/**
 * FloorSlab3D — Renders a structural floor slab with thickness
 * and stairwell cutout openings.
 * Step 8 of the geometry roadmap.
 */

import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { FloorSlab } from '@/types/multiFloor';
import { CM_TO_METERS } from '@/constants/units';


interface FloorSlab3DProps {
  slab: FloorSlab;
  /** Room width in cm */
  roomWidth: number;
  /** Room depth in cm */
  roomHeight: number;
  /** Y position in meters (bottom of slab) */
  yPosition: number;
  /** Room center offset in cm */
  centerX?: number;
  centerY?: number;
}

export const FloorSlab3D: React.FC<FloorSlab3DProps> = ({
  slab,
  roomWidth,
  roomHeight,
  yPosition,
  centerX,
  centerY,
}) => {
  const scale = CM_TO_METERS;
  const thickness = slab.thickness * scale;
  const width = roomWidth * scale;
  const depth = roomHeight * scale;
  const cx = (centerX ?? roomWidth / 2) * scale;
  const cz = (centerY ?? roomHeight / 2) * scale;

  const slabColor = slab.topMaterial === 'finished' ? '#d4cdc5' : '#b0aba3';
  const slabMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: slabColor,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  }, [slabColor]);

  useEffect(() => {
    return () => { slabMaterial.dispose(); };
  }, [slabMaterial]);

  const slabShape = useMemo(() => {
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hd = depth / 2;
    shape.moveTo(-hw, -hd);
    shape.lineTo(hw, -hd);
    shape.lineTo(hw, hd);
    shape.lineTo(-hw, hd);
    shape.closePath();

    // Cut stairwell openings as holes
    for (const opening of slab.openings) {
      const ox = (opening.x - (centerX ?? roomWidth / 2)) * scale;
      const oy = (opening.y - (centerY ?? roomHeight / 2)) * scale;
      const ow = opening.width * scale;
      const od = opening.depth * scale;

      const hole = new THREE.Path();
      hole.moveTo(ox, oy);
      hole.lineTo(ox + ow, oy);
      hole.lineTo(ox + ow, oy + od);
      hole.lineTo(ox, oy + od);
      hole.closePath();
      shape.holes.push(hole);
    }

    return shape;
  }, [width, depth, slab.openings, scale, centerX, centerY]);

  const extrudeSettings = useMemo(() => ({
    depth: thickness,
    bevelEnabled: false,
  }), [thickness]);

  return (
    <group position={[cx, yPosition, cz]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[slabShape, extrudeSettings]} />
        <primitive object={slabMaterial} attach="material" />
      </mesh>
    </group>
  );
};

export default FloorSlab3D;
