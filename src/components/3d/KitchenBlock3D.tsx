import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { KitchenBlock } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';

interface KitchenBlock3DProps {
  block: KitchenBlock;
  selected?: boolean;
  onClick?: (id: string) => void;
  onDragStart?: (id: string, e: THREE.Event) => void;
}

const COUNTERTOP_MATERIAL_PROPS: Record<string, { roughness: number; metalness: number; tint: (hex: string) => string }> = {
  granite: {
    roughness: 0.6, metalness: 0.05,
    tint: (hex) => new THREE.Color(hex).offsetHSL(0, -0.1, -0.15).getStyle(),
  },
  marble: {
    roughness: 0.2, metalness: 0.05,
    tint: (hex) => new THREE.Color(hex).offsetHSL(0, -0.2, 0.1).getStyle(),
  },
  quartz: {
    roughness: 0.15, metalness: 0.1,
    tint: (hex) => hex,
  },
  wood: {
    roughness: 0.8, metalness: 0.0,
    tint: (hex) => new THREE.Color(hex).offsetHSL(0.02, 0.1, -0.05).getStyle(),
  },
  steel: {
    roughness: 0.1, metalness: 0.9,
    tint: () => '#c8c8c8',
  },
};

const HANDLE_PROPS: Record<string, { color: string; metalness: number; roughness: number }> = {
  bar: { color: '#c0c0c0', metalness: 0.9, roughness: 0.15 },
  knob: { color: '#a0a0a0', metalness: 0.7, roughness: 0.25 },
};

const KitchenGLTFModel: React.FC<{
  modelUrl: string;
  width: number;
  height: number;
  depth: number;
}> = ({ modelUrl, width, height, depth }) => {
  const { scene } = useGLTF(modelUrl);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const scaleX = (width * CM_TO_METERS) / Math.max(size.x, 0.001);
    const scaleY = (height * CM_TO_METERS) / Math.max(size.y, 0.001);
    const scaleZ = (depth * CM_TO_METERS) / Math.max(size.z, 0.001);
    cloned.scale.set(scaleX, scaleY, scaleZ);

    const newBox = new THREE.Box3().setFromObject(cloned);
    cloned.position.y = -newBox.min.y;
    cloned.position.x = -(newBox.min.x + newBox.max.x) / 2;
    cloned.position.z = -(newBox.min.z + newBox.max.z) / 2;
  }, [cloned, width, height, depth]);

  return <primitive object={cloned} />;
};

const ProceduralKitchenBlock: React.FC<{
  block: KitchenBlock;
}> = ({ block }) => {
  const w = block.width * CM_TO_METERS;
  const h = block.height * CM_TO_METERS;
  const d = block.depth * CM_TO_METERS;

  const isAppliance = block.blockType.startsWith('appliance-');

  // Always use user's cabinetColor — no hardcoded grey
  const bodyColor = block.cabinetColor;
  const frontColor = useMemo(() => {
    if (isAppliance) {
      // Subtle steel tint for appliance faces
      return new THREE.Color(block.cabinetColor).offsetHSL(0, -0.15, -0.03).getStyle();
    }
    return new THREE.Color(block.cabinetColor).offsetHSL(0, 0, -0.05).getStyle();
  }, [block.cabinetColor, isAppliance]);

  const countertopProps = useMemo(() => {
    const mat = COUNTERTOP_MATERIAL_PROPS[block.countertopMaterial] || COUNTERTOP_MATERIAL_PROPS.quartz;
    return {
      color: mat.tint(block.countertopColor),
      roughness: mat.roughness,
      metalness: mat.metalness,
    };
  }, [block.countertopMaterial, block.countertopColor]);

  const handleProps = useMemo(() => {
    return HANDLE_PROPS[block.handleStyle] || HANDLE_PROPS.bar;
  }, [block.handleStyle]);

  const hasCountertop = block.blockType === 'base-cabinet' || block.blockType === 'island' ||
    block.blockType === 'appliance-sink' || block.blockType === 'appliance-stove' ||
    block.blockType === 'appliance-dishwasher';

  return (
    <group>
      {/* Main body */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>

      {/* Front face accent */}
      <mesh position={[0, h / 2, d / 2 + 0.001]} castShadow>
        <planeGeometry args={[w - 0.01, h - 0.01]} />
        <meshStandardMaterial
          color={frontColor}
          roughness={isAppliance ? 0.3 : 0.5}
          metalness={isAppliance ? 0.4 : 0}
        />
      </mesh>

      {/* Handle */}
      {block.handleStyle !== 'none' && block.handleStyle !== 'integrated' && (
        <mesh
          position={[0, h * 0.55, d / 2 + 0.008]}
          castShadow
        >
          {block.handleStyle === 'knob' ? (
            <sphereGeometry args={[0.012, 8, 8]} />
          ) : (
            <boxGeometry args={[0.10, 0.008, 0.015]} />
          )}
          <meshStandardMaterial
            color={handleProps.color}
            metalness={handleProps.metalness}
            roughness={handleProps.roughness}
          />
        </mesh>
      )}

      {/* Countertop slab */}
      {hasCountertop && (
        <mesh position={[0, h + 0.015, 0]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.01, 0.03, d + 0.01]} />
          <meshStandardMaterial
            color={countertopProps.color}
            roughness={countertopProps.roughness}
            metalness={countertopProps.metalness}
          />
        </mesh>
      )}

      {/* Stove burners */}
      {block.blockType === 'appliance-stove' && (
        <group position={[0, h + 0.032, 0]}>
          {[[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.02, 0.035, 16]} />
              <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}

      {/* Sink basin */}
      {block.blockType === 'appliance-sink' && (
        <mesh position={[0, h + 0.01, 0]}>
          <boxGeometry args={[w * 0.6, 0.04, d * 0.5]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.2} />
        </mesh>
      )}
    </group>
  );
};

const KitchenBlock3D: React.FC<KitchenBlock3DProps> = ({ block, selected, onClick, onDragStart }) => {
  const groupRef = useRef<THREE.Group>(null);
  const x = block.x * CM_TO_METERS;
  const z = block.y * CM_TO_METERS;
  const rotRad = (block.rotation * Math.PI) / 180;

  const yPos = block.blockType === 'wall-cabinet' ? 1.4 : 0;

  return (
    <group
      ref={groupRef}
      position={[x, yPos, z]}
      rotation={[0, -rotRad, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(block.id);
      }}
      onPointerDown={(e) => {
        if (onDragStart) {
          e.stopPropagation();
          onDragStart(block.id, e as any);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {block.modelUrl ? (
        <KitchenGLTFModel
          modelUrl={block.modelUrl}
          width={block.width}
          height={block.height}
          depth={block.depth}
        />
      ) : (
        <ProceduralKitchenBlock block={block} />
      )}

      {selected && (
        <mesh position={[0, (block.height * CM_TO_METERS) / 2, 0]}>
          <boxGeometry args={[
            block.width * CM_TO_METERS + 0.02,
            block.height * CM_TO_METERS + 0.02,
            block.depth * CM_TO_METERS + 0.02,
          ]} />
          <meshBasicMaterial color="#C9A96E" transparent opacity={0.2} wireframe />
        </mesh>
      )}
    </group>
  );
};

export default KitchenBlock3D;
