import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { KitchenBlock } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';
import { useMaterialContext } from '@/contexts/MaterialContext';

interface KitchenBlock3DProps {
  block: KitchenBlock;
  selected?: boolean;
  onClick?: (id: string) => void;
  onDragStart?: (id: string, e: THREE.Event) => void;
}

/* ── procedural canvas textures (cached globally) ── */
const textureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreateProceduralTexture(type: string, color: string): THREE.CanvasTexture {
  const key = `${type}-${color}`;
  if (textureCache.has(key)) return textureCache.get(key)!;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const base = new THREE.Color(color);

  if (type === 'marble') {
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = new THREE.Color(color).offsetHSL(0, -0.1, 0.15).getStyle();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const y0 = Math.random() * size;
      ctx.moveTo(0, y0);
      for (let x = 0; x < size; x += 20) {
        ctx.lineTo(x, y0 + (Math.random() - 0.5) * 60);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (type === 'wood') {
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(0, 0, size, size);
    const dark = new THREE.Color(color).offsetHSL(0.01, 0.05, -0.12).getStyle();
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.5;
    for (let y = 0; y < size; y += 4 + Math.random() * 6) {
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (Math.random() - 0.5) * 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (type === 'granite') {
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 0.5 + Math.random() * 1.5;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '0,0,0' : '255,255,255'},${0.1 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // quartz — subtle low-contrast noise
    ctx.fillStyle = base.getStyle();
    ctx.fillRect(0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      imgData.data[i] += n;
      imgData.data[i + 1] += n;
      imgData.data[i + 2] += n;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  textureCache.set(key, tex);
  return tex;
}

/* ── material property lookups ── */
const COUNTERTOP_MATERIAL_PROPS: Record<string, { roughness: number; metalness: number; tint: (hex: string) => string }> = {
  granite: { roughness: 0.6, metalness: 0.05, tint: (hex) => new THREE.Color(hex).offsetHSL(0, -0.1, -0.15).getStyle() },
  marble: { roughness: 0.2, metalness: 0.05, tint: (hex) => new THREE.Color(hex).offsetHSL(0, -0.2, 0.1).getStyle() },
  quartz: { roughness: 0.15, metalness: 0.1, tint: (hex) => hex },
  wood: { roughness: 0.8, metalness: 0.0, tint: (hex) => new THREE.Color(hex).offsetHSL(0.02, 0.1, -0.05).getStyle() },
  steel: { roughness: 0.1, metalness: 0.9, tint: () => '#c8c8c8' },
};

const HANDLE_PROPS: Record<string, { color: string; metalness: number; roughness: number }> = {
  bar: { color: '#c0c0c0', metalness: 0.9, roughness: 0.15 },
  knob: { color: '#a0a0a0', metalness: 0.7, roughness: 0.25 },
};

/* ── PBR texture loader (cached) ── */
const pbrTextureLoader = new THREE.TextureLoader();
const loadedTextures = new Map<string, THREE.Texture>();

function loadPBRTexture(url: string): THREE.Texture {
  if (loadedTextures.has(url)) return loadedTextures.get(url)!;
  const tex = pbrTextureLoader.load(url);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  loadedTextures.set(url, tex);
  return tex;
}

/* ── GLTF model sub-component ── */
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
    cloned.scale.set(
      (width * CM_TO_METERS) / Math.max(size.x, 0.001),
      (height * CM_TO_METERS) / Math.max(size.y, 0.001),
      (depth * CM_TO_METERS) / Math.max(size.z, 0.001),
    );
    const newBox = new THREE.Box3().setFromObject(cloned);
    cloned.position.y = -newBox.min.y;
    cloned.position.x = -(newBox.min.x + newBox.max.x) / 2;
    cloned.position.z = -(newBox.min.z + newBox.max.z) / 2;
  }, [cloned, width, height, depth]);

  return <primitive object={cloned} />;
};

/* ── Procedural kitchen block ── */
const ProceduralKitchenBlock: React.FC<{ block: KitchenBlock }> = ({ block }) => {
  const { materials } = useMaterialContext();

  const geometry = useMemo(() => {
    const w = block.width * CM_TO_METERS;
    const h = block.height * CM_TO_METERS;
    const d = block.depth * CM_TO_METERS;
    const isAppliance = block.blockType.startsWith('appliance-');
    const bt = block.blockType;

    const bodyColor = block.cabinetColor;
    const frontColor = isAppliance
      ? new THREE.Color(bodyColor).offsetHSL(0, -0.15, -0.03).getStyle()
      : new THREE.Color(bodyColor).offsetHSL(0, 0, -0.05).getStyle();
    const darkColor = new THREE.Color(bodyColor).offsetHSL(0, 0, -0.15).getStyle();
    const seamColor = new THREE.Color(bodyColor).multiplyScalar(0.2).getStyle();

    const matProps = COUNTERTOP_MATERIAL_PROPS[block.countertopMaterial] || COUNTERTOP_MATERIAL_PROPS.quartz;
    const ctColor = matProps.tint(block.countertopColor);
    const handleProps = HANDLE_PROPS[block.handleStyle] || HANDLE_PROPS.bar;

    const hasCountertop = bt === 'base-cabinet' || bt === 'island' ||
      bt === 'appliance-sink' || bt === 'appliance-stove' || bt === 'appliance-dishwasher' || bt === 'countertop';
    const hasToeKick = bt === 'base-cabinet' || bt === 'island' || bt === 'tall-cabinet' ||
      bt === 'appliance-fridge' || bt === 'appliance-stove' || bt === 'appliance-sink' || bt === 'appliance-dishwasher';

    // Toe kick dims
    const toeH = 0.10; // 10cm
    const toeInset = 0.03; // 3cm recessed

    // Get procedural texture
    const ctTexture = block.countertopMaterial !== 'steel'
      ? getOrCreateProceduralTexture(block.countertopMaterial, block.countertopColor)
      : null;

    // Check for PBR material override
    let pbrAlbedo: THREE.Texture | null = null;
    let pbrNormal: THREE.Texture | null = null;
    let pbrRoughness: THREE.Texture | null = null;
    if (block.countertopMaterialId) {
      const mat = materials.find(m => m.id === block.countertopMaterialId);
      if (mat) {
        if (mat.albedo) pbrAlbedo = loadPBRTexture(mat.albedo);
        if (mat.normal) pbrNormal = loadPBRTexture(mat.normal);
        if (mat.roughness) pbrRoughness = loadPBRTexture(mat.roughness);
      }
    }

    const countertopTexProps: Record<string, THREE.Texture> = {};
    if (pbrAlbedo) countertopTexProps.map = pbrAlbedo;
    else if (ctTexture) countertopTexProps.map = ctTexture;
    if (pbrNormal) countertopTexProps.normalMap = pbrNormal;
    if (pbrRoughness) countertopTexProps.roughnessMap = pbrRoughness;

    const bodyTop = hasToeKick ? h - toeH : h;
    const bodyYCenter = hasToeKick ? toeH + bodyTop / 2 : h / 2;

    return { w, h, d, bodyColor, frontColor, darkColor, seamColor, ctColor, matProps, handleProps, hasCountertop, hasToeKick, toeH, toeInset, bt, isAppliance, bodyTop, bodyYCenter, countertopTexProps };
  }, [block.width, block.height, block.depth, block.cabinetColor, block.countertopColor, block.countertopMaterial, block.countertopMaterialId, block.handleStyle, block.blockType, materials]);

  const { w, h, d, bodyColor, frontColor, darkColor, seamColor, ctColor, matProps, handleProps, hasCountertop, hasToeKick, toeH, toeInset, bt, isAppliance, bodyTop, bodyYCenter, countertopTexProps } = geometry;

  const meshes = useMemo(() => {
    const elements: React.ReactNode[] = [];
    const showHandle = block.handleStyle !== 'none' && block.handleStyle !== 'integrated';

    /* ── Toe kick (recessed bottom strip) ── */
    if (hasToeKick) {
      elements.push(
        <mesh key="toe" position={[0, toeH / 2, -toeInset / 2]} castShadow>
          <boxGeometry args={[w - 0.004, toeH, d - toeInset]} />
          <meshStandardMaterial color={darkColor} roughness={0.8} />
        </mesh>
      );
    }

    /* ── Main body ── */
    elements.push(
      <mesh key="body" position={[0, bodyYCenter, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyTop, d]} />
        <meshStandardMaterial color={bodyColor} roughness={0.7} />
      </mesh>
    );

    /* ── Front face accent ── */
    elements.push(
      <mesh key="front" position={[0, bodyYCenter, d / 2 + 0.001]} castShadow>
        <planeGeometry args={[w - 0.01, bodyTop - 0.01]} />
        <meshStandardMaterial color={frontColor} roughness={isAppliance ? 0.3 : 0.5} metalness={isAppliance ? 0.4 : 0} />
      </mesh>
    );

    /* ── Panel insets (door look) ── */
    if (bt === 'base-cabinet' || bt === 'island' || bt === 'wall-cabinet') {
      const insetBorder = 0.008;
      const insetW = w / 2 - insetBorder * 2 - 0.003;
      const insetH = bodyTop - insetBorder * 2;
      const insetColor = new THREE.Color(frontColor).offsetHSL(0, 0, -0.15).getStyle();

      // Left panel inset
      elements.push(
        <mesh key="inset-l" position={[-w / 4, bodyYCenter, d / 2 + 0.006]} castShadow>
          <planeGeometry args={[insetW, insetH]} />
          <meshStandardMaterial color={insetColor} roughness={0.55} />
        </mesh>
      );
      // Right panel inset
      elements.push(
        <mesh key="inset-r" position={[w / 4, bodyYCenter, d / 2 + 0.006]} castShadow>
          <planeGeometry args={[insetW, insetH]} />
          <meshStandardMaterial color={insetColor} roughness={0.55} />
        </mesh>
      );
      // Center seam
      elements.push(
        <mesh key="seam" position={[0, bodyYCenter, d / 2 + 0.007]}>
          <boxGeometry args={[0.003, bodyTop - 0.01, 0.002]} />
          <meshStandardMaterial color={seamColor} roughness={0.6} />
        </mesh>
      );
    }

    /* ── Tall cabinet: two-zone front ── */
    if (bt === 'tall-cabinet') {
      const splitY = hasToeKick ? toeH + bodyTop * 0.6 : h * 0.6;
      const insetBorder = 0.008;
      const insetW = w - insetBorder * 2;
      const insetColor = new THREE.Color(frontColor).offsetHSL(0, 0, -0.15).getStyle();

      // Upper panel
      const upperH = h - splitY - insetBorder;
      elements.push(
        <mesh key="tall-upper" position={[0, splitY + upperH / 2, d / 2 + 0.002]}>
          <planeGeometry args={[insetW, upperH]} />
          <meshStandardMaterial color={insetColor} roughness={0.55} />
        </mesh>
      );
      // Lower panel
      const lowerH = splitY - (hasToeKick ? toeH : 0) - insetBorder;
      elements.push(
        <mesh key="tall-lower" position={[0, (hasToeKick ? toeH : 0) + insetBorder / 2 + lowerH / 2, d / 2 + 0.002]}>
          <planeGeometry args={[insetW, lowerH]} />
          <meshStandardMaterial color={insetColor} roughness={0.55} />
        </mesh>
      );
      // Horizontal seam
      elements.push(
        <mesh key="tall-seam" position={[0, splitY, d / 2 + 0.003]}>
          <boxGeometry args={[w - 0.01, 0.003, 0.002]} />
          <meshStandardMaterial color={seamColor} roughness={0.6} />
        </mesh>
      );
    }

    /* ── Wall cabinet: bottom edge trim ── */
    if (bt === 'wall-cabinet') {
      elements.push(
        <mesh key="wall-trim" position={[0, (hasToeKick ? toeH : 0) + 0.005, d / 2 + 0.002]}>
          <boxGeometry args={[w, 0.01, 0.005]} />
          <meshStandardMaterial color={darkColor} roughness={0.5} />
        </mesh>
      );
    }

    /* ── Handle ── */
    if (showHandle) {
      if (bt === 'appliance-fridge') {
        // Vertical bar handle
        elements.push(
          <mesh key="handle" position={[w * 0.35, bodyYCenter, d / 2 + 0.015]} castShadow>
            <boxGeometry args={[0.01, bodyTop * 0.6, 0.015]} />
            <meshStandardMaterial color={handleProps.color} metalness={handleProps.metalness} roughness={handleProps.roughness} />
          </mesh>
        );
      } else {
        elements.push(
          <mesh key="handle" position={[0.03, bodyYCenter + bodyTop * 0.17, d / 2 + 0.012]} castShadow>
            {block.handleStyle === 'knob' ? (
              <sphereGeometry args={[0.0125, 12, 12]} />
            ) : (
              <boxGeometry args={[0.12, 0.01, 0.015]} />
            )}
            <meshStandardMaterial color={handleProps.color} metalness={handleProps.metalness} roughness={handleProps.roughness} />
          </mesh>
        );
      }
    }

    /* ── Countertop slab with overhang ── */
    if (hasCountertop) {
      elements.push(
        <mesh key="countertop" position={[0, h + 0.015, 0.01]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.02, 0.03, d + 0.02]} />
          <meshStandardMaterial
            color={ctColor}
            roughness={matProps.roughness}
            metalness={matProps.metalness}
            {...countertopTexProps}
          />
        </mesh>
      );
      // Front edge strip (slightly beveled look)
      elements.push(
        <mesh key="ct-edge" position={[0, h + 0.003, d / 2 + 0.015]}>
          <boxGeometry args={[w + 0.02, 0.006, 0.004]} />
          <meshStandardMaterial color={ctColor} roughness={matProps.roughness * 0.8} metalness={matProps.metalness} />
        </mesh>
      );
    }

    /* ── Appliance-specific details ── */

    // Fridge: freezer/fridge gap line
    if (bt === 'appliance-fridge') {
      const gapY = hasToeKick ? toeH + bodyTop * 0.7 : h * 0.7;
      elements.push(
        <mesh key="fridge-gap" position={[0, gapY, d / 2 + 0.003]}>
          <boxGeometry args={[w - 0.01, 0.003, 0.002]} />
          <meshStandardMaterial color={seamColor} roughness={0.5} />
        </mesh>
      );
      // Recessed front panel
      const insetColor = new THREE.Color(frontColor).offsetHSL(0, 0, -0.03).getStyle();
      elements.push(
        <mesh key="fridge-panel" position={[0, bodyYCenter, d / 2 + 0.002]}>
          <planeGeometry args={[w - 0.03, bodyTop - 0.03]} />
          <meshStandardMaterial color={insetColor} roughness={0.3} metalness={0.3} />
        </mesh>
      );
    }

    // Stove: burners + oven door + handle + window
    if (bt === 'appliance-stove') {
      // Burner rings
      const burnerPositions = [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]];
      burnerPositions.forEach(([bx, bz], i) => {
        elements.push(
          <mesh key={`burner-${i}`} position={[bx, h + 0.032, bz]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.02, 0.035, 16]} />
            <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
          </mesh>
        );
      });
      // Oven door panel
      const ovenTop = hasToeKick ? toeH + bodyTop * 0.65 : h * 0.65;
      const ovenBottom = hasToeKick ? toeH + 0.02 : 0.02;
      const ovenH = ovenTop - ovenBottom;
      elements.push(
        <mesh key="oven-door" position={[0, ovenBottom + ovenH / 2, d / 2 + 0.002]}>
          <planeGeometry args={[w - 0.03, ovenH]} />
          <meshStandardMaterial color={new THREE.Color(frontColor).offsetHSL(0, 0, -0.05).getStyle()} roughness={0.35} metalness={0.3} />
        </mesh>
      );
      // Oven window (dark glass)
      elements.push(
        <mesh key="oven-window" position={[0, ovenBottom + ovenH * 0.6, d / 2 + 0.003]}>
          <planeGeometry args={[w * 0.5, ovenH * 0.35]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.2} transparent opacity={0.8} />
        </mesh>
      );
      // Oven handle bar
      elements.push(
        <mesh key="oven-handle" position={[0, ovenTop - 0.02, d / 2 + 0.012]}>
          <boxGeometry args={[w * 0.6, 0.008, 0.012]} />
          <meshStandardMaterial color={handleProps.color} metalness={handleProps.metalness} roughness={handleProps.roughness} />
        </mesh>
      );
    }

    // Sink: basin + faucet
    if (bt === 'appliance-sink') {
      elements.push(
        <mesh key="basin" position={[0, h + 0.01, 0]}>
          <boxGeometry args={[w * 0.6, 0.04, d * 0.5]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.2} />
        </mesh>
      );
      // Faucet stem
      elements.push(
        <mesh key="faucet-stem" position={[0, h + 0.06, -d * 0.3]}>
          <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.15} />
        </mesh>
      );
      // Faucet spout (arc approximation — horizontal cylinder)
      elements.push(
        <mesh key="faucet-spout" position={[0, h + 0.10, -d * 0.18]} rotation={[Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.08, 8]} />
          <meshStandardMaterial color="#b0b0b0" metalness={0.8} roughness={0.15} />
        </mesh>
      );
    }

    // Dishwasher: front panel + handle + status strip
    if (bt === 'appliance-dishwasher') {
      const insetColor = new THREE.Color(frontColor).offsetHSL(0, 0, -0.03).getStyle();
      elements.push(
        <mesh key="dw-panel" position={[0, bodyYCenter, d / 2 + 0.002]}>
          <planeGeometry args={[w - 0.03, bodyTop - 0.03]} />
          <meshStandardMaterial color={insetColor} roughness={0.35} metalness={0.3} />
        </mesh>
      );
      // Handle bar
      if (showHandle) {
        elements.push(
          <mesh key="dw-handle" position={[0, bodyYCenter + bodyTop * 0.3, d / 2 + 0.012]}>
            <boxGeometry args={[w * 0.6, 0.008, 0.012]} />
            <meshStandardMaterial color={handleProps.color} metalness={handleProps.metalness} roughness={handleProps.roughness} />
          </mesh>
        );
      }
      // Status indicator strip
      elements.push(
        <mesh key="dw-status" position={[0, h - (hasToeKick ? 0 : 0) - 0.02, d / 2 + 0.003]}>
          <boxGeometry args={[w * 0.3, 0.004, 0.002]} />
          <meshStandardMaterial color="#4488ff" emissive="#4488ff" emissiveIntensity={0.3} roughness={0.2} />
        </mesh>
      );
    }

    return elements;
  }, [w, h, d, bodyColor, frontColor, darkColor, seamColor, ctColor, matProps, handleProps, hasCountertop, hasToeKick, toeH, toeInset, bt, isAppliance, bodyTop, bodyYCenter, countertopTexProps, block.handleStyle]);

  return <group>{meshes}</group>;
};

/* ── Main component ── */
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
      onClick={(e) => { e.stopPropagation(); onClick?.(block.id); }}
      onPointerDown={(e) => { if (onDragStart) { e.stopPropagation(); onDragStart(block.id, e as any); } }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {block.modelUrl ? (
        <KitchenGLTFModel modelUrl={block.modelUrl} width={block.width} height={block.height} depth={block.depth} />
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
