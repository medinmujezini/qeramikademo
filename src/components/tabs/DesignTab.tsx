/**
 * Design Tab - Unified 3D Furniture and Fixture Placement
 * 
 * A 3D-first experience where users place both furniture and fixtures
 * directly in the room using drag-and-drop from a unified library.
 * Click on walls/floor to apply surface treatments (paint, wallpaper, tiles).
 */

import React, { Suspense, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
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
import { GIQualityTier } from '@/gi/GIConfig';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Eye, EyeOff, Grid3X3, Droplets, RotateCcw, Move3D, Settings2, Camera, Download, Loader2, PanelRightClose, PanelRight, LayoutGrid, Mountain, Box } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import * as THREE from 'three';
import { TILE_LIBRARY } from '@/types/floorPlan';
import type { Wall, Point, TilePattern, WallFinish, FloorSurfaceType, Tile, TileTextureUrls } from '@/types/floorPlan';
import { useTileTemplates } from '@/hooks/useTemplatesFromDB';
import { PAINT_COLORS, WALLPAPER_PATTERNS } from '@/types/floorPlan';
import { createTilePatternCanvas } from '@/utils/tileRenderer';
import { isFixturePositionValid } from '@/utils/fixtureCollision';
import { createWallShapeWithOpenings } from '@/utils/wallOpeningGeometry';
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
// 3D SCENE COMPONENTS
// =============================================================================

interface DesignSceneProps {
  showTiles: boolean;
  showPlumbing: boolean;
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

const DesignScene: React.FC<DesignSceneProps> = ({
  showTiles,
  showPlumbing,
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
          e.stopPropagation();
          (e.object as any)._pointerDownPos = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
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
        <meshStandardMaterial color={floorPlan.floorFinish?.color || "#f3f4f6"} roughness={0.8} />
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
  const { floorPlan, setWallFinish, removeWallFinish, setFloorFinish, removeFloorFinish } = useFloorPlanContext();
  
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
  const [giEnabled, setGiEnabled] = useState(false);
  const [giQuality, setGiQuality] = useState<GIQualityTier>('high');
  const [qualitySettings, setQualitySettings] = useState<QualitySettings>(DEFAULT_QUALITY_SETTINGS);
  const [viewMode, setViewMode] = useState<'design' | 'walkthrough'>('design');
  const [maxPolarAngle, setMaxPolarAngle] = useState(Math.PI / 2);
  const [isDraggingFromLibrary, setIsDraggingFromLibrary] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orbitControlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Calculate room-based camera position
  const roomW = (floorPlan.roomWidth || 800) / 100;
  const roomH = (floorPlan.roomHeight || 600) / 100;
  const camDist = Math.max(roomW, roomH) * 0.85;
  const defaultCameraPos: [number, number, number] = [roomW / 2 + camDist, camDist * 0.75, roomH / 2 + camDist];
  const defaultTarget: [number, number, number] = [roomW / 2, 0, roomH / 2];

  const handleResetView = useCallback(() => {
    if (cameraRef.current && orbitControlsRef.current) {
      setMaxPolarAngle(Math.PI / 2);
      cameraRef.current.position.set(...defaultCameraPos);
      orbitControlsRef.current.target.set(...defaultTarget);
      orbitControlsRef.current.update();
    }
  }, [defaultCameraPos, defaultTarget]);

  const applyPreset = useCallback((pos: [number, number, number], target: [number, number, number], eyeLevel = false) => {
    if (!cameraRef.current || !orbitControlsRef.current) return;
    setMaxPolarAngle(eyeLevel ? Math.PI : Math.PI / 2);
    cameraRef.current.position.set(...pos);
    orbitControlsRef.current.target.set(...target);
    orbitControlsRef.current.update();
  }, []);
  
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
  const handleApplyFloorFinish = useCallback((type: FloorSurfaceType, color: string) => {
    setFloorFinish(type as 'tiles' | 'hardwood' | 'carpet', { color });
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
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingFromLibrary(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set to false if we're leaving the container entirely
    if (!canvasContainerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDraggingFromLibrary(false);
    }
  }, []);

  // Handle drop for furniture/fixtures from library
  const handleDrop = useCallback((e: React.DragEvent) => {
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
    <div className="h-full relative overflow-hidden">
      {/* FULL-SCREEN 3D CANVAS */}
      <div 
        ref={canvasContainerRef}
        className={`canvas-full ${isDraggingFromLibrary ? 'ring-2 ring-primary ring-inset' : ''}`}
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
          <PerspectiveCamera ref={cameraRef} makeDefault position={defaultCameraPos} fov={50} />
          <OrbitControls 
            ref={orbitControlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={30}
            minPolarAngle={0}
            maxPolarAngle={maxPolarAngle}
            target={defaultTarget}
            enabled={!isDragging && !isDraggingFixture}
          />
          <Suspense fallback={null}>
            <DesignScene
              showTiles={showTiles}
              showPlumbing={showPlumbing}
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
        </Canvas>
        
        {/* Drop zone indicator */}
        {isDraggingFromLibrary && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/5 pointer-events-none">
            <div className="glass-toolbar text-sm font-medium">
              Drop here to place
            </div>
          </div>
        )}
      </div>

      {/* FLOATING TOP TOOLBAR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 glass-toolbar flex items-center gap-4 flex-wrap overflow-visible">
        <div className="flex items-center gap-2">
          <Switch id="gi-enabled" checked={giEnabled} onCheckedChange={setGiEnabled} className="scale-90" />
          <Label htmlFor="gi-enabled" className="flex items-center gap-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Enhanced
          </Label>
        </div>
        
        {giEnabled && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <ScrollArea className="h-[400px]">
                <QualitySettingsPanel 
                  settings={qualitySettings}
                  onChange={setQualitySettings}
                  disabled={!giEnabled}
                />
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
        
        <div className="h-4 w-px bg-border/50" />
        
        <div className="flex items-center gap-2">
          <Switch id="show-tiles" checked={showTiles} onCheckedChange={setShowTiles} className="scale-90" />
          <Label htmlFor="show-tiles" className="flex items-center gap-1.5 text-sm">
            <Grid3X3 className="h-3.5 w-3.5" />
            Tiles
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch id="show-plumbing" checked={showPlumbing} onCheckedChange={setShowPlumbing} className="scale-90" />
          <Label htmlFor="show-plumbing" className="flex items-center gap-1.5 text-sm">
            <Droplets className="h-3.5 w-3.5 text-blue-500" />
            Plumbing
          </Label>
        </div>
        
        <div className="h-4 w-px bg-border/50" />
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="gap-1 bg-white/20">
            {furnitureCount} Furniture
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-white/20">
            {fixtureCount} Fixtures
          </Badge>
        </div>
        
        <div className="h-4 w-px bg-border/50" />
        
        {/* Render Image Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 gap-1.5"
          onClick={handleRenderImage}
          disabled={isRendering}
        >
          {isRendering ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          Render
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 gap-1.5"
          onClick={handleResetView}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset View
        </Button>

        <div className="h-4 w-px bg-border/50" />

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const M = Math.max(roomW, roomH);
                  const C: [number, number, number] = [roomW / 2, 0, roomH / 2];
                  applyPreset([roomW / 2 + M * 0.85, M * 0.85 * 0.75, roomH / 2 + M * 0.85], C);
                }}
              >
                <Box className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={10} collisionPadding={12}>Corner View</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const M = Math.max(roomW, roomH);
                  const C: [number, number, number] = [roomW / 2, 0, roomH / 2];
                  applyPreset([roomW / 2, 1.25 * M, roomH / 2], C);
                }}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={10} collisionPadding={12}>Top Down</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (roomW >= roomH) {
                    applyPreset([roomW / 2, 1.6, roomH * 0.85], [roomW / 2, 1.6, 0], true);
                  } else {
                    applyPreset([roomW * 0.85, 1.6, roomH / 2], [0, 1.6, roomH / 2], true);
                  }
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={10} collisionPadding={12}>Eye Level</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  const M = Math.max(roomW, roomH);
                  const C: [number, number, number] = [roomW / 2, 0, roomH / 2];
                  applyPreset([roomW * 0.9 + M, M, roomH * 0.9 + M], C);
                }}
              >
                <Mountain className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={10} collisionPadding={12}>Birdseye</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isDragging && (
          <Badge variant="outline" className="gap-1 animate-pulse bg-white/20">
            <Move3D className="h-3 w-3" />
            Dragging...
          </Badge>
        )}
      </div>

      {/* LEFT PANEL - Library */}
      <div className="absolute top-28 left-6 z-20 w-72 max-h-[calc(100%-180px)]">
        <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
          <div className="panel-header shrink-0">
            <span className="panel-header-title">Library</span>
          </div>
          <ScrollArea className="flex-1">
            <UnifiedLibrary />
          </ScrollArea>
        </div>
      </div>
      
      {/* RIGHT PANEL - Properties */}
      {isPanelOpen && (
        <div className="absolute top-32 right-6 z-20 w-64 max-h-[calc(100%-196px)]">
          <div className="glass-floating rounded-xl overflow-hidden flex flex-col h-full">
            <div className="panel-header shrink-0">
              <span className="panel-header-title">Properties</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5"
                onClick={() => setIsPanelOpen(false)}
              >
                <PanelRightClose className="h-3 w-3" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
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
      {!isPanelOpen && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-32 right-6 z-20 glass-control h-8 w-8"
          onClick={() => setIsPanelOpen(true)}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      )}

      {/* BOTTOM CENTER - Hint */}
      {!isPanelOpen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 glass-toolbar text-xs text-muted-foreground">
          Click walls/floor for surface • Drag library items to place
        </div>
      )}

      {/* Render Image Dialog */}
      <Dialog open={renderDialogOpen} onOpenChange={setRenderDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cinematic Render</DialogTitle>
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
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  {(enhancedRender || originalRender) && (
                    <img 
                      src={enhancedRender || originalRender || ''} 
                      alt="Rendered scene" 
                      className="w-full h-full object-contain"
                    />
                  )}
                  {!enhancedRender && originalRender && (
                    <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs">
                      Original (enhancement failed)
                    </div>
                  )}
                  {enhancedRender && (
                    <div className="absolute top-2 left-2 bg-primary/80 text-primary-foreground px-2 py-1 rounded text-xs">
                      AI Enhanced
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRenderDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={handleDownloadRender} className="gap-2">
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
    </div>
  );
};
