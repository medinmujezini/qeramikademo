/**
 * Design Tab - Unified 3D Furniture and Fixture Placement
 * 
 * A 3D-first experience where users place both furniture and fixtures
 * directly in the room using drag-and-drop from a unified library.
 * Click on walls/floor to apply surface treatments (paint, wallpaper, tiles).
 */

import React, { Suspense, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { SpawnPointMarker, type SpawnPoint } from '@/components/3d/SpawnPointMarker';
import { WalkthroughOverlay } from '@/components/3d/WalkthroughOverlay';
import { Canvas, useThree, useFrame, useLoader, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, PointerLockControls } from '@react-three/drei';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { useFurnitureContext } from '@/contexts/FurnitureContext';
import { useMEPContext } from '@/contexts/MEPContext';
import { useMaterialContext } from '@/contexts/MaterialContext';
import { FurnitureScene } from '@/components/3d/FurnitureScene';
import { FixtureScene } from '@/components/3d/FixtureScene';
import { RenderPipelineController } from '@/components/3d/RenderPipelineController';
import { UnifiedLibrary } from '@/components/design/UnifiedLibrary';
import { DesignPropertiesPanel } from '@/components/design/DesignPropertiesPanel';
import { QualitySettingsPanel, QualitySettings, DEFAULT_QUALITY_SETTINGS } from '@/components/design/QualitySettingsPanel';
import { WallSurfaceDialog } from '@/components/3d/WallSurfaceDialog';
import { FloorSurfaceDialog } from '@/components/3d/FloorSurfaceDialog';
import { TiledWall3D } from '@/components/3d/TiledWall3D';
import { Ceiling3D } from '@/components/3d/Ceiling3D';
import { RoomLightMarker } from '@/components/3d/RoomLightMarker';
import { GIQualityTier } from '@/gi/GIConfig';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Eye, EyeOff, Grid3X3, Droplets, RotateCcw, Move3D, Settings2, Camera, Download, Loader2, PanelRightClose, PanelRight, LayoutGrid, Mountain, Box, Bookmark, Trash2, Play, PersonStanding, X, MousePointer, Lightbulb } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import * as THREE from 'three';
import { TILE_LIBRARY } from '@/types/floorPlan';
import type { Wall, Point, TilePattern, WallFinish, FloorSurfaceType, Tile, TileTextureUrls } from '@/types/floorPlan';
import { useTileTemplates } from '@/hooks/useTemplatesFromDB';
import { PAINT_COLORS, WALLPAPER_PATTERNS } from '@/types/floorPlan';
import { createTilePatternCanvas } from '@/utils/tileRenderer';
import { isFixturePositionValid } from '@/utils/fixtureCollision';
import { createWallShapeWithOpenings } from '@/utils/wallOpeningGeometry';
import { exportSceneToGLBBlob } from '@/utils/glbExporter';
import { generateRoomManifest } from '@/utils/roomManifest';
import { isInsideUnreal, startUnrealWalkthrough, onExitWalkthrough, arrayBufferToBase64 } from '@/utils/unrealBridge';
import { toast } from 'sonner';
import type { FurnitureTemplate } from '@/data/furnitureLibrary';
import type { FixtureTemplate } from '@/data/fixtureLibrary';
import type { MEPFixture } from '@/types/mep';

// Track walls with active tile animations
type TileAnimationState = Record<string, 'idle' | 'animating' | 'complete'>;

// Preview state for live paint/wallpaper preview
interface WallPreviewState {
  wallId: string;
  previewColor?: string | null;
  previewWallpaperId?: string | null;
}

// =============================================================================
// SCENE REF CAPTURER (must be inside Canvas to access useThree)
// =============================================================================

const SceneRefCapturer: React.FC<{ sceneRef: React.MutableRefObject<THREE.Scene | null> }> = ({ sceneRef: ref }) => {
  const { scene } = useThree();
  React.useEffect(() => { ref.current = scene; }, [scene, ref]);
  return null;
};

// CAMERA ANIMATOR (must be inside Canvas for useFrame)
// =============================================================================

const CameraAnimator: React.FC<{
  targetPos: React.MutableRefObject<THREE.Vector3>;
  targetTarget: React.MutableRefObject<THREE.Vector3>;
  isAnimating: React.MutableRefObject<boolean>;
  controlsRef: React.MutableRefObject<any>;
}> = ({ targetPos, targetTarget, isAnimating, controlsRef }) => {
  const { camera } = useThree();

  // Cancel animation on any user interaction with OrbitControls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onStart = () => { isAnimating.current = false; };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controlsRef, isAnimating]);

  useFrame(() => {
    if (!isAnimating.current || !controlsRef.current) return;
    camera.position.lerp(targetPos.current, 0.08);
    controlsRef.current.target.lerp(targetTarget.current, 0.08);
    controlsRef.current.update();
    if (
      camera.position.distanceTo(targetPos.current) < 0.05 &&
      controlsRef.current.target.distanceTo(targetTarget.current) < 0.05
    ) {
      camera.position.copy(targetPos.current);
      controlsRef.current.target.copy(targetTarget.current);
      controlsRef.current.update();
      isAnimating.current = false;
    }
  });
  return null;
};

// =============================================================================
// WALKTHROUGH MOVEMENT (must be inside Canvas for useFrame)
// =============================================================================

const WalkthroughMovement: React.FC<{
  viewMode: string;
  keysRef: React.MutableRefObject<{ w: boolean; a: boolean; s: boolean; d: boolean }>;
  walls: Wall[];
  points: Point[];
  furnitureItems: { position: { x: number; y: number }; dimensions: { width: number; depth: number }; rotation: number }[];
  moveStickRef: React.MutableRefObject<{ x: number; y: number }>;
  lookStickRef: React.MutableRefObject<{ x: number; y: number }>;
}> = ({ viewMode, keysRef, walls, points, furnitureItems, moveStickRef, lookStickRef }) => {
  const { camera } = useThree();
  const SPEED = 3.0;
  const EYE_HEIGHT = 1.6;
  const CLEARANCE = 0.3;
  const SCALE = 0.01;

  useFrame((_, dt) => {
    if (viewMode !== 'walkthrough') return;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    let dx = 0, dz = 0;
    if (keysRef.current.w) { dx += forward.x; dz += forward.z; }
    if (keysRef.current.s) { dx -= forward.x; dz -= forward.z; }
    if (keysRef.current.a) { dx -= right.x; dz -= right.z; }
    if (keysRef.current.d) { dx += right.x; dz += right.z; }

    // Joystick movement — camera-relative, same as WASD
    if (Math.abs(moveStickRef.current.x) > 0.05 || Math.abs(moveStickRef.current.y) > 0.05) {
      dx += right.x * moveStickRef.current.x * SPEED * dt;
      dz += right.z * moveStickRef.current.x * SPEED * dt;
      dx += forward.x * moveStickRef.current.y * SPEED * dt;
      dz += forward.z * moveStickRef.current.y * SPEED * dt;
    }

    // Joystick look — only on touch (desktop look handled by PointerLockControls)
    if (Math.abs(lookStickRef.current.x) > 0.05 || Math.abs(lookStickRef.current.y) > 0.05) {
      camera.rotation.order = 'YXZ';
      camera.rotation.y -= lookStickRef.current.x * 1.8 * dt;
      camera.rotation.x -= lookStickRef.current.y * 1.2 * dt;
      camera.rotation.x = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, camera.rotation.x));
    }

    if (dx === 0 && dz === 0) return;

    let newX = camera.position.x + dx * SPEED * dt;
    let newZ = camera.position.z + dz * SPEED * dt;

    // 2-pass push-out for smooth corner sliding
    for (let pass = 0; pass < 2; pass++) {
      // Wall collision (circle-vs-segment)
      for (const wall of walls) {
        const start = points.find(p => p.id === wall.startPointId);
        const end = points.find(p => p.id === wall.endPointId);
        if (!start || !end) continue;
        const ax = start.x * SCALE, az = start.y * SCALE;
        const bx = end.x * SCALE, bz = end.y * SCALE;
        const abx = bx - ax, abz = bz - az;
        const lenSq = abx * abx + abz * abz;
        if (lenSq === 0) continue;
        const t = Math.max(0, Math.min(1, ((newX - ax) * abx + (newZ - az) * abz) / lenSq));
        const closestX = ax + t * abx, closestZ = az + t * abz;
        const halfThick = (wall.thickness * SCALE) / 2;
        const minDist = halfThick + CLEARANCE;
        const distX = newX - closestX, distZ = newZ - closestZ;
        const dist = Math.sqrt(distX * distX + distZ * distZ);
        if (dist < minDist && dist > 0.001) {
          newX = closestX + (distX / dist) * minDist;
          newZ = closestZ + (distZ / dist) * minDist;
        }
      }

      // Furniture collision (circle-vs-OBB, 4 edges per item)
      for (const item of furnitureItems) {
        const cx = item.position.x * SCALE;
        const cz = item.position.y * SCALE;
        const hw = (item.dimensions.width * SCALE) / 2;
        const hd = (item.dimensions.depth * SCALE) / 2;
        const rad = -(item.rotation || 0) * (Math.PI / 180);
        const cosR = Math.cos(rad), sinR = Math.sin(rad);

        // 4 corners of the oriented bounding box
        const corners = [
          { x: cx + (-hw) * cosR - (-hd) * sinR, z: cz + (-hw) * sinR + (-hd) * cosR },
          { x: cx + ( hw) * cosR - (-hd) * sinR, z: cz + ( hw) * sinR + (-hd) * cosR },
          { x: cx + ( hw) * cosR - ( hd) * sinR, z: cz + ( hw) * sinR + ( hd) * cosR },
          { x: cx + (-hw) * cosR - ( hd) * sinR, z: cz + (-hw) * sinR + ( hd) * cosR },
        ];

        // Check each edge as a segment
        for (let i = 0; i < 4; i++) {
          const c1 = corners[i], c2 = corners[(i + 1) % 4];
          const ex = c2.x - c1.x, ez = c2.z - c1.z;
          const eLenSq = ex * ex + ez * ez;
          if (eLenSq === 0) continue;
          const et = Math.max(0, Math.min(1, ((newX - c1.x) * ex + (newZ - c1.z) * ez) / eLenSq));
          const closestX = c1.x + et * ex, closestZ = c1.z + et * ez;
          const fdx = newX - closestX, fdz = newZ - closestZ;
          const fDist = Math.sqrt(fdx * fdx + fdz * fdz);
          if (fDist < CLEARANCE && fDist > 0.001) {
            newX = closestX + (fdx / fDist) * CLEARANCE;
            newZ = closestZ + (fdz / fDist) * CLEARANCE;
          }
        }
      }
    }

    camera.position.set(newX, EYE_HEIGHT, newZ);
  });
  return null;
};

// =============================================================================
// 3D SCENE COMPONENTS
// =============================================================================

interface DesignSceneProps {
  showTiles: boolean;
  showPlumbing: boolean;
  showCeiling: boolean;
  giEnabled: boolean;
  giQuality: GIQualityTier;
  qualitySettings: QualitySettings;
  onPipelineError?: (error: Error) => void;
  onWallClick?: (wall: Wall, start: Point, end: Point) => void;
  onFloorClick?: () => void;
  // Preview and animation state
  wallPreview?: WallPreviewState | null;
  tileAnimations?: TileAnimationState;
  onTileAnimationComplete?: (wallId: string) => void;
  // Tile lookup function
  findTile: (tileId: string, wallFinish?: WallFinish) => Tile | null;
  // Floor plan data passed as props (required for R3F Canvas context isolation)
  floorPlan: import('@/types/floorPlan').FloorPlan;
}

const Wall3D = ({
  wall,
  start,
  end,
  scale,
  tileSection,
  wallFinish,
  onWallClick,
  previewColor,
  previewWallpaperId,
  doors = [],
  windows = [],
}: {
  wall: Wall;
  start: { x: number; y: number };
  end: { x: number; y: number };
  scale: number;
  tileSection: any | null;
  wallFinish?: WallFinish;
  onWallClick?: (wall: Wall, start: Point, end: Point) => void;
  previewColor?: string | null;
  previewWallpaperId?: string | null;
  doors?: import('@/types/floorPlan').Door[];
  windows?: import('@/types/floorPlan').Window[];
}) => {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  
  // Drag threshold detection to prevent orbit from triggering clicks
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5; // pixels

  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2) * scale;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const midX = (start.x + end.x) / 2 * scale;
  const midZ = (start.y + end.y) / 2 * scale;
  const wallLength = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  
  const startHeight = (wall.startHeight ?? wall.height) * scale;
  const endHeight = (wall.endHeight ?? wall.height) * scale;
  const wallThickness = wall.thickness * scale;

  React.useEffect(() => {
    if (tileSection) {
      const tile = TILE_LIBRARY.find(t => t.id === tileSection.tileId);
      if (tile) {
        const canvas = createTilePatternCanvas(tile, wallLength, wall.height, 3, 0.5);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        setTexture(tex);
        
        return () => {
          tex.dispose();
        };
      }
    } else {
      setTexture(null);
    }
  }, [tileSection, wallLength, wall.height]);

  const getWallColor = () => {
    // Live preview takes priority
    if (previewColor) {
      return previewColor;
    }
    if (previewWallpaperId) {
      const pattern = WALLPAPER_PATTERNS.find(p => p.id === previewWallpaperId);
      return pattern?.baseColor || '#e5e7eb';
    }
    if (texture) return '#ffffff';
    // Check for paint finish
    if (wallFinish?.surfaceType === 'paint' && wallFinish.color) {
      return wallFinish.color;
    }
    // Check for wallpaper finish
    if (wallFinish?.surfaceType === 'wallpaper' && wallFinish.patternId) {
      const pattern = WALLPAPER_PATTERNS.find(p => p.id === wallFinish.patternId);
      return pattern?.baseColor || '#e5e7eb';
    }
    switch (wall.material) {
      case 'concrete': return '#9ca3af';
      case 'brick': return '#b45309';
      case 'wood': return '#92400e';
      case 'drywall':
      default: return '#e5e7eb';
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    
    // Check if this was a drag (orbit) or a real click
    if (pointerDownPos.current) {
      const dx = Math.abs(e.nativeEvent.clientX - pointerDownPos.current.x);
      const dy = Math.abs(e.nativeEvent.clientY - pointerDownPos.current.y);
      
      // Only trigger click if movement was below threshold
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
        if (onWallClick) {
          onWallClick(wall, start as Point, end as Point);
        }
      }
    }
    pointerDownPos.current = null;
  };

  const geometry = useMemo(() => {
    const halfThick = wallThickness / 2;

    const shape = createWallShapeWithOpenings({
      wallLength: length,
      startHeight,
      endHeight,
      doors,
      windows,
      unitScale: scale,
    });
    
    const extrudeSettings = {
      depth: wallThickness,
      bevelEnabled: false,
    };
    
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(0, 0, -halfThick);
    
    return geo;
  }, [length, startHeight, endHeight, wallThickness, doors, windows, scale]);

  const yPosition = 0;

  return (
    <mesh
      position={[midX, yPosition, midZ]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
      geometry={geometry}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {texture ? (
        <meshStandardMaterial map={texture} roughness={0.7} side={THREE.DoubleSide} />
      ) : (
        <meshStandardMaterial color={getWallColor()} roughness={0.9} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
};

/** Wrapper that resolves materialId → textureUrls before rendering TiledWall3D */
const TiledWall3DWithMaterial: React.FC<
  React.ComponentProps<typeof TiledWall3D>
> = (props) => {
  const { materials: pbrMaterials } = useMaterialContext();
  const mat = pbrMaterials.find(m => m.id === props.tile.materialId);
  const textureUrls: TileTextureUrls | undefined = mat ? {
    albedo: mat.albedo,
    normal: mat.normal,
    roughness: mat.roughness,
    ao: mat.ao,
    height: mat.height,
    metallic: mat.metallic,
  } : undefined;
  return (
    <TiledWall3D
      {...props}
      textureUrls={textureUrls}
      textureScaleCm={props.tile.textureScaleCm}
    />
  );
};

/** Default floor with laminate texture */
const DefaultFloorTexture: React.FC<{
  floorWidth: number;
  floorDepth: number;
}> = ({ floorWidth, floorDepth }) => {
  const [albedo, normal, rough] = useLoader(THREE.TextureLoader, [
    '/textures/default-floor.jpg',
    '/textures/default-floor-normal.jpg',
    '/textures/default-floor-roughness.jpg',
  ]);

  const [albedoTex, normalTex, roughTex] = useMemo(() => {
    const repeatX = (floorWidth * 100) / 100;
    const repeatY = (floorDepth * 100) / 100;

    const a = albedo.clone();
    a.wrapS = THREE.RepeatWrapping;
    a.wrapT = THREE.RepeatWrapping;
    a.colorSpace = THREE.SRGBColorSpace;
    a.repeat.set(repeatX, repeatY);

    const n = normal.clone();
    n.wrapS = THREE.RepeatWrapping;
    n.wrapT = THREE.RepeatWrapping;
    n.repeat.set(repeatX, repeatY);

    const r = rough.clone();
    r.wrapS = THREE.RepeatWrapping;
    r.wrapT = THREE.RepeatWrapping;
    r.repeat.set(repeatX, repeatY);

    return [a, n, r];
  }, [albedo, normal, rough, floorWidth, floorDepth]);

  return (
    <meshStandardMaterial
      map={albedoTex}
      normalMap={normalTex}
      roughnessMap={roughTex}
      metalness={0.0}
    />
  );
};

/** Floor mesh with PBR texture support */
const FloorWithTextureInner: React.FC<{
  urls: Record<string, string>;
  urlKeys: string[];
  textureScaleCm: number;
  floorWidth: number;
  floorDepth: number;
  fallbackColor: string;
}> = ({ urls, urlKeys, textureScaleCm, floorWidth, floorDepth, fallbackColor }) => {
  const textures = useLoader(
    THREE.TextureLoader,
    urlKeys.map(k => urls[k])
  );

  const textureProps = useMemo(() => {
    const props: Record<string, THREE.Texture> = {};
    const scaleCm = textureScaleCm || 30;
    const repeatX = (floorWidth * 100) / scaleCm;
    const repeatY = (floorDepth * 100) / scaleCm;

    urlKeys.forEach((key, i) => {
      const tex = textures[i].clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
      if (key === 'map') tex.colorSpace = THREE.SRGBColorSpace;
      props[key] = tex;
    });
    return props;
  }, [textures, urlKeys, textureScaleCm, floorWidth, floorDepth]);

  const hasAlbedo = 'map' in textureProps;

  return (
    <meshStandardMaterial
      {...textureProps}
      {...(!hasAlbedo ? { color: fallbackColor } : {})}
      roughness={1.0}
    />
  );
};

const FloorWithTexture: React.FC<{
  materialId: string;
  textureScaleCm: number;
  floorWidth: number;
  floorDepth: number;
  fallbackColor: string;
}> = ({ materialId, textureScaleCm, floorWidth, floorDepth, fallbackColor }) => {
  const { materials: pbrMaterials } = useMaterialContext();
  const mat = pbrMaterials.find(m => m.id === materialId);

  const urls = useMemo(() => {
    if (!mat) return {};
    const result: Record<string, string> = {};
    if (mat.albedo) result.map = mat.albedo;
    if (mat.normal) result.normalMap = mat.normal;
    if (mat.roughness) result.roughnessMap = mat.roughness;
    if (mat.ao) result.aoMap = mat.ao;
    if (mat.metallic) result.metalnessMap = mat.metallic;
    return result;
  }, [mat]);

  const urlKeys = Object.keys(urls);

  // No textures available — just use fallback color
  if (urlKeys.length === 0) {
    return <meshStandardMaterial color={fallbackColor} roughness={0.8} />;
  }

  return (
    <FloorWithTextureInner
      urls={urls}
      urlKeys={urlKeys}
      textureScaleCm={textureScaleCm}
      floorWidth={floorWidth}
      floorDepth={floorDepth}
      fallbackColor={fallbackColor}
    />
  );
};

const DesignScene: React.FC<DesignSceneProps> = ({
  showTiles,
  showPlumbing,
  showCeiling,
  giEnabled,
  giQuality,
  qualitySettings,
  onPipelineError,
  onWallClick,
  onFloorClick,
  wallPreview,
  tileAnimations,
  onTileAnimationComplete,
  findTile,
  floorPlan,
}) => {
  const { 
    fixtures, 
    selectedFixtureId, 
    setSelectedFixtureId, 
    moveFixture,
    rotateFixture,
    deleteFixture,
    isDraggingFixture,
    setIsDraggingFixture 
  } = useMEPContext();
  const { furniture } = useFurnitureContext();
  
  const scale = 0.01;

  const bounds = useMemo(() => {
    if (floorPlan.points.length === 0) return { minX: 0, maxX: 8, minY: 0, maxY: 6 };
    const xs = floorPlan.points.map(p => p.x);
    const ys = floorPlan.points.map(p => p.y);
    return {
      minX: Math.min(...xs) * scale,
      maxX: Math.max(...xs) * scale,
      minY: Math.min(...ys) * scale,
      maxY: Math.max(...ys) * scale
    };
  }, [floorPlan.points, scale]);

  const floorWidth = bounds.maxX - bounds.minX;
  const floorDepth = bounds.maxY - bounds.minY;
  const floorCenterX = (bounds.minX + bounds.maxX) / 2;
  const floorCenterZ = (bounds.minY + bounds.maxY) / 2;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={giEnabled ? 0.2 : 0.35} color="#e8eef5" />
      <directionalLight 
        position={[10, 15, 10]} 
        intensity={giEnabled ? 0.75 : 0.9} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-5, 8, -5]} intensity={giEnabled ? 0.15 : 0.2} color="#b8c5d6" />
      <hemisphereLight intensity={giEnabled ? 0.15 : 0.25} color="#87CEEB" groundColor="#8B7355" />
      
      {giEnabled && (
        <RenderPipelineController 
          enabled={giEnabled} 
          quality={giQuality}
          debugMode={17}
          runtimeSettings={{
            // SSAO
            ssaoEnabled: qualitySettings.ssaoEnabled,
            ssaoRadius: qualitySettings.ssaoRadius,
            ssaoIntensity: qualitySettings.ssaoIntensity,
            ssaoSamples: qualitySettings.ssaoSamples,
            ssaoBias: qualitySettings.ssaoBias,
            ssaoBlurSharpness: qualitySettings.ssaoBlurSharpness,
            // Shadows
            shadowSoftness: qualitySettings.shadowSoftness,
            shadowIntensity: qualitySettings.shadowIntensity,
            shadowDarkness: qualitySettings.shadowDarkness,
            contactShadowsEnabled: qualitySettings.contactShadowsEnabled,
            contactShadowsIntensity: qualitySettings.contactShadowsIntensity,
            // Lighting
            skyLightIntensity: qualitySettings.skyLightIntensity,
            // SSR
            ssrEnabled: qualitySettings.ssrEnabled,
            // Bloom
            bloomEnabled: qualitySettings.bloomEnabled,
            bloomIntensity: qualitySettings.bloomIntensity,
            bloomThreshold: qualitySettings.bloomThreshold,
            // Fake Mobile Bloom
            fakeMobileBloomEnabled: qualitySettings.fakeMobileBloomEnabled,
            fakeMobileBloomIntensity: qualitySettings.fakeMobileBloomIntensity,
            // Color Grading
            colorGradingEnabled: qualitySettings.colorGradingEnabled,
            contrast: qualitySettings.contrast,
            saturation: qualitySettings.saturation,
            brightness: qualitySettings.brightness,
            // Film Effects
            vignetteEnabled: qualitySettings.vignetteEnabled,
            vignetteIntensity: qualitySettings.vignetteIntensity,
            grainEnabled: qualitySettings.grainEnabled,
            grainIntensity: qualitySettings.grainIntensity,
          }}
          onError={onPipelineError}
        />
      )}
      
      {/* Floor */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[floorCenterX, 0, floorCenterZ]} 
        receiveShadow
        onPointerDown={(e) => {
          // Only register if the floor is the first intersected object (not furniture on top)
          if (e.intersections.length > 0 && e.intersections[0].object !== e.object) return;
          e.stopPropagation();
          (e.object as any)._pointerDownPos = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (e.intersections.length > 0 && e.intersections[0].object !== e.object) return;
          e.stopPropagation();
          const down = (e.object as any)._pointerDownPos;
          if (down) {
            const dx = e.clientX - down.x;
            const dy = e.clientY - down.y;
            if (Math.sqrt(dx * dx + dy * dy) < 5) {
              onFloorClick?.();
            }
          }
          (e.object as any)._pointerDownPos = null;
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <planeGeometry args={[floorWidth, floorDepth]} />
        {floorPlan.floorFinish?.materialId ? (
          <Suspense fallback={<meshStandardMaterial color={floorPlan.floorFinish?.color || "#f3f4f6"} roughness={0.8} />}>
            <FloorWithTexture
              materialId={floorPlan.floorFinish.materialId}
              textureScaleCm={floorPlan.floorFinish.textureScaleCm || 30}
              floorWidth={floorWidth}
              floorDepth={floorDepth}
              fallbackColor={floorPlan.floorFinish?.color || "#f3f4f6"}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<meshStandardMaterial color="#d4cdc5" roughness={0.5} />}>
            <DefaultFloorTexture floorWidth={floorWidth} floorDepth={floorDepth} />
          </Suspense>
        )}
      </mesh>

      {/* Walls */}
      {floorPlan.walls.map(wall => {
        const start = floorPlan.points.find(p => p.id === wall.startPointId);
        const end = floorPlan.points.find(p => p.id === wall.endPointId);
        if (!start || !end) return null;

        const tileSection = showTiles 
          ? floorPlan.tileSections.find(s => s.wallId === wall.id) 
          : null;
        
        const wallFinish = floorPlan.wallFinishes?.find(f => f.wallId === wall.id);
        const tileAnimState = tileAnimations?.[wall.id] || 'idle';
        
        // Check if this wall has tiles via wallFinish OR tileSection
        const hasTileFinish = wallFinish?.surfaceType === 'tiles' && wallFinish.tileId;
        const hasTileSection = showTiles && tileSection && tileSection.tileId;
        
        // Resolve tile: prefer wallFinish, fall back to tileSection
        const effectiveTileId = hasTileFinish ? wallFinish.tileId! : (hasTileSection ? tileSection.tileId : null);
        const tile = effectiveTileId ? findTile(effectiveTileId, wallFinish) : null;
        
        // Build effective tile config from whichever source has data
        const effectiveTileConfig = hasTileFinish ? {
          tileId: wallFinish.tileId!,
          groutColor: wallFinish.groutColor || '#9ca3af',
          pattern: wallFinish.pattern || 'grid',
          jointWidth: wallFinish.jointWidth,
          orientation: wallFinish.orientation,
          offsetX: wallFinish.offsetX,
          offsetY: wallFinish.offsetY,
        } : hasTileSection ? {
          tileId: tileSection.tileId,
          groutColor: tileSection.groutColor || '#9ca3af',
          pattern: tileSection.pattern || 'grid',
          jointWidth: 3,
          orientation: tileSection.orientation || 'horizontal',
          offsetX: tileSection.offsetX || 0,
          offsetY: tileSection.offsetY || 0,
        } : null;
        
        // Show 3D tiles if we have a valid tile from either source
        const shouldShow3DTiles = effectiveTileConfig && tile;

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const wallDoors = floorPlan.doors.filter(d => d.wallId === wall.id);
        const wallWindows = floorPlan.windows.filter(w => w.wallId === wall.id);

        // Get preview state for this wall
        const isPreviewWall = wallPreview?.wallId === wall.id;
        const previewColor = isPreviewWall ? wallPreview.previewColor : null;
        const previewWallpaperId = isPreviewWall ? wallPreview.previewWallpaperId : null;

        return (
          <group key={wall.id}>
            {/* Render animated 3D tiles if tile finish is applied */}
            {shouldShow3DTiles ? (
              <TiledWall3DWithMaterial
                wall={wall}
                start={start}
                end={end}
                tileConfig={effectiveTileConfig!}
                tile={tile!}
                scale={scale}
                animationState={tileAnimState}
                onAnimationComplete={() => onTileAnimationComplete?.(wall.id)}
                doors={wallDoors}
                windows={wallWindows}
              />
            ) : (
              <Wall3D 
                wall={wall} 
                start={start} 
                end={end} 
                scale={scale} 
                tileSection={tileSection}
                wallFinish={wallFinish}
                onWallClick={onWallClick}
                previewColor={previewColor}
                previewWallpaperId={previewWallpaperId}
                doors={wallDoors}
                windows={wallWindows}
              />
            )}

            {/* Doors */}
            {wallDoors.map(door => {
              const doorX = start.x + (end.x - start.x) * door.position;
              const doorY = start.y + (end.y - start.y) * door.position;
              const doorHeight = door.height * scale;
              
              return (
                <mesh
                  key={door.id}
                  position={[doorX * scale, doorHeight / 2, doorY * scale]}
                  rotation={[0, -angle, 0]}
                  castShadow
                >
                  <boxGeometry args={[door.width * scale, doorHeight, 0.03]} />
                  <meshStandardMaterial color="#8b5a2b" roughness={0.7} />
                </mesh>
              );
            })}

            {/* Windows */}
            {wallWindows.map(window => {
              const winX = start.x + (end.x - start.x) * window.position;
              const winY = start.y + (end.y - start.y) * window.position;
              const windowBottom = window.sillHeight * scale;
              const windowHeight = window.height * scale;
              
              return (
                <group key={window.id}>
                  <mesh
                    position={[winX * scale, windowBottom + windowHeight / 2, winY * scale]}
                    rotation={[0, -angle, 0]}
                  >
                    <boxGeometry args={[window.width * scale, windowHeight, wall.thickness * scale * 0.3]} />
                    <meshStandardMaterial color="#87ceeb" transparent opacity={0.4} roughness={0.1} />
                  </mesh>
                  <mesh
                    position={[winX * scale, windowBottom + windowHeight / 2, winY * scale]}
                    rotation={[0, -angle, 0]}
                  >
                    <boxGeometry args={[window.width * scale + 0.04, windowHeight + 0.04, wall.thickness * scale * 0.5]} />
                    <meshStandardMaterial color="#4b5563" roughness={0.8} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}

      {/* Fixture Scene with all interaction - mirrors FurnitureScene */}
      <FixtureScene 
        enableDrag={true} 
        enableSelection={true} 
        floorPlan={floorPlan}
        fixtures={fixtures}
        furniture={furniture}
        selectedFixtureId={selectedFixtureId}
        setSelectedFixtureId={setSelectedFixtureId}
        moveFixture={moveFixture}
        rotateFixture={rotateFixture}
        deleteFixture={deleteFixture}
        isDraggingFixture={isDraggingFixture}
        setIsDraggingFixture={setIsDraggingFixture}
      />

      {/* Plumbing Routes */}
      {showPlumbing && floorPlan.plumbingRoutes.map(route => {
        if (route.points.length < 2) return null;
        const points = route.points.map(p => new THREE.Vector3(p.x * scale, 0.05, p.y * scale));
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.02, 8, false);
        
        return (
          <mesh key={route.id} geometry={tubeGeometry}>
            <meshStandardMaterial color={route.type === 'water-supply' ? '#3b82f6' : '#92400e'} roughness={0.3} />
          </mesh>
        );
      })}

      {/* Main connection points */}
      <mesh position={[floorPlan.mainConnections.waterSupply.x * scale, 0.1, floorPlan.mainConnections.waterSupply.y * scale]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <mesh position={[floorPlan.mainConnections.drainage.x * scale, 0.1, floorPlan.mainConnections.drainage.y * scale]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>

      {/* Ceiling */}
      <Ceiling3D floorPlan={floorPlan} visible={showCeiling} />

      {/* Furniture Scene with all interaction */}
      <FurnitureScene enableDrag={true} enableSelection={true} floorPlan={floorPlan} />
    </>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface DesignTabProps {
  onOpenTilesTab?: (wallId: string) => void;
  animatingWallId?: string | null;
}

export const DesignTab: React.FC<DesignTabProps> = ({
  onOpenTilesTab,
  animatingWallId,
}) => {
  const { furniture, selectedFurnitureId, selectedFurniture, deleteFurniture, rotateFurnitureWithValidation, isDragging, addFurnitureWithCollisionCheck } = useFurnitureContext();
  const { fixtures, addFixture, isDraggingFixture } = useMEPContext();
  const [isDraggingSpawn, setIsDraggingSpawn] = useState(false);
  const { floorPlan, setWallFinish, removeWallFinish, setFloorFinish, removeFloorFinish, addCameraView, removeCameraView, addRoomLight, updateRoomLight, deleteRoomLight } = useFloorPlanContext();
  
  // Fetch tiles from database for 3D rendering
  const { data: dbTiles } = useTileTemplates();
  
  // Build combined tile library (database + static fallback)
  const tileLibrary = useMemo(() => {
    const combined: Tile[] = [];
    if (dbTiles && dbTiles.length > 0) {
      dbTiles.forEach(t => {
        combined.push({
          id: t.id,
          name: t.name,
          width: t.dimensions.width,
          height: t.dimensions.height,
          color: t.defaultColor,
          material: t.material as Tile['material'],
          pricePerUnit: t.pricePerUnit,
          isFlexible: t.isFlexible,
          minCurveRadius: t.minCurveRadius,
          materialId: t.materialId,
          textureScaleCm: t.textureScaleCm,
        });
      });
    }
    // Add static tiles as fallback
    TILE_LIBRARY.forEach(t => {
      if (!combined.find(ct => ct.id === t.id)) {
        combined.push(t);
      }
    });
    return combined;
  }, [dbTiles]);
  
  // Find tile by ID - checks library then falls back to cached data in wallFinish
  const findTile = useCallback((tileId: string, wallFinish?: WallFinish): Tile | null => {
    // First try the combined library
    const tile = tileLibrary.find(t => t.id === tileId);
    if (tile) return tile;
    
    // Fallback to cached tile data in wallFinish
    if (wallFinish?.tileWidth && wallFinish?.tileHeight) {
      return {
        id: tileId,
        name: 'Cached Tile',
        width: wallFinish.tileWidth,
        height: wallFinish.tileHeight,
        color: wallFinish.tileColor || '#cccccc',
        material: (wallFinish.tileMaterial || 'ceramic') as Tile['material'],
        pricePerUnit: 0,
      };
    }
    
    return null;
  }, [tileLibrary]);
  
  const [showTiles, setShowTiles] = useState(true);
  const [showPlumbing, setShowPlumbing] = useState(false);
  const [showCeiling, setShowCeiling] = useState(true);
  const [giEnabled, setGiEnabled] = useState(false);
  const [giQuality, setGiQuality] = useState<GIQualityTier>('high');
  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(DEFAULT_QUALITY_SETTINGS);
  const [viewMode, setViewMode] = useState<'design' | 'walkthrough'>('design');
  const [maxPolarAngle, setMaxPolarAngle] = useState(Math.PI / 2);
  const [isDraggingFromLibrary, setIsDraggingFromLibrary] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const [isPreparingWalkthrough, setIsPreparingWalkthrough] = useState(false);
  const [showSpawnMarker, setShowSpawnMarker] = useState(true);
  const [spawnPoint, setSpawnPoint] = useState<SpawnPoint>(() => {
    // Default spawn at room center
    const cx = (floorPlan.roomWidth || 800) / 2;
    const cy = (floorPlan.roomHeight || 600) / 2;
    return { position: { x: cx, y: cy }, rotation: 0 };
  });
  const orbitControlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const animTargetPos = useRef(new THREE.Vector3());
  const animTargetTarget = useRef(new THREE.Vector3());
  const isAnimatingCamera = useRef(false);
  const savedOrbitPos = useRef(new THREE.Vector3());
  const savedOrbitTarget = useRef(new THREE.Vector3());
  const plcRef = useRef<any>(null);
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const moveStickRef = useRef({ x: 0, y: 0 });
  const lookStickRef = useRef({ x: 0, y: 0 });
  const nippleManagersRef = useRef<{ left: any; right: any } | null>(null);
  const isTouchDevice = useMemo(() =>
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 0 &&
    !window.matchMedia('(hover: hover)').matches
  , []);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // Calculate room-based camera position
  const roomW = (floorPlan.roomWidth || 800) / 100;
  const roomH = (floorPlan.roomHeight || 600) / 100;

  const roomBounds = useMemo(() => {
    if (floorPlan.points.length === 0) {
      return {
        minX: 0,
        maxX: roomW,
        minZ: 0,
        maxZ: roomH,
        width: roomW,
        depth: roomH,
        centerX: roomW / 2,
        centerZ: roomH / 2,
      };
    }

    const xs = floorPlan.points.map((p) => p.x * 0.01);
    const zs = floorPlan.points.map((p) => p.y * 0.01);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    return {
      minX,
      maxX,
      minZ,
      maxZ,
      width: Math.max(maxX - minX, 0.1),
      depth: Math.max(maxZ - minZ, 0.1),
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
    };
  }, [floorPlan.points, roomW, roomH]);

  const presetCenterX = roomBounds.centerX;
  const presetCenterZ = roomBounds.centerZ;
  const presetMaxSpan = Math.max(roomBounds.width, roomBounds.depth);
  const camDist = Math.max(roomW, roomH) * 0.85;
  const defaultCameraPos: [number, number, number] = [roomW / 2 + camDist, camDist * 0.75, roomH / 2 + camDist];
  const defaultTarget: [number, number, number] = [roomW / 2, 0, roomH / 2];

  const handleResetView = useCallback(() => {
    if (cameraRef.current && orbitControlsRef.current) {
      setMaxPolarAngle(Math.PI / 2);
      isAnimatingCamera.current = false;
      cameraRef.current.position.set(...defaultCameraPos);
      orbitControlsRef.current.target.set(...defaultTarget);
      orbitControlsRef.current.update();
    }
  }, [defaultCameraPos, defaultTarget]);

  const applyPreset = useCallback((pos: [number, number, number], target: [number, number, number], eyeLevel = false) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    const nextMaxPolarAngle = eyeLevel ? Math.PI : Math.PI / 2;
    setMaxPolarAngle(nextMaxPolarAngle);
    orbitControlsRef.current.maxPolarAngle = nextMaxPolarAngle;
    animTargetPos.current.set(...pos);
    animTargetTarget.current.set(...target);
    isAnimatingCamera.current = true;
  }, []);

  // Pointer lock state tracking
  useEffect(() => {
    const onChange = () => setIsPointerLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  // Enter/exit walkthrough — auto-exports GLB for Unreal
  const enterWalkthrough = useCallback(async () => {
    if (cameraRef.current) savedOrbitPos.current.copy(cameraRef.current.position);
    if (orbitControlsRef.current) savedOrbitTarget.current.copy(orbitControlsRef.current.target);

    // Show loading overlay while generating GLB
    setIsPreparingWalkthrough(true);

    try {
      const scene = sceneRef.current;
      if (scene) {
        const glbBlob = await exportSceneToGLBBlob(scene);
        const manifest = generateRoomManifest(floorPlan, 'local', 1, spawnPoint);

        if (isInsideUnreal()) {
          const buffer = await glbBlob.arrayBuffer();
          const glbBase64 = arrayBufferToBase64(buffer);
          startUnrealWalkthrough(glbBase64, manifest as unknown as Record<string, unknown>);
          toast.success('Walkthrough started in Unreal Engine');
        }
      }
    } catch (error) {
      console.error('Walkthrough export error:', error);
      toast.error('Failed to prepare walkthrough', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsPreparingWalkthrough(false);
      return;
    }

    // Transition to walkthrough view — use spawn point position
    const SCALE = 0.01;
    const spawnX = spawnPoint.position.x * SCALE;
    const spawnZ = spawnPoint.position.y * SCALE;
    const spawnRad = -(spawnPoint.rotation * Math.PI) / 180;

    if (cameraRef.current) {
      cameraRef.current.position.set(spawnX, 1.6, spawnZ);
      cameraRef.current.rotation.order = 'YXZ';
      cameraRef.current.rotation.y = spawnRad;
    }
    isAnimatingCamera.current = false;
    setIsPreparingWalkthrough(false);
    setShowSpawnMarker(false);
    setViewMode('walkthrough');
  }, [floorPlan, spawnPoint, isAnimatingCamera]);

  const exitWalkthrough = useCallback(() => {
    document.exitPointerLock();
    setViewMode('design');
    setShowSpawnMarker(true);
    if (cameraRef.current) cameraRef.current.position.copy(savedOrbitPos.current);
    if (orbitControlsRef.current) {
      orbitControlsRef.current.target.copy(savedOrbitTarget.current);
      orbitControlsRef.current.update();
    }
  }, []);

  // WASD keyboard listeners for walkthrough
  useEffect(() => {
    if (viewMode !== 'walkthrough') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) keysRef.current[k as keyof typeof keysRef.current] = true;
      if (e.key === 'Escape') exitWalkthrough();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k in keysRef.current) keysRef.current[k as keyof typeof keysRef.current] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keysRef.current = { w: false, a: false, s: false, d: false };
    };
  }, [viewMode, exitWalkthrough]);

  // Nipple joystick managers for mobile walkthrough
  useEffect(() => {
    if (viewMode !== 'walkthrough' || !isTouchDevice) return;
    let aborted = false;
    import('nipplejs').then(({ default: nipplejs }) => {
      if (aborted) return;
      const leftZone = document.getElementById('left-joystick-zone');
      const rightZone = document.getElementById('right-joystick-zone');
      if (!leftZone || !rightZone) return;
      const left = nipplejs.create({ zone: leftZone, mode: 'static', position: { left: '50%', bottom: '50%' }, color: 'white', size: 100 });
      const right = nipplejs.create({ zone: rightZone, mode: 'static', position: { left: '50%', bottom: '50%' }, color: 'white', size: 100 });
      left.on('move', (_, data) => { moveStickRef.current = { x: data.vector.x, y: data.vector.y }; });
      left.on('end', () => { moveStickRef.current = { x: 0, y: 0 }; });
      right.on('move', (_, data) => { lookStickRef.current = { x: data.vector.x, y: data.vector.y }; });
      right.on('end', () => { lookStickRef.current = { x: 0, y: 0 }; });
      nippleManagersRef.current = { left, right };
    });
    return () => {
      aborted = true;
      if (nippleManagersRef.current) {
        nippleManagersRef.current.left.destroy();
        nippleManagersRef.current.right.destroy();
        nippleManagersRef.current = null;
      }
      moveStickRef.current = { x: 0, y: 0 };
      lookStickRef.current = { x: 0, y: 0 };
    };
  }, [viewMode, isTouchDevice]);
  
  // Collapsible properties panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Render image state
  const [isRendering, setIsRendering] = useState(false);
  const [renderDialogOpen, setRenderDialogOpen] = useState(false);
  const [originalRender, setOriginalRender] = useState<string | null>(null);
  const [enhancedRender, setEnhancedRender] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  // Wall surface dialog state
  const [wallSurfaceDialogOpen, setWallSurfaceDialogOpen] = useState(false);
  const [selectedSurfaceWall, setSelectedSurfaceWall] = useState<{
    wall: Wall;
    start: Point;
    end: Point;
  } | null>(null);
  
  // Floor surface dialog state
  const [floorSurfaceDialogOpen, setFloorSurfaceDialogOpen] = useState(false);
  
  // Live preview state for paint/wallpaper
  const [wallPreview, setWallPreview] = useState<WallPreviewState | null>(null);
  
  // Tile animation state
  const [tileAnimations, setTileAnimations] = useState<TileAnimationState>({});
  
  const handlePipelineError = useCallback((error: Error) => {
    console.warn('[DesignTab] Pipeline error, falling back to basic lighting:', error);
    setGiEnabled(false);
  }, []);

  // Auto-open panel when furniture/fixture is selected
  useEffect(() => {
    if (selectedFurnitureId) {
      setIsPanelOpen(true);
    }
  }, [selectedFurnitureId]);

  // Handle canvas click to close panel (via onPointerMissed)
  const handleCanvasPointerMissed = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  // Render image functionality
  const handleRenderImage = useCallback(async () => {
    // Find the canvas element
    const canvasElement = canvasContainerRef.current?.querySelector('canvas');
    if (!canvasElement) {
      toast.error('Could not capture canvas');
      return;
    }

    setIsRendering(true);
    setRenderDialogOpen(true);
    setRenderError(null);
    setEnhancedRender(null);

    try {
      // Capture the canvas
      const imageDataUrl = canvasElement.toDataURL('image/png');
      setOriginalRender(imageDataUrl);

      // Send to AI for enhancement
      const { data, error } = await supabase.functions.invoke('enhance-render', {
        body: { imageDataUrl },
      });

      if (error) {
        throw new Error(error.message || 'Failed to enhance render');
      }

      if (!data.success || !data.enhancedImageUrl) {
        throw new Error(data.error || 'No enhanced image returned');
      }

      setEnhancedRender(data.enhancedImageUrl);
      toast.success('Render enhanced successfully!');
    } catch (error) {
      console.error('Render error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRenderError(errorMessage);
      toast.error('Failed to enhance render', { description: errorMessage });
    } finally {
      setIsRendering(false);
    }
  }, []);

  // Listen for Unreal exit walkthrough callback
  useEffect(() => {
    if (!isInsideUnreal()) return;
    return onExitWalkthrough(() => {
      exitWalkthrough();
    });
  }, [exitWalkthrough]);

  const handleDownloadRender = useCallback(() => {
    const imageUrl = enhancedRender || originalRender;
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `render-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [enhancedRender, originalRender]);

  // Handle external animation trigger from Index.tsx
  useEffect(() => {
    if (animatingWallId) {
      setTileAnimations(prev => ({ ...prev, [animatingWallId]: 'animating' }));
    }
  }, [animatingWallId]);
  
  // Preview callbacks
  const handlePreviewPaint = useCallback((wallId: string, color: string | null) => {
    setWallPreview(color ? { wallId, previewColor: color } : null);
  }, []);
  
  const handlePreviewWallpaper = useCallback((wallId: string, patternId: string | null) => {
    setWallPreview(patternId ? { wallId, previewWallpaperId: patternId } : null);
  }, []);
  
  // Tile animation complete callback
  const handleTileAnimationComplete = useCallback((wallId: string) => {
    setTileAnimations(prev => ({ ...prev, [wallId]: 'complete' }));
  }, []);

  // Handle wall click to open surface dialog
  const handleWallClick = useCallback((wall: Wall, start: Point, end: Point) => {
    setSelectedSurfaceWall({ wall, start, end });
    setWallSurfaceDialogOpen(true);
  }, []);

  // Handle floor click to open floor surface dialog
  const handleFloorClick = useCallback(() => {
    setFloorSurfaceDialogOpen(true);
  }, []);

  // Wall surface callbacks
  const handleApplyPaint = useCallback((wallId: string, color: string) => {
    setWallFinish(wallId, 'paint', { color });
    toast.success('Paint applied to wall');
  }, [setWallFinish]);

  const handleApplyWallpaper = useCallback((wallId: string, patternId: string) => {
    setWallFinish(wallId, 'wallpaper', { patternId });
    toast.success('Wallpaper applied to wall');
  }, [setWallFinish]);

  // Handle redirect to tiles tab (when user clicks "Tiles" in dialog)
  const handleOpenTilesTabInternal = useCallback((wallId: string) => {
    setWallSurfaceDialogOpen(false);
    onOpenTilesTab?.(wallId);
  }, [onOpenTilesTab]);

  const handleRemoveWallFinish = useCallback((wallId: string) => {
    removeWallFinish(wallId);
    toast.info('Wall finish removed');
  }, [removeWallFinish]);

  // Floor surface callbacks
  const handleApplyFloorFinish = useCallback((type: FloorSurfaceType, color: string, materialId?: string, textureScaleCm?: number) => {
    setFloorFinish(type as 'tiles' | 'hardwood' | 'carpet', { color, materialId, textureScaleCm });
    toast.success(`${type} applied to floor`);
  }, [setFloorFinish]);

  const handleApplyFloorTiles = useCallback((tileId: string, groutColor: string, pattern: TilePattern) => {
    setFloorFinish('tiles', { tileId, groutColor, pattern });
    toast.success('Tiles applied to floor');
  }, [setFloorFinish]);

  const handleRemoveFloorFinish = useCallback(() => {
    removeFloorFinish();
    toast.info('Floor finish removed');
  }, [removeFloorFinish]);

  // Get current wall finish for dialog
  const currentWallFinish = useMemo(() => {
    if (!selectedSurfaceWall) return undefined;
    const finish = floorPlan.wallFinishes?.find(f => f.wallId === selectedSurfaceWall.wall.id);
    const tileSection = floorPlan.tileSections.find(s => s.wallId === selectedSurfaceWall.wall.id);
    
    if (tileSection) {
      return { type: 'tiles' as const, tileId: tileSection.tileId };
    }
    if (finish) {
      return { 
        type: finish.surfaceType, 
        color: finish.color, 
        patternId: finish.patternId 
      };
    }
    return { type: 'plain' as const };
  }, [selectedSurfaceWall, floorPlan.wallFinishes, floorPlan.tileSections]);

  // Calculate floor area
  const floorArea = useMemo(() => {
    if (floorPlan.points.length < 3) return 0;
    // Simple bounding box area
    const xs = floorPlan.points.map(p => p.x);
    const ys = floorPlan.points.map(p => p.y);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  }, [floorPlan.points]);

  // Use validated rotation that checks for collisions with smart fallback
  const handleRotateSelected = useCallback(() => {
    if (selectedFurnitureId && selectedFurniture) {
      const currentRotation = selectedFurniture.rotation || 0;
      const requestedRotation = (currentRotation + 45) % 360;
      const result = rotateFurnitureWithValidation(
        selectedFurnitureId,
        requestedRotation,
        floorPlan.walls || [],
        floorPlan.points || []
      );
      
      if (!result.success) {
        toast.error('Cannot rotate - no valid orientation found', {
          duration: 1500,
          position: 'bottom-center',
        });
      } else if (result.actualRotation !== null && result.actualRotation !== requestedRotation) {
        const actualDelta = ((result.actualRotation - currentRotation) % 360 + 360) % 360;
        toast.info(`Rotated ${actualDelta}° to avoid collision`, {
          duration: 1500,
          position: 'bottom-center',
        });
      }
    }
  }, [selectedFurnitureId, selectedFurniture, rotateFurnitureWithValidation, floorPlan.walls, floorPlan.points]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedFurnitureId) {
      deleteFurniture(selectedFurnitureId);
    }
  }, [selectedFurnitureId, deleteFurniture]);

  // Handle drag over for drop zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (viewMode === 'walkthrough') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingFromLibrary(true);
  }, [viewMode]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set to false if we're leaving the container entirely
    if (!canvasContainerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingFromLibrary(false);
    }
  }, []);

  // Handle drop for furniture/fixtures from library
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (viewMode === 'walkthrough') return;
    e.preventDefault();
    setIsDraggingFromLibrary(false);
    
    const furnitureData = e.dataTransfer.getData('furniture-template');
    const fixtureData = e.dataTransfer.getData('fixture-template');
    
    // Calculate center of floor plan as drop position
    const getPlacementPosition = () => {
      if (floorPlan.points.length === 0) {
        return { x: 200, y: 200 };
      }
      const xs = floorPlan.points.map(p => p.x);
      const ys = floorPlan.points.map(p => p.y);
      return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
    };
    
    const position = getPlacementPosition();
    
    if (furnitureData) {
      try {
        const template = JSON.parse(furnitureData);
        const result = addFurnitureWithCollisionCheck(
          template,
          position,
          floorPlan.walls || [],
          floorPlan.points || []
        );
        
        if (!result.success) {
          toast.error('No space available to place this item', {
            duration: 2000,
            position: 'bottom-center',
          });
        } else if (result.wasAdjusted) {
          toast.info('Item placed at nearest available position', {
            duration: 1500,
            position: 'bottom-center',
          });
        }
      } catch (err) {
        console.error('Failed to parse furniture template:', err);
      }
    } else if (fixtureData) {
      try {
        const template = JSON.parse(fixtureData) as FixtureTemplate;
        
        // Create a temporary fixture object to check collision
        const tempFixture = {
          id: 'temp-collision-check',
          type: template.type,
          name: template.name,
          category: template.category,
          position: position,
          rotation: 0,
          dimensions: template.dimensions,
          connections: [],
          dfuValue: 1,
        };
        
        // Check if initial position is valid
        const initialResult = isFixturePositionValid(
          tempFixture,
          fixtures,
          furniture,
          floorPlan.walls || [],
          floorPlan.points || []
        );
        
        if (initialResult.valid) {
          addFixture(template, position);
        } else {
          // Search for nearest valid position in a spiral pattern
          const searchRadius = 50; // cm
          const step = 20; // cm
          let foundPosition: { x: number; y: number } | null = null;
          
          for (let r = step; r <= searchRadius && !foundPosition; r += step) {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
              const testPos = {
                x: position.x + Math.cos(angle) * r,
                y: position.y + Math.sin(angle) * r,
              };
              
              const testResult = isFixturePositionValid(
                { ...tempFixture, position: testPos },
                fixtures,
                furniture,
                floorPlan.walls || [],
                floorPlan.points || []
              );
              
              if (testResult.valid) {
                foundPosition = testPos;
                break;
              }
            }
          }
          
          if (foundPosition) {
            addFixture(template, foundPosition);
            toast.info('Fixture placed at nearest available position', {
              duration: 1500,
              position: 'bottom-center',
            });
          } else {
            toast.error('No space available to place this fixture', {
              duration: 2000,
              position: 'bottom-center',
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse fixture template:', err);
      }
    }
  }, [floorPlan, addFurnitureWithCollisionCheck, addFixture]);

  // Calculate counts for badges
  const furnitureCount = furniture.length;
  const fixtureCount = fixtures.length;

  return (
    <div className="h-full flex flex-col">
      {/* Layer 3 — contextual toolbar */}
      <div className="h-11 border-b px-4 flex flex-col items-center justify-center shrink-0 overflow-x-auto relative shimmer-border-top" style={{ borderColor: 'hsl(var(--primary) / 0.10)', background: 'linear-gradient(90deg, hsl(var(--card)), hsl(var(--card)) 40%, hsl(38 60% 68% / 0.03) 50%, hsl(var(--card)) 60%, hsl(var(--card)))' }}>
        <div className="gold-accent-line w-full absolute bottom-0 left-0" />
        <div className="pointer-events-none absolute -top-10 right-1/4 w-[250px] h-[120px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.04)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.02] to-transparent" />
        <div className="flex items-center gap-3 h-full">
          <div className="flex items-center gap-1.5">
            <Switch id="gi-enabled" checked={giEnabled} onCheckedChange={setGiEnabled} className="scale-75" />
            <Label htmlFor="gi-enabled" className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="uppercase tracking-wider gold-text-glow">Enhanced</span>
            </Label>
          </div>

          {viewMode === 'design' && giEnabled && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <Settings2 className="h-3 w-3" />
                  Settings
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <ScrollArea className="h-[400px]">
                  <QualitySettingsPanel settings={qualitySettings} onChange={setQualitySettings} disabled={!giEnabled} />
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          <div className="w-px h-4 bg-primary/15" />

          <div className="flex items-center gap-1.5">
            <Switch id="show-tiles" checked={showTiles} onCheckedChange={setShowTiles} className="scale-75" />
            <Label htmlFor="show-tiles" className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <Grid3X3 className="h-3 w-3" />
              <span className="uppercase tracking-wider">Tiles</span>
            </Label>
          </div>

          {viewMode === 'design' && (
            <>
              <div className="flex items-center gap-1.5">
                <Switch id="show-ceiling" checked={showCeiling} onCheckedChange={setShowCeiling} className="scale-75" />
                <Label htmlFor="show-ceiling" className="text-xs text-muted-foreground uppercase tracking-wider cursor-pointer">Ceiling</Label>
              </div>

              <div className="flex items-center gap-1.5">
                <Switch id="show-plumbing" checked={showPlumbing} onCheckedChange={setShowPlumbing} className="scale-75" />
                <Label htmlFor="show-plumbing" className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                  <Droplets className="h-3 w-3 text-blue-500" />
                  <span className="uppercase tracking-wider">Plumbing</span>
                </Label>
              </div>

              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => {
                const cx = (floorPlan.roomWidth || 800) / 2;
                const cy = (floorPlan.roomHeight || 600) / 2;
                addRoomLight(cx, cy);
                toast.success('Light added to ceiling');
              }}>
                <Lightbulb className="h-3 w-3" />
                Light
              </Button>

              <div className="w-px h-4 bg-primary/15" />

              <Badge variant="outline" className="text-[10px] h-5 gap-1 border-primary/20">{furnitureCount} Furn</Badge>
              <Badge variant="outline" className="text-[10px] h-5 gap-1 border-primary/20">{fixtureCount} Fix</Badge>

              <div className="w-px h-4 bg-primary/15" />

              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleRenderImage} disabled={isRendering}>
                {isRendering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                Render
              </Button>

              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleResetView}>
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>

              <div className="w-px h-4 bg-primary/15" />

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                const M = presetMaxSpan;
                const C: [number, number, number] = [presetCenterX, 0, presetCenterZ];
                applyPreset([presetCenterX + M * 0.85, M * 0.85 * 0.75, presetCenterZ + M * 0.85], C);
              }}><Box className="h-3 w-3" /></Button>

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                const C: [number, number, number] = [presetCenterX, 0, presetCenterZ];
                const fovRad = (50 * Math.PI) / 180;
                const containerW = canvasContainerRef.current?.clientWidth ?? 16;
                const containerH = canvasContainerRef.current?.clientHeight ?? 9;
                const aspect = containerW / Math.max(containerH, 1);
                const heightForDepth = (roomBounds.depth / 2) / Math.tan(fovRad / 2);
                const heightForWidth = (roomBounds.width / 2) / (Math.tan(fovRad / 2) * aspect);
                const topDownHeight = Math.max(heightForDepth, heightForWidth) * 1.2;
                applyPreset([presetCenterX, topDownHeight, presetCenterZ], C);
              }}><LayoutGrid className="h-3 w-3" /></Button>

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                const eyeTarget: [number, number, number] = [presetCenterX, 1.6, presetCenterZ];
                if (roomBounds.width >= roomBounds.depth) {
                  applyPreset([presetCenterX, 1.6, presetCenterZ + roomBounds.depth * 0.35], eyeTarget, true);
                } else {
                  applyPreset([presetCenterX + roomBounds.width * 0.35, 1.6, presetCenterZ], eyeTarget, true);
                }
              }}><Eye className="h-3 w-3" /></Button>

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                const M = presetMaxSpan;
                const C: [number, number, number] = [presetCenterX, 0, presetCenterZ];
                applyPreset([presetCenterX + M, M, presetCenterZ + M], C);
              }}><Mountain className="h-3 w-3" /></Button>

              <div className="w-px h-4 bg-primary/15" />

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative">
                    <Bookmark className={"h-3 w-3" + ((floorPlan.savedCameraViews?.length ?? 0) > 0 ? " fill-current" : "")} />
                    {(floorPlan.savedCameraViews?.length ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] rounded-full h-3 w-3 flex items-center justify-center">
                        {floorPlan.savedCameraViews!.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" side="bottom" align="end">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input type="text" placeholder="View name..." className="flex-1 h-7 px-2 text-xs rounded-md border border-input bg-background" id="save-view-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const name = e.currentTarget.value.trim();
                            if (!name || !cameraRef.current || !orbitControlsRef.current) return;
                            addCameraView({ id: crypto.randomUUID(), name, position: cameraRef.current.position.toArray() as [number, number, number], target: orbitControlsRef.current.target.toArray() as [number, number, number] });
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => {
                        const input = document.getElementById('save-view-input') as HTMLInputElement;
                        const name = input?.value.trim();
                        if (!name || !cameraRef.current || !orbitControlsRef.current) return;
                        addCameraView({ id: crypto.randomUUID(), name, position: cameraRef.current.position.toArray() as [number, number, number], target: orbitControlsRef.current.target.toArray() as [number, number, number] });
                        input.value = '';
                      }}>Save</Button>
                    </div>
                    <div className="space-y-1">
                      {(floorPlan.savedCameraViews ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No saved views yet.</p>
                      ) : (
                        (floorPlan.savedCameraViews ?? []).map(view => (
                          <div key={view.id} className="flex items-center gap-1.5 group">
                            <span className="text-xs truncate flex-1">{view.name}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100" onClick={() => applyPreset(view.position, view.target)}>
                              <Play className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-60 hover:opacity-100 text-destructive" onClick={() => removeCameraView(view.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}

          <div className="w-px h-4 bg-primary/15" />

          <Button
            variant={viewMode === 'walkthrough' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={viewMode === 'design' ? enterWalkthrough : exitWalkthrough}
            disabled={isPreparingWalkthrough}
          >
            {isPreparingWalkthrough ? <Loader2 className="h-3 w-3 animate-spin" /> : <PersonStanding className="h-3 w-3" />}
            {isPreparingWalkthrough ? 'Preparing...' : viewMode === 'walkthrough' ? 'Exit Walk' : 'Walk'}
          </Button>

          {isDragging && (
            <Badge variant="outline" className="gap-1 animate-pulse text-[10px]">
              <Move3D className="h-3 w-3" />
              Dragging
            </Badge>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden canvas-vignette">
      {/* Gold dust particles */}
      <div className="gold-particle" style={{ left: '10%', bottom: '5%', ['--duration' as string]: '12s', ['--delay' as string]: '0s' }} />
      <div className="gold-particle" style={{ left: '25%', bottom: '15%', ['--duration' as string]: '9s', ['--delay' as string]: '2s' }} />
      <div className="gold-particle" style={{ left: '50%', bottom: '8%', ['--duration' as string]: '14s', ['--delay' as string]: '4s' }} />
      <div className="gold-particle" style={{ left: '70%', bottom: '20%', ['--duration' as string]: '10s', ['--delay' as string]: '1s' }} />
      <div className="gold-particle" style={{ left: '85%', bottom: '3%', ['--duration' as string]: '11s', ['--delay' as string]: '6s' }} />
      <div className="gold-particle" style={{ left: '40%', bottom: '12%', ['--duration' as string]: '13s', ['--delay' as string]: '3s' }} />
      
      {/* FULL-SCREEN 3D CANVAS */}
      <div 
        ref={canvasContainerRef}
        className={`absolute inset-0 ${isDraggingFromLibrary ? 'drop-zone-pulse' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Canvas
          shadows
          gl={{ 
            antialias: true,
            preserveDrawingBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            localClippingEnabled: true,
          }}
          onPointerMissed={handleCanvasPointerMissed}
        >
          <SceneRefCapturer sceneRef={sceneRef} />
          <PerspectiveCamera ref={cameraRef} makeDefault position={defaultCameraPos} fov={50} />
          {viewMode === 'design' && (
            <OrbitControls 
              ref={orbitControlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.05}
              minDistance={2}
              maxDistance={Math.max(30, presetMaxSpan * 6)}
              minPolarAngle={0}
              maxPolarAngle={maxPolarAngle}
              target={defaultTarget}
              enabled={!isDragging && !isDraggingFixture && !isDraggingSpawn}
              onStart={() => {
                isAnimatingCamera.current = false;
              }}
            />
          )}
          {viewMode === 'walkthrough' && !isTouchDevice && (
            <PointerLockControls ref={plcRef} makeDefault />
          )}
          <WalkthroughMovement
            viewMode={viewMode}
            keysRef={keysRef}
            walls={floorPlan.walls}
            points={floorPlan.points}
            furnitureItems={furniture}
            moveStickRef={moveStickRef}
            lookStickRef={lookStickRef}
          />
          <Suspense fallback={null}>
            <DesignScene
              showTiles={showTiles}
              showPlumbing={showPlumbing}
              showCeiling={showCeiling}
              giEnabled={giEnabled}
              giQuality={giQuality}
              qualitySettings={qualitySettings}
              onPipelineError={handlePipelineError}
              onWallClick={handleWallClick}
              onFloorClick={handleFloorClick}
              wallPreview={wallPreview}
              tileAnimations={tileAnimations}
              onTileAnimationComplete={handleTileAnimationComplete}
              findTile={findTile}
              floorPlan={floorPlan}
            />
          </Suspense>
          {/* Spawn point marker */}
          {viewMode === 'design' && (
            <SpawnPointMarker
              spawn={spawnPoint}
              onMove={(pos) => setSpawnPoint(prev => ({ ...prev, position: pos }))}
              onRotate={(rot) => setSpawnPoint(prev => ({ ...prev, rotation: rot }))}
              visible={showSpawnMarker}
              floorBounds={{
                minX: roomBounds.minX,
                maxX: roomBounds.maxX,
                minZ: roomBounds.minZ,
                maxZ: roomBounds.maxZ,
              }}
              onDragStart={() => setIsDraggingSpawn(true)}
              onDragEnd={() => setIsDraggingSpawn(false)}
            />
          )}
          {/* Room light markers in design mode */}
          {viewMode === 'design' && (floorPlan.roomLights ?? []).map(light => (
            <RoomLightMarker
              key={light.id}
              light={light}
              ceilingHeight={(floorPlan.walls[0]?.height ?? 280) * 0.01}
              isSelected={selectedLightId === light.id}
              onSelect={() => setSelectedLightId(light.id)}
              onMove={(cx, cy) => updateRoomLight(light.id, { cx, cy })}
              onRotate={(rot) => updateRoomLight(light.id, { rotation: rot })}
              onDelete={() => {
                deleteRoomLight(light.id);
                if (selectedLightId === light.id) setSelectedLightId(null);
              }}
              floorBounds={{
                minX: roomBounds.minX,
                maxX: roomBounds.maxX,
                minZ: roomBounds.minZ,
                maxZ: roomBounds.maxZ,
              }}
            />
          ))}
          <CameraAnimator
            targetPos={animTargetPos}
            targetTarget={animTargetTarget}
            isAnimating={isAnimatingCamera}
            controlsRef={orbitControlsRef}
          />
        </Canvas>
        
        {/* Drop zone indicator */}
        {isDraggingFromLibrary && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-primary/5 via-transparent to-primary/3 pointer-events-none z-10">
            <div className="glass-toolbar text-xs font-display uppercase tracking-[0.25em] font-light text-primary animate-pulse" style={{ textShadow: '0 0 30px hsl(38 60% 68% / 0.4), 0 0 60px hsl(38 60% 68% / 0.15)' }}>
              Drop here to place
            </div>
          </div>
        )}
      </div>




      {/* LEFT PANEL - Library */}
      {viewMode === 'design' && (
        <div 
          className="absolute top-4 left-6 z-20 w-72 max-h-[calc(100%-48px)]"
        >
          <div className="glass-floating overflow-hidden flex flex-col h-full relative">
            <div className="pointer-events-none absolute -bottom-16 -left-16 w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.06)_0%,transparent_70%)]" />
            <div className="pointer-events-none absolute -top-10 -right-10 w-[120px] h-[120px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.04)_0%,transparent_70%)]" />
            <div className="panel-header shrink-0">
              <span className="panel-header-title">Library</span>
            </div>
            <ScrollArea className="flex-1 relative z-10">
              <UnifiedLibrary />
            </ScrollArea>
          </div>
        </div>
      )}
      
      {/* RIGHT PANEL - Properties */}
      {viewMode === 'design' && isPanelOpen && (
        <div className="absolute top-4 right-6 z-20 w-64 max-h-[calc(100%-48px)]">
          <div className="glass-floating overflow-hidden flex flex-col h-full relative">
            <div className="pointer-events-none absolute -bottom-12 -right-12 w-[180px] h-[180px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.06)_0%,transparent_70%)]" />
            <div className="pointer-events-none absolute -top-8 -left-8 w-[100px] h-[100px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.04)_0%,transparent_70%)]" />
            <div className="panel-header shrink-0">
              <span className="panel-header-title">Properties</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5 border border-primary/15"
                onClick={() => setIsPanelOpen(false)}
              >
                <PanelRightClose className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1 relative z-10">
              <DesignPropertiesPanel
                selectedFurniture={selectedFurniture}
                onRotate={handleRotateSelected}
                onDelete={handleDeleteSelected}
              />
            </ScrollArea>
          </div>
        </div>
      )}
      
      {/* Panel toggle button (when closed) */}
      {viewMode === 'design' && !isPanelOpen && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 right-6 z-20 glass-control h-8 w-8"
          onClick={() => setIsPanelOpen(true)}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      )}

      {/* BOTTOM CENTER - Hint */}

      {/* PREPARING WALKTHROUGH OVERLAY */}
      {isPreparingWalkthrough && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md transition-opacity duration-300">
          <div className="pointer-events-none absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,hsl(38_60%_68%/0.08)_0%,transparent_70%)]" />
          <div className="gold-particle" style={{ left: '30%', bottom: '20%', ['--duration' as string]: '6s', ['--delay' as string]: '0s' }} />
          <div className="gold-particle" style={{ left: '60%', bottom: '30%', ['--duration' as string]: '8s', ['--delay' as string]: '1s' }} />
          <div className="gold-particle" style={{ left: '45%', bottom: '10%', ['--duration' as string]: '7s', ['--delay' as string]: '2s' }} />
          <div className="flex flex-col items-center gap-4 text-center relative z-10">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h3 className="text-xl font-display font-light uppercase tracking-[0.2em] text-foreground" style={{ textShadow: '0 0 40px hsl(38 60% 68% / 0.3)' }}>Preparing walkthrough…</h3>
            <p className="text-sm text-muted-foreground">Generating 3D scene</p>
          </div>
        </div>
      )}

      {/* WALKTHROUGH OVERLAYS */}
      {viewMode === 'walkthrough' && !isPointerLocked && !isTouchDevice && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <PersonStanding className="h-12 w-12 text-primary" />
            <h3 className="text-xl font-display font-light uppercase tracking-[0.2em] text-foreground" style={{ textShadow: '0 0 40px hsl(38 60% 68% / 0.3)' }}>Walkthrough Mode</h3>
            <p className="text-sm text-muted-foreground">
              Move with WASD · Look with mouse · Esc to exit
            </p>
            <Button
              size="lg"
              variant="luxury"
              className="gap-2"
              onClick={() => plcRef.current?.lock()}
            >
              <MousePointer className="h-4 w-4" />
              Click to Enter
            </Button>
            <Button variant="ghost" size="sm" onClick={exitWalkthrough}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {viewMode === 'walkthrough' && (isPointerLocked || isTouchDevice) && (
        <>
          {/* Crosshair */}
          <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
            <div className="relative w-6 h-6">
              <div className="absolute top-1/2 left-0 w-full h-px bg-foreground/50" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-foreground/50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-foreground/70" />
            </div>
          </div>

          {/* Walkthrough overlay with exit, render, minimap */}
          <WalkthroughOverlay
            floorPlan={floorPlan}
            spawn={spawnPoint}
            onExit={exitWalkthrough}
            onRender={handleRenderImage}
            visible={true}
          />

          {/* WASD hint */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 glass-toolbar text-xs font-display text-muted-foreground border border-primary/10">
            {isTouchDevice ? 'Left stick to move · Right stick to look' : 'WASD to move · Mouse to look'}
          </div>
        </>
      )}

      {/* Mobile joystick zones */}
      {viewMode === 'walkthrough' && isTouchDevice && (
        <>
          <div id="left-joystick-zone" className="absolute bottom-0 left-0 w-44 h-44 z-40 pointer-events-auto" />
          <div id="right-joystick-zone" className="absolute bottom-0 right-0 w-44 h-44 z-40 pointer-events-auto" />
        </>
      )}

      {/* Render Image Dialog */}
      <Dialog open={renderDialogOpen} onOpenChange={setRenderDialogOpen}>
        <DialogContent className="max-w-4xl dialog-luxury">
          <div className="gold-accent-line w-full absolute top-0 left-0" />
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-sm">Cinematic Render</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {isRendering ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Enhancing render with AI...</p>
                <p className="text-xs text-muted-foreground">This may take 15-30 seconds</p>
              </div>
            ) : renderError ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <p className="text-destructive">{renderError}</p>
                <Button variant="outline" onClick={handleRenderImage}>
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show enhanced or original */}
                <div className="relative aspect-video bg-muted rounded-none overflow-hidden shadow-[inset_0_0_40px_hsl(38_60%_68%/0.06)]">
                  {(enhancedRender || originalRender) && (
                    <img 
                      src={enhancedRender || originalRender || ''} 
                      alt="Rendered scene" 
                      className="w-full h-full object-contain"
                    />
                  )}
                  {!enhancedRender && originalRender && (
                    <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded-none text-xs">
                      Original (enhancement failed)
                    </div>
                  )}
                  {enhancedRender && (
                    <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground px-2 py-1 rounded-none text-xs">
                      AI Enhanced
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRenderDialogOpen(false)}>
                    Close
                  </Button>
                  <Button variant="luxury" onClick={handleDownloadRender} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Wall Surface Dialog */}
      <WallSurfaceDialog
        open={wallSurfaceDialogOpen}
        onOpenChange={(open) => {
          setWallSurfaceDialogOpen(open);
          if (!open) setWallPreview(null); // Clear preview when closing
        }}
        wall={selectedSurfaceWall?.wall || null}
        wallStart={selectedSurfaceWall?.start || null}
        wallEnd={selectedSurfaceWall?.end || null}
        onApplyPaint={handleApplyPaint}
        onApplyWallpaper={handleApplyWallpaper}
        onRemoveFinish={handleRemoveWallFinish}
        onOpenTilesTab={handleOpenTilesTabInternal}
        currentFinish={currentWallFinish}
        onPreviewPaint={handlePreviewPaint}
        onPreviewWallpaper={handlePreviewWallpaper}
      />

      {/* Floor Surface Dialog */}
      <FloorSurfaceDialog
        open={floorSurfaceDialogOpen}
        onOpenChange={setFloorSurfaceDialogOpen}
        floorArea={floorArea}
        onApplyFinish={handleApplyFloorFinish}
        onApplyTiles={handleApplyFloorTiles}
        onRemoveFinish={handleRemoveFloorFinish}
        currentFinish={floorPlan.floorFinish}
      />
      </div>{/* end flex-1 canvas area */}
    </div>
  );
};
