import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Wall, Tile, TileOrientation, TilePattern, WallTileSection, Point } from '@/types/floorPlan';
import { isWallSloped, isWallCurved, getWallSlopeAngle, isTileSuitableForCurve, getRecommendedTileSize } from '@/types/floorPlan';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { useMaterialContext } from '@/contexts/MaterialContext';
import { calculateTileLayout, TilePosition } from '@/utils/tileCalculator';
import { requestBitmap } from '@/utils/tileRenderer';
import { calculateWallElevationShape, WallElevationShape } from '@/utils/wallHeightUtils';
import { arcLength as calcArcLength } from '@/utils/arcUtils';
import { 
  RectangleHorizontal, RectangleVertical, Grid3X3, Layers, Paintbrush, Check, 
  Scissors, SplitSquareHorizontal, SplitSquareVertical, LayoutTemplate, Trash2, 
  GripVertical, Move, AlertTriangle, TrendingUp, Waves, Maximize, Columns, Rows3, PanelTop, ChevronDown
} from 'lucide-react';

// Types for sections and dividers
interface WallSection {
  id: string;
  bounds: { x1: number; y1: number; x2: number; y2: number }; // Normalized 0-1
  tileId: string | null;
  orientation: TileOrientation;
  pattern: TilePattern;
  offsetX: number;
  offsetY: number;
}

interface Divider {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number; // 0-1 along the wall
}

interface ScreenTilePosition extends TilePosition {
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  sectionId: string;
}

interface SelectedCutTile {
  x: number;
  y: number;
  cutWidth: number;
  cutHeight: number;
  originalWidth: number;
  originalHeight: number;
  cutAngle?: number;
  cutType?: 'straight' | 'angled' | 'triangular';
  leftEdgeHeight?: number;
  rightEdgeHeight?: number;
}

interface WallElevationViewerProps {
  wall: Wall | null;
  wallIndex: number;
  selectedTile: Tile | null;
  jointWidth: number;
  groutColor: string;
  tiles: Tile[];
  onApplyTile: (wallId: string, settings: Partial<WallTileSection>) => void;
  onApplyToAll: (settings: Partial<WallTileSection>) => void;
  onSaveSections?: (wallId: string, sections: Partial<WallTileSection>[]) => void;
}

// Grout color presets
const GROUT_COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light Gray', value: '#d1d5db' },
  { name: 'Gray', value: '#9ca3af' },
  { name: 'Dark Gray', value: '#4b5563' },
  { name: 'Black', value: '#1f2937' },
  { name: 'Beige', value: '#d4c4a8' },
];

// Preset section layouts
const PRESET_LAYOUTS = [
  { id: 'full', label: 'Full Wall', icon: Maximize, dividers: [] as { type: string; position: number }[] },
  { id: 'horizontal-half', label: 'Horizontal 50/50', icon: SplitSquareHorizontal, dividers: [{ type: 'horizontal', position: 0.5 }] },
  { id: 'accent-band', label: 'Accent Band (Top 20%)', icon: PanelTop, dividers: [{ type: 'horizontal', position: 0.8 }] },
  { id: 'wainscoting', label: 'Wainscoting (Bottom 1/3)', icon: Layers, dividers: [{ type: 'horizontal', position: 0.33 }] },
  { id: 'vertical-half', label: 'Vertical 50/50', icon: Columns, dividers: [{ type: 'vertical', position: 0.5 }] },
  { id: 'three-bands', label: 'Three Horizontal Bands', icon: Rows3, dividers: [{ type: 'horizontal', position: 0.33 }, { type: 'horizontal', position: 0.66 }] },
];

export const WallElevationViewer: React.FC<WallElevationViewerProps> = ({
  wall,
  wallIndex,
  selectedTile,
  jointWidth,
  groutColor: initialGroutColor,
  tiles,
  onApplyTile,
  onApplyToAll,
  onSaveSections,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { floorPlan } = useFloorPlanContext();
  const { materials: pbrMaterials } = useMaterialContext();
  
  // Section management state
  const [sections, setSections] = useState<WallSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [dividers, setDividers] = useState<Divider[]>([]);
  const [dividerMode, setDividerMode] = useState<'none' | 'horizontal' | 'vertical'>('none');
  const [draggingDivider, setDraggingDivider] = useState<string | null>(null);
  
  // Cut tile interaction state
  const [selectedCutTile, setSelectedCutTile] = useState<SelectedCutTile | null>(null);
  const [cutTilePopoverOpen, setCutTilePopoverOpen] = useState(false);
  const [textureVersion, setTextureVersion] = useState(0);
  const tilePositionsRef = useRef<ScreenTilePosition[]>([]);
  
  // Track previous selected tile to prevent overwriting on section selection
  const prevSelectedTileRef = useRef<string | null>(null);
  
  // Tile settings state (for selected section)
  const [groutColor, setGroutColor] = useState(initialGroutColor);

  // Calculate wall dimensions and shape
  const getWallDimensions = useCallback(() => {
    if (!wall) return { length: 0, height: 0, startHeight: 0, endHeight: 0, isSloped: false, isCurved: false };
    
    const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
    const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
    if (!startPoint || !endPoint) return { length: 0, height: 0, startHeight: 0, endHeight: 0, isSloped: false, isCurved: false };
    
    // For curved walls, use arc length
    let length: number;
    if (isWallCurved(wall)) {
      length = calcArcLength(startPoint, endPoint, wall.bulge || 0);
    } else {
      length = Math.sqrt(
        Math.pow(endPoint.x - startPoint.x, 2) + 
        Math.pow(endPoint.y - startPoint.y, 2)
      );
    }
    
    const startHeight = wall.startHeight ?? wall.height;
    const endHeight = wall.endHeight ?? wall.height;
    const isSloped = isWallSloped(wall);
    const isCurved = isWallCurved(wall);
    
    // For display purposes, use the max height but track both
    const maxHeight = Math.max(startHeight, endHeight);
    
    return { 
      length, 
      height: maxHeight, 
      startHeight,
      endHeight,
      isSloped,
      isCurved
    };
  }, [wall, floorPlan.points]);

  // Get wall elevation shape for rendering
  const wallShape = useMemo((): WallElevationShape | null => {
    if (!wall) return null;
    return calculateWallElevationShape(wall, floorPlan.points, floorPlan.walls);
  }, [wall, floorPlan.points, floorPlan.walls]);

  // Shared wall render metrics - ensures click detection matches drawing
  const getWallRenderMetrics = useCallback((canvasWidth: number, canvasHeight: number) => {
    const dims = getWallDimensions();
    if (dims.length === 0) return null;

    const padding = 30;
    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2 - 20; // Extra space for bottom label
    const scaleX = availableWidth / dims.length;
    const scaleY = availableHeight / dims.height;
    const scale = Math.min(scaleX, scaleY, 2);

    const wallWidth = dims.length * scale;
    const wallHeight = dims.height * scale;
    const startX = (canvasWidth - wallWidth) / 2;
    const startY = (canvasHeight - wallHeight - 20) / 2;

    return { startX, startY, wallWidth, wallHeight, scale, dims };
  }, [getWallDimensions]);

  // Helper to reconstruct dividers from saved sections
  const calculateDividersFromSections = useCallback((savedSections: WallTileSection[], actualWallHeight: number): Divider[] => {
    if (savedSections.length <= 1) return [];
    
    const dividers: Divider[] = [];
    const hPositions = new Set<number>();
    const vPositions = new Set<number>();
    
    savedSections.forEach(s => {
      // Convert height-based positions to normalized 0-1 using actual wall height
      const y1Norm = s.startHeight / actualWallHeight;
      const y2Norm = s.endHeight / actualWallHeight;
      
      // Collect unique boundary positions (excluding 0 and 1)
      if (y1Norm > 0.01 && y1Norm < 0.99) hPositions.add(y1Norm);
      if (y2Norm > 0.01 && y2Norm < 0.99) hPositions.add(y2Norm);
      if (s.startPosition > 0.01 && s.startPosition < 0.99) vPositions.add(s.startPosition);
      if (s.endPosition > 0.01 && s.endPosition < 0.99) vPositions.add(s.endPosition);
    });
    
    Array.from(hPositions).forEach((pos, idx) => {
      dividers.push({ id: `h-divider-${idx}`, type: 'horizontal', position: pos });
    });
    
    Array.from(vPositions).forEach((pos, idx) => {
      dividers.push({ id: `v-divider-${idx}`, type: 'vertical', position: pos });
    });
    
    return dividers;
  }, []);

  // Load saved sections when wall changes
  useEffect(() => {
    if (wall) {
      // Get actual wall height for this wall
      const dims = getWallDimensions();
      const actualWallHeight = dims.height;
      
      // Check if this wall has saved tile sections
      const savedSections = floorPlan.tileSections.filter(s => s.wallId === wall.id);
      
      if (savedSections.length > 0) {
        // Convert saved WallTileSection to local WallSection format using actual wall height
        const loadedSections: WallSection[] = savedSections.map((s, idx) => ({
          id: `section-${idx}`,
          bounds: {
            x1: s.startPosition,
            x2: s.endPosition,
            y1: s.startHeight / actualWallHeight,
            y2: s.endHeight / actualWallHeight,
          },
          tileId: s.tileId,
          orientation: s.orientation,
          pattern: s.pattern,
          offsetX: s.offsetX,
          offsetY: s.offsetY,
        }));
        
        // Reconstruct dividers from section boundaries
        const loadedDividers = calculateDividersFromSections(savedSections, actualWallHeight);
        
        setSections(loadedSections);
        setDividers(loadedDividers);
        setGroutColor(savedSections[0]?.groutColor || initialGroutColor);
      } else {
        // No saved sections - use defaults with null tile (user must explicitly assign)
        const defaultSection: WallSection = {
          id: 'section-0',
          bounds: { x1: 0, y1: 0, x2: 1, y2: 1 },
          tileId: null,
          orientation: 'horizontal',
          pattern: 'grid',
          offsetX: 0,
          offsetY: 0,
        };
        setSections([defaultSection]);
        setDividers([]);
      }
      
      setSelectedSectionId('section-0');
      setSelectedCutTile(null);
      setCutTilePopoverOpen(false);
    }
  }, [wall?.id, calculateDividersFromSections, initialGroutColor, getWallDimensions, floorPlan.tileSections]);

  // Update section tile when selected tile changes from the library (not on section switch)
  useEffect(() => {
    // Only update if the library tile actually changed, not on section selection
    if (selectedTile && selectedSectionId && prevSelectedTileRef.current !== selectedTile.id) {
      setSections(prev => prev.map(s => 
        s.id === selectedSectionId ? { ...s, tileId: selectedTile.id } : s
      ));
    }
    prevSelectedTileRef.current = selectedTile?.id || null;
  }, [selectedTile?.id, selectedSectionId]);

  // Calculate sections from dividers
  const calculateSectionsFromDividers = useCallback((newDividers: Divider[]): WallSection[] => {
    const hDividers = newDividers
      .filter(d => d.type === 'horizontal')
      .map(d => d.position)
      .sort((a, b) => a - b);
    const vDividers = newDividers
      .filter(d => d.type === 'vertical')
      .map(d => d.position)
      .sort((a, b) => a - b);

    const xPoints = [0, ...vDividers, 1];
    const yPoints = [0, ...hDividers, 1];

    const newSections: WallSection[] = [];
    let sectionIndex = 0;

    for (let j = 0; j < yPoints.length - 1; j++) {
      for (let i = 0; i < xPoints.length - 1; i++) {
        // Try to preserve existing section settings
        const existingSection = sections.find(s => 
          Math.abs(s.bounds.x1 - xPoints[i]) < 0.05 &&
          Math.abs(s.bounds.y1 - yPoints[j]) < 0.05
        );

        newSections.push({
          id: `section-${sectionIndex}`,
          bounds: {
            x1: xPoints[i],
            x2: xPoints[i + 1],
            y1: yPoints[j],
            y2: yPoints[j + 1],
          },
          tileId: existingSection?.tileId || selectedTile?.id || null,
          orientation: existingSection?.orientation || 'horizontal',
          pattern: existingSection?.pattern || 'grid',
          offsetX: existingSection?.offsetX || 0,
          offsetY: existingSection?.offsetY || 0,
        });
        sectionIndex++;
      }
    }

    return newSections;
  }, [sections, selectedTile]);

  // Get selected section
  const selectedSection = sections.find(s => s.id === selectedSectionId);

  // Update section settings
  const updateSectionSettings = useCallback((field: keyof WallSection, value: any) => {
    if (!selectedSectionId) return;
    setSections(prev => prev.map(s => 
      s.id === selectedSectionId ? { ...s, [field]: value } : s
    ));
  }, [selectedSectionId]);

  // Apply preset layout
  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESET_LAYOUTS.find(p => p.id === presetId);
    if (!preset) return;

    const newDividers: Divider[] = preset.dividers.map((d, i) => ({
      id: `divider-preset-${i}`,
      type: d.type as 'horizontal' | 'vertical',
      position: d.position,
    }));

    setDividers(newDividers);
    const newSections = calculateSectionsFromDividers(newDividers);
    setSections(newSections);
    if (newSections.length > 0) {
      setSelectedSectionId(newSections[0].id);
    }
  }, [calculateSectionsFromDividers]);

  // Delete a divider
  const deleteDivider = useCallback((dividerId: string) => {
    const newDividers = dividers.filter(d => d.id !== dividerId);
    setDividers(newDividers);
    const newSections = calculateSectionsFromDividers(newDividers);
    setSections(newSections);
    if (newSections.length > 0 && !newSections.find(s => s.id === selectedSectionId)) {
      setSelectedSectionId(newSections[0].id);
    }
  }, [dividers, calculateSectionsFromDividers, selectedSectionId]);

  // Clear all dividers
  const clearDividers = useCallback(() => {
    setDividers([]);
    const defaultSection: WallSection = {
      id: 'section-0',
      bounds: { x1: 0, y1: 0, x2: 1, y2: 1 },
      tileId: null,
      orientation: 'horizontal',
      pattern: 'grid',
      offsetX: 0,
      offsetY: 0,
    };
    setSections([defaultSection]);
    setSelectedSectionId('section-0');
  }, []);

  // Handle canvas click - uses shared metrics for correct coordinate mapping
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const metrics = getWallRenderMetrics(canvas.width, canvas.height);
    if (!metrics) return;

    const { startX, startY, wallWidth, wallHeight } = metrics;

    // Skip if we're dragging a divider (handled by pointer events)
    if (draggingDivider) return;

    // Adding new divider
    if (dividerMode !== 'none') {
      const relX = (x - startX) / wallWidth;
      const relY = 1 - (y - startY) / wallHeight;

      if (relX >= 0.05 && relX <= 0.95 && relY >= 0.05 && relY <= 0.95) {
        const newDivider: Divider = {
          id: `divider-${Date.now()}`,
          type: dividerMode,
          position: dividerMode === 'horizontal' ? relY : relX,
        };
        const newDividers = [...dividers, newDivider];
        setDividers(newDividers);
        const newSections = calculateSectionsFromDividers(newDividers);
        setSections(newSections);
        setDividerMode('none');
      }
      return;
    }

    // Check if clicking on a section
    for (const section of sections) {
      const sectionX = startX + section.bounds.x1 * wallWidth;
      const sectionY = startY + (1 - section.bounds.y2) * wallHeight;
      const sectionWidth = (section.bounds.x2 - section.bounds.x1) * wallWidth;
      const sectionHeight = (section.bounds.y2 - section.bounds.y1) * wallHeight;

      if (x >= sectionX && x <= sectionX + sectionWidth &&
          y >= sectionY && y <= sectionY + sectionHeight) {
        
        // If clicking on same section, check for cut tile interaction
        if (section.id === selectedSectionId) {
          const clickedTile = tilePositionsRef.current.find(tile =>
            tile.isCut &&
            tile.sectionId === section.id &&
            x >= tile.screenX && x <= tile.screenX + tile.screenWidth &&
            y >= tile.screenY && y <= tile.screenY + tile.screenHeight
          );

          if (clickedTile) {
            const tile = tiles.find(t => t.id === section?.tileId) || selectedTile;
            if (tile) {
              setSelectedCutTile({
                x: clickedTile.screenX + clickedTile.screenWidth / 2,
                y: clickedTile.screenY,
                cutWidth: clickedTile.cutWidth || tile.width,
                cutHeight: clickedTile.cutHeight || tile.height,
                originalWidth: tile.width,
                originalHeight: tile.height,
                cutAngle: clickedTile.cutAngle,
                cutType: clickedTile.cutType as 'straight' | 'angled' | 'triangular' | undefined,
                leftEdgeHeight: clickedTile.leftEdgeHeight,
                rightEdgeHeight: clickedTile.rightEdgeHeight,
              });
              setCutTilePopoverOpen(true);
              return;
            }
          }
        }
        
        // Close popover and select section
        setCutTilePopoverOpen(false);
        setSelectedCutTile(null);
        setSelectedSectionId(section.id);
        return;
      }
    }

    // Clicking outside any section - close popover
    setCutTilePopoverOpen(false);
    setSelectedCutTile(null);
  }, [dividerMode, dividers, sections, selectedSectionId, getWallRenderMetrics, calculateSectionsFromDividers, tiles, selectedTile, draggingDivider]);

  // Handle pointer down - initiates divider dragging from handle icon
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const metrics = getWallRenderMetrics(canvas.width, canvas.height);
    if (!metrics) return;

    const { startX, startY, wallWidth, wallHeight } = metrics;
    const handleRadius = 12; // Clickable radius for the handle icon

    // Check if clicking on a divider handle (the blue circle icon)
    for (const divider of dividers) {
      let handleX: number, handleY: number;
      
      if (divider.type === 'horizontal') {
        handleX = startX + wallWidth + 12; // Handle is to the right of wall
        handleY = startY + (1 - divider.position) * wallHeight;
      } else {
        handleX = startX + divider.position * wallWidth;
        handleY = startY + wallHeight + 12; // Handle is below wall
      }

      const distance = Math.sqrt((x - handleX) ** 2 + (y - handleY) ** 2);
      if (distance <= handleRadius) {
        setDraggingDivider(divider.id);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
    }
  }, [dividers, getWallRenderMetrics]);

  // Handle pointer move - updates divider position while dragging
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingDivider) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const metrics = getWallRenderMetrics(canvas.width, canvas.height);
    if (!metrics) return;

    const { startX, startY, wallWidth, wallHeight } = metrics;

    setDividers(prev => prev.map(d => {
      if (d.id !== draggingDivider) return d;
      
      if (d.type === 'horizontal') {
        const newPos = Math.max(0.1, Math.min(0.9, 1 - (y - startY) / wallHeight));
        return { ...d, position: newPos };
      } else {
        const newPos = Math.max(0.1, Math.min(0.9, (x - startX) / wallWidth));
        return { ...d, position: newPos };
      }
    }));
  }, [draggingDivider, getWallRenderMetrics]);

  // Handle pointer up - finishes divider dragging and syncs sections
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingDivider) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }
      const newSections = calculateSectionsFromDividers(dividers);
      setSections(newSections);
      setDraggingDivider(null);
    }
  }, [draggingDivider, dividers, calculateSectionsFromDividers]);

  // Draw elevation view with tiles
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    if (!wall) {
      // Show placeholder
      ctx.fillStyle = 'hsl(var(--muted))';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Select a wall to preview tiles', width / 2, height / 2);
      return;
    }

    const dims = getWallDimensions();
    if (dims.length === 0) return;

    // Calculate scale to fit wall in canvas with padding
    const padding = 30;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2 - 40; // Extra space for labels and badges
    const scaleX = availableWidth / dims.length;
    const scaleY = availableHeight / dims.height;
    const scale = Math.min(scaleX, scaleY, 2);

    const wallWidth = dims.length * scale;
    const wallHeight = dims.height * scale;
    const startX = (width - wallWidth) / 2;
    const startY = (height - wallHeight - 30) / 2;
    
    // Calculate scaled heights for trapezoidal walls
    const scaledStartHeight = dims.startHeight * scale;
    const scaledEndHeight = dims.endHeight * scale;
    const maxScaledHeight = Math.max(scaledStartHeight, scaledEndHeight);

    // Clear tile positions
    tilePositionsRef.current = [];

    // Draw trapezoidal wall background (grout) for sloped walls
    if (dims.isSloped) {
      ctx.fillStyle = groutColor;
      ctx.beginPath();
      // Start from bottom-left, go counter-clockwise
      ctx.moveTo(startX, startY + maxScaledHeight); // Bottom-left
      ctx.lineTo(startX + wallWidth, startY + maxScaledHeight); // Bottom-right
      ctx.lineTo(startX + wallWidth, startY + maxScaledHeight - scaledEndHeight); // Top-right
      ctx.lineTo(startX, startY + maxScaledHeight - scaledStartHeight); // Top-left
      ctx.closePath();
      ctx.fill();
    }

    // Draw each section
    for (const section of sections) {
      const sectionX = startX + section.bounds.x1 * wallWidth;
      const sectionStartY = startY + (1 - section.bounds.y2) * wallHeight;
      const sectionWidth = (section.bounds.x2 - section.bounds.x1) * wallWidth;
      const sectionHeight = (section.bounds.y2 - section.bounds.y1) * wallHeight;

      // Get tile for this section
      const sectionTile = tiles.find(t => t.id === section.tileId) || selectedTile;

      // Resolve albedo bitmap for this section's tile
      const sectionMat = sectionTile?.materialId ? pbrMaterials.find(m => m.id === sectionTile.materialId) : null;
      const sectionAlbedoUrl = sectionMat?.albedo;
      const bitmapEntry = sectionAlbedoUrl
        ? requestBitmap(sectionAlbedoUrl, () => setTextureVersion(v => v + 1))
        : null;
      const albedoBitmap = bitmapEntry?.status === 'ready' ? bitmapEntry.bitmap : null;

      // For non-sloped walls, draw rectangular grout background
      if (!dims.isSloped) {
        ctx.fillStyle = groutColor;
        ctx.fillRect(sectionX, sectionStartY, sectionWidth, sectionHeight);
      }

      if (sectionTile) {
        // Calculate section dimensions in cm
        const sectionLengthCm = (section.bounds.x2 - section.bounds.x1) * dims.length;
        const sectionHeightCm = (section.bounds.y2 - section.bounds.y1) * dims.height;

        // Get tile dimensions based on orientation
        const tileW = section.orientation === 'horizontal' ? sectionTile.width : sectionTile.height;
        const tileH = section.orientation === 'horizontal' ? sectionTile.height : sectionTile.width;

        // Calculate section's actual heights for sloped walls
        let slopeInfo: { startHeight: number; endHeight: number } | undefined;
        if (dims.isSloped) {
          // Interpolate wall heights at section boundaries
          const sectionStartNorm = section.bounds.x1;
          const sectionEndNorm = section.bounds.x2;
          const wallHeightAtSectionStart = dims.startHeight + (dims.endHeight - dims.startHeight) * sectionStartNorm;
          const wallHeightAtSectionEnd = dims.startHeight + (dims.endHeight - dims.startHeight) * sectionEndNorm;
          
          // Apply section's y bounds to get actual section heights
          const sectionStartHeight = wallHeightAtSectionStart * section.bounds.y2;
          const sectionEndHeight = wallHeightAtSectionEnd * section.bounds.y2;
          
          slopeInfo = { startHeight: sectionStartHeight, endHeight: sectionEndHeight };
        }

        // Calculate tile layout with pattern support and optional slope info
        const layout = calculateTileLayout(
          sectionLengthCm, 
          sectionHeightCm, 
          { ...sectionTile, width: tileW, height: tileH }, 
          section.offsetX, 
          section.offsetY, 
          jointWidth, 
          section.pattern,
          slopeInfo
        );

        const tileScaleX = sectionWidth / sectionLengthCm;
        const tileScaleY = sectionHeight / sectionHeightCm;
        const jointScaled = jointWidth * scale / 10;

        // Draw tiles with proper clipping for sloped walls
        ctx.save();
        ctx.beginPath();
        
        if (dims.isSloped) {
          // For sloped walls, calculate interpolated heights at section boundaries
          const sectionStartNorm = section.bounds.x1;
          const sectionEndNorm = section.bounds.x2;
          
          // Interpolate wall heights at section x boundaries
          const wallHeightAtSectionStart = dims.startHeight + (dims.endHeight - dims.startHeight) * sectionStartNorm;
          const wallHeightAtSectionEnd = dims.startHeight + (dims.endHeight - dims.startHeight) * sectionEndNorm;
          
          // Apply section's y bounds (0-1) to these interpolated heights
          const sectionBottomY = startY + maxScaledHeight;
          const sectionTopLeftY = startY + maxScaledHeight - (wallHeightAtSectionStart * section.bounds.y2) * scale;
          const sectionTopRightY = startY + maxScaledHeight - (wallHeightAtSectionEnd * section.bounds.y2) * scale;
          const sectionBottomLeftY = startY + maxScaledHeight - (wallHeightAtSectionStart * section.bounds.y1) * scale;
          const sectionBottomRightY = startY + maxScaledHeight - (wallHeightAtSectionEnd * section.bounds.y1) * scale;
          
          // Create trapezoidal clip path for this section
          ctx.moveTo(sectionX, sectionBottomLeftY); // Bottom-left
          ctx.lineTo(sectionX + sectionWidth, sectionBottomRightY); // Bottom-right  
          ctx.lineTo(sectionX + sectionWidth, sectionTopRightY); // Top-right
          ctx.lineTo(sectionX, sectionTopLeftY); // Top-left
          ctx.closePath();
        } else {
          ctx.rect(sectionX, sectionStartY, sectionWidth, sectionHeight);
        }
        ctx.clip();

        const isRotatedPattern = section.pattern === 'diagonal' || section.pattern === 'herringbone';

        for (const tilePos of layout.tilePositions) {
          const rotation = tilePos.rotation || 0;
          
          let screenTileX: number, screenTileY: number, screenTileW: number, screenTileH: number;
          
          if (section.pattern === 'diagonal' && rotation === 45) {
            // Diagonal pattern: position is center of diamond
            const tileCenterX = sectionX + tilePos.x * tileScaleX;
            const tileCenterY = sectionStartY + sectionHeight - tilePos.y * tileScaleY;
            const tileActualW = (tilePos.cutWidth || tileW) * tileScaleX - jointScaled;
            const tileActualH = (tilePos.cutHeight || tileH) * tileScaleY - jointScaled;
            
            // Draw rotated tile (diamond)
            ctx.save();
            ctx.translate(tileCenterX, tileCenterY);
            ctx.rotate((45 * Math.PI) / 180);
            
            const halfW = tileActualW / 2;
            const halfH = tileActualH / 2;
            
            if (tilePos.isCut) {
              ctx.fillStyle = sectionTile.color;
              ctx.globalAlpha = 0.6;
              ctx.fillRect(-halfW, -halfH, tileActualW, tileActualH);
              ctx.globalAlpha = 1;
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 2]);
              ctx.strokeRect(-halfW + 1, -halfH + 1, tileActualW - 2, tileActualH - 2);
              ctx.setLineDash([]);
            } else {
              ctx.fillStyle = sectionTile.color;
              ctx.fillRect(-halfW, -halfH, tileActualW, tileActualH);
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(-halfW, -halfH, tileActualW, tileActualH);
            }
            
            ctx.restore();
            
            // Store approximate bounds for click detection
            screenTileX = tileCenterX - tileActualW / 2;
            screenTileY = tileCenterY - tileActualH / 2;
            screenTileW = tileActualW;
            screenTileH = tileActualH;
          } else if (tilePos.isSlopedCut && tilePos.vertices && tilePos.vertices.length >= 3) {
            // Angled cut tile on sloped wall - render as polygon
            screenTileX = sectionX + tilePos.x * tileScaleX;
            screenTileY = sectionStartY + sectionHeight - (tilePos.y + (tilePos.cutHeight || tileH)) * tileScaleY;
            screenTileW = (tilePos.cutWidth || tileW) * tileScaleX - jointScaled;
            screenTileH = (tilePos.cutHeight || tileH) * tileScaleY - jointScaled;
            
            // Draw polygon using vertices
            ctx.beginPath();
            const scaleVX = screenTileW / (tilePos.cutWidth || tileW);
            const scaleVY = screenTileH / (tilePos.cutHeight || tileH);
            
            for (let i = 0; i < tilePos.vertices.length; i++) {
              const vx = screenTileX + tilePos.vertices[i].x * scaleVX;
              // Flip Y since canvas Y is inverted relative to tile coords
              const vy = screenTileY + screenTileH - tilePos.vertices[i].y * scaleVY;
              if (i === 0) ctx.moveTo(vx, vy);
              else ctx.lineTo(vx, vy);
            }
            ctx.closePath();
            
            // Fill with semi-transparent color
            ctx.fillStyle = sectionTile.color;
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;
            
            // Border - red for angled/triangular, amber for straight
            const isAngledCut = tilePos.cutType === 'angled' || tilePos.cutType === 'triangular';
            ctx.strokeStyle = isAngledCut ? '#ef4444' : '#f59e0b';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Show angle indicator and edge heights for angled cuts
            if (tilePos.cutAngle && screenTileW > 25 && screenTileH > 20) {
              ctx.fillStyle = isAngledCut ? '#ef4444' : '#f59e0b';
              ctx.font = 'bold 9px sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              const cutLabel = tilePos.cutType === 'triangular' ? '△' : `∠${tilePos.cutAngle.toFixed(0)}°`;
              ctx.fillText(cutLabel, screenTileX + 3, screenTileY + 2);
              
              // Show builder-friendly edge heights if available
              if (tilePos.leftEdgeHeight !== undefined && tilePos.rightEdgeHeight !== undefined && screenTileW > 40) {
                ctx.font = 'bold 8px sans-serif';
                ctx.fillStyle = '#1d4ed8'; // Blue for measurements
                
                // Left edge height
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${tilePos.leftEdgeHeight.toFixed(1)}`, screenTileX + 2, screenTileY + screenTileH - 2);
                
                // Right edge height
                ctx.textAlign = 'right';
                ctx.fillText(`${tilePos.rightEdgeHeight.toFixed(1)}`, screenTileX + screenTileW - 2, screenTileY + screenTileH - 2);
              }
            }
          } else {
            // Grid, staggered, and herringbone (non-rotated rendering)
            screenTileX = sectionX + tilePos.x * tileScaleX;
            screenTileY = sectionStartY + sectionHeight - (tilePos.y + (tilePos.cutHeight || tileH)) * tileScaleY;
            screenTileW = (tilePos.cutWidth || tileW) * tileScaleX - jointScaled;
            screenTileH = (tilePos.cutHeight || tileH) * tileScaleY - jointScaled;

            if (tilePos.isCut) {
              // Cut tile - distinct styling with semi-transparent fill
              ctx.fillStyle = sectionTile.color;
              ctx.globalAlpha = 0.6;
              ctx.fillRect(screenTileX, screenTileY, screenTileW, screenTileH);
              ctx.globalAlpha = 1;

              // Amber dashed border for cut tiles
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 2]);
              ctx.strokeRect(screenTileX + 1, screenTileY + 1, screenTileW - 2, screenTileH - 2);
              ctx.setLineDash([]);

              // Small scissors indicator
              if (screenTileW > 20 && screenTileH > 15) {
                ctx.fillStyle = '#f59e0b';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('✂', screenTileX + 3, screenTileY + 2);
              }
            } else {
              // Full tile - normal styling, use albedo bitmap if available
              if (albedoBitmap) {
                ctx.drawImage(albedoBitmap, screenTileX, screenTileY, screenTileW, screenTileH);
              } else {
                ctx.fillStyle = sectionTile.color;
                ctx.fillRect(screenTileX, screenTileY, screenTileW, screenTileH);
              }

              // Subtle border
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(screenTileX, screenTileY, screenTileW, screenTileH);
            }
          }

          // Store position for click detection
          tilePositionsRef.current.push({
            ...tilePos,
            screenX: screenTileX,
            screenY: screenTileY,
            screenWidth: screenTileW,
            screenHeight: screenTileH,
            sectionId: section.id,
          });
        }

        ctx.restore();
      }

      // Draw section selection border
      if (sections.length > 1 && section.id === selectedSectionId) {
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(sectionX + 2, sectionStartY + 2, sectionWidth - 4, sectionHeight - 4);
        ctx.setLineDash([]);
      }
    }

    // Draw dividers with handles
    for (const divider of dividers) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;

      if (divider.type === 'horizontal') {
        const y = startY + (1 - divider.position) * wallHeight;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + wallWidth, y);
        ctx.stroke();

        // Draw handle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(startX + wallWidth + 12, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↕', startX + wallWidth + 12, y);
      } else {
        const x = startX + divider.position * wallWidth;
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, startY + wallHeight);
        ctx.stroke();

        // Draw handle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, startY + wallHeight + 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↔', x, startY + wallHeight + 12);
      }
    }

    // Draw door and window openings on the elevation
    const wallDoors = floorPlan.doors.filter(d => d.wallId === wall.id);
    const wallWindows = floorPlan.windows.filter(w => w.wallId === wall.id);

    for (const door of wallDoors) {
      const doorWidthScaled = door.width * scale;
      const doorHeightScaled = door.height * scale;
      const doorCenterX = startX + door.position * wallWidth;
      const doorX = doorCenterX - doorWidthScaled / 2;
      const doorY = startY + wallHeight - doorHeightScaled;

      // Clear the opening area
      ctx.clearRect(doorX, doorY, doorWidthScaled, doorHeightScaled);

      // Fill with background color
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(doorX, doorY, doorWidthScaled, doorHeightScaled);

      // Draw door frame
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2;
      ctx.strokeRect(doorX, doorY, doorWidthScaled, doorHeightScaled);

      // Door label
      ctx.fillStyle = '#78716c';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Door', doorCenterX, doorY + doorHeightScaled / 2);
    }

    for (const win of wallWindows) {
      const winWidthScaled = win.width * scale;
      const winHeightScaled = win.height * scale;
      const sillScaled = win.sillHeight * scale;
      const winCenterX = startX + win.position * wallWidth;
      const winX = winCenterX - winWidthScaled / 2;
      const winY = startY + wallHeight - sillScaled - winHeightScaled;

      // Clear the opening area
      ctx.clearRect(winX, winY, winWidthScaled, winHeightScaled);

      // Fill with light blue (sky)
      ctx.fillStyle = '#dbeafe';
      ctx.fillRect(winX, winY, winWidthScaled, winHeightScaled);

      // Draw window frame
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2;
      ctx.strokeRect(winX, winY, winWidthScaled, winHeightScaled);

      // Cross panes
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(winCenterX, winY);
      ctx.lineTo(winCenterX, winY + winHeightScaled);
      ctx.moveTo(winX, winY + winHeightScaled / 2);
      ctx.lineTo(winX + winWidthScaled, winY + winHeightScaled / 2);
      ctx.stroke();

      // Window label
      ctx.fillStyle = '#78716c';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Window', winCenterX, winY + winHeightScaled / 2);
    }

    // Draw wall outline - trapezoidal for sloped walls
    ctx.strokeStyle = 'hsl(var(--foreground))';
    ctx.lineWidth = 2;
    
    if (dims.isSloped) {
      ctx.beginPath();
      ctx.moveTo(startX, startY + maxScaledHeight); // Bottom-left
      ctx.lineTo(startX + wallWidth, startY + maxScaledHeight); // Bottom-right
      ctx.lineTo(startX + wallWidth, startY + maxScaledHeight - scaledEndHeight); // Top-right
      ctx.lineTo(startX, startY + maxScaledHeight - scaledStartHeight); // Top-left
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(startX, startY, wallWidth, wallHeight);
    }

    // Draw dimensions
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${dims.length.toFixed(0)} cm`, width / 2, startY + maxScaledHeight + 8);
    
    if (dims.isSloped) {
      // Left side - start height
      ctx.save();
      ctx.translate(startX - 15, startY + maxScaledHeight - scaledStartHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${dims.startHeight.toFixed(0)} cm`, 0, 0);
      ctx.restore();
      
      // Right side - end height
      ctx.save();
      ctx.translate(startX + wallWidth + 15, startY + maxScaledHeight - scaledEndHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${dims.endHeight.toFixed(0)} cm`, 0, 0);
      ctx.restore();
      
      // Slope angle indicator at top
      const slopeAngle = Math.atan2(
        Math.abs(dims.endHeight - dims.startHeight), 
        dims.length
      ) * (180 / Math.PI);
      
      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.textAlign = 'center';
      const arrowDir = dims.endHeight > dims.startHeight ? '↗' : '↘';
      const topMidY = startY + maxScaledHeight - (scaledStartHeight + scaledEndHeight) / 2;
      ctx.fillText(`${arrowDir} ${slopeAngle.toFixed(1)}°`, width / 2, topMidY - 12);
    } else {
      // Single height for rectangular walls
      ctx.save();
      ctx.translate(startX - 12, startY + wallHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${dims.height.toFixed(0)} cm`, 0, 0);
      ctx.restore();
    }

    // Draw legend
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const legendY = height - 12;
    const bulletRadius = 4;
    let legendX = startX;

    // Full tile bullet
    ctx.fillStyle = 'hsl(var(--muted-foreground))';
    ctx.beginPath();
    ctx.arc(legendX + bulletRadius, legendY, bulletRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('Full tile', legendX + bulletRadius * 2 + 6, legendY);
    legendX += 95;

    // Straight cut bullet
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(legendX + bulletRadius, legendY, bulletRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText('Straight cut', legendX + bulletRadius * 2 + 6, legendY);
    legendX += 115;

    if (dims.isSloped) {
      // Angled cut bullet
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(legendX + bulletRadius, legendY, bulletRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText('Angled cut', legendX + bulletRadius * 2 + 6, legendY);
    }
    ctx.textBaseline = 'alphabetic';

  }, [wall, selectedTile, sections, selectedSectionId, dividers, groutColor, jointWidth, getWallDimensions, tiles, floorPlan.doors, floorPlan.windows, pbrMaterials, textureVersion]);

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Handle apply
  const handleApply = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!wall) return;
    
    const dims = getWallDimensions();
    const actualWallHeight = dims.height;
    
    const tileSections: Partial<WallTileSection>[] = sections
      .map(s => {
        const tileId = selectedTile?.id || s.tileId;
        if (!tileId) return null;
        return {
          tileId,
          orientation: s.orientation,
          pattern: s.pattern,
          offsetX: s.offsetX,
          offsetY: s.offsetY,
          groutColor,
          startPosition: s.bounds.x1,
          endPosition: s.bounds.x2,
          startHeight: s.bounds.y1 * actualWallHeight,
          endHeight: s.bounds.y2 * actualWallHeight,
          isSlopedWall: dims.isSloped,
          slopeAngle: dims.isSloped ? Math.atan2(Math.abs(dims.endHeight - dims.startHeight), dims.length) * (180 / Math.PI) : undefined,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    
    if (tileSections.length > 0) {
      if (onSaveSections) {
        onSaveSections(wall.id, tileSections);
      } else if (tileSections.length === 1) {
        onApplyTile(wall.id, tileSections[0]);
      }
    }
  }, [wall, sections, groutColor, selectedTile, getWallDimensions, onSaveSections, onApplyTile]);

  const handleApplyAll = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    const tileId = selectedTile?.id || selectedSection?.tileId;
    if (!tileId) return;
    onApplyToAll({
      tileId,
      orientation: selectedSection?.orientation || 'horizontal',
      pattern: selectedSection?.pattern || 'grid',
      offsetX: selectedSection?.offsetX || 0,
      offsetY: selectedSection?.offsetY || 0,
      groutColor,
    });
  }, [selectedSection, selectedTile, groutColor, onApplyToAll]);

  // Get tile for selected section - always prefer selectedTile if available
  const sectionTile = selectedTile 
    || (selectedSection?.tileId ? tiles.find(t => t.id === selectedSection.tileId) : null);

  return (
    <div className="h-full flex flex-col w-full">
      {/* Header */}
      <div className="border-b p-3 bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Wall Elevation Viewer
        </h3>
        {wall && (() => {
          const dims = getWallDimensions();
          return (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Wall {wallIndex + 1} • {dims.length.toFixed(0)}×{dims.height.toFixed(0)} cm
              </p>
              {dims.isSloped && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Sloped {Math.abs(dims.startHeight - dims.endHeight).toFixed(0)}cm
                </Badge>
              )}
              {dims.isCurved && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">
                  <Waves className="h-3 w-3 mr-1" />
                  Curved
                </Badge>
              )}
            </div>
          );
        })()}
      </div>

      {/* Section Tools */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/10 flex-wrap">
        <Button
          variant={dividerMode === 'horizontal' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setDividerMode(dividerMode === 'horizontal' ? 'none' : 'horizontal')}
        >
          <SplitSquareHorizontal className="h-3 w-3 mr-1" />
          H-Split
        </Button>
        <Button
          variant={dividerMode === 'vertical' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setDividerMode(dividerMode === 'vertical' ? 'none' : 'vertical')}
        >
          <SplitSquareVertical className="h-3 w-3 mr-1" />
          V-Split
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs min-w-[180px] justify-between">
              <span className="flex items-center gap-1.5">
                <LayoutTemplate className="h-3 w-3" />
                Layout Presets
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            {PRESET_LAYOUTS.map(preset => {
              const Icon = preset.icon;
              return (
                <DropdownMenuItem key={preset.id} onClick={() => applyPreset(preset.id)} className="gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {preset.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {dividers.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive ml-auto"
            onClick={clearDividers}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Divider mode indicator */}
      {dividerMode !== 'none' && (
        <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs text-center">
          Click on the wall to place a {dividerMode} divider
        </div>
      )}

      {/* Canvas - allow shrinking to make room for controls */}
      <div ref={containerRef} className="flex-1 min-h-[280px] overflow-hidden bg-muted/20 relative">
        <canvas 
          ref={canvasRef}
          onClick={handleCanvasClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ 
            cursor: dividerMode !== 'none' ? 'crosshair' : draggingDivider ? 'grabbing' : 'pointer',
            touchAction: 'none', // Prevents scrolling while dragging
          }}
        />
        
        {/* Cut tile popover */}
        {cutTilePopoverOpen && selectedCutTile && (() => {
          const containerWidth = containerRef.current?.clientWidth || 320;
          const containerHeight = containerRef.current?.clientHeight || 300;
          const popoverWidth = 224; // w-56 = 14rem = 224px
          const popoverHeight = 180; // Approximate height
          
          // Calculate smart position
          let left = selectedCutTile.x - popoverWidth / 2;
          let top = selectedCutTile.y - popoverHeight - 10;
          
          // Clamp horizontal to stay within container
          left = Math.max(8, Math.min(left, containerWidth - popoverWidth - 8));
          
          // If not enough room above, show below the tile
          if (top < 8) {
            top = selectedCutTile.y + 30;
          }
          
          // Clamp to bottom edge as well
          top = Math.min(top, containerHeight - popoverHeight - 8);
          top = Math.max(8, top);
          
          return (
            <div 
              className="absolute z-50 bg-popover border rounded-lg shadow-lg p-3 w-64"
              style={{ left, top }}
            >
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-amber-500" />
                  Cut Required
                  {selectedCutTile.cutAngle && selectedCutTile.cutAngle > 0 && (
                    <span className="text-xs text-red-500 font-normal">@ {selectedCutTile.cutAngle.toFixed(1)}°</span>
                  )}
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Original Size</p>
                    <p className="font-mono">{selectedCutTile.originalWidth}×{selectedCutTile.originalHeight} cm</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Cut To</p>
                    <p className="font-mono font-bold text-amber-600">
                      {selectedCutTile.cutWidth.toFixed(1)}×{selectedCutTile.cutHeight.toFixed(1)} cm
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="text-xs text-muted-foreground space-y-1">
                  {selectedCutTile.originalWidth !== selectedCutTile.cutWidth && (
                    <p>✂ Remove <strong>{(selectedCutTile.originalWidth - selectedCutTile.cutWidth).toFixed(1)} cm</strong> from width</p>
                  )}
                  {selectedCutTile.originalHeight !== selectedCutTile.cutHeight && (
                    <p>✂ Remove <strong>{(selectedCutTile.originalHeight - selectedCutTile.cutHeight).toFixed(1)} cm</strong> from height</p>
                  )}
                </div>
                
                {/* Builder-friendly edge measurements for angled cuts */}
                {selectedCutTile.leftEdgeHeight !== undefined && selectedCutTile.rightEdgeHeight !== undefined && (
                  <>
                    <Separator />
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1.5 flex items-center gap-1">
                        📐 Builder Mark Guide
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Left Edge</p>
                          <p className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {selectedCutTile.leftEdgeHeight.toFixed(1)} cm
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Right Edge</p>
                          <p className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {selectedCutTile.rightEdgeHeight.toFixed(1)} cm
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                        Mark both edges, connect with a line, cut!
                      </p>
                    </div>
                  </>
                )}
                
                <Button size="sm" variant="ghost" className="w-full text-xs" onClick={() => setCutTilePopoverOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Section Management - show only if multiple sections */}
      {sections.length > 1 && (
        <div className="p-2 border-t bg-muted/20">
          <Label className="text-xs font-medium mb-1.5 block">Wall Sections</Label>
          <div className="flex gap-1 flex-wrap mb-1.5">
            {sections.map((section, idx) => (
              <Button
                key={section.id}
                variant={selectedSectionId === section.id ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setSelectedSectionId(section.id)}
              >
                {String.fromCharCode(65 + idx)}
                {section.tileId && <Check className="h-3 w-3 ml-1" />}
              </Button>
            ))}
          </div>
          {selectedSection && (
            <p className="text-[10px] text-muted-foreground">
              Section {String.fromCharCode(65 + sections.findIndex(s => s.id === selectedSectionId))}
              {' • '}
              {((selectedSection.bounds.x2 - selectedSection.bounds.x1) * 100).toFixed(0)}% W
              × {((selectedSection.bounds.y2 - selectedSection.bounds.y1) * 100).toFixed(0)}% H
            </p>
          )}
        </div>
      )}

      {/* Divider List */}
      {dividers.length > 0 && (
        <div className="p-2 border-t bg-muted/10">
          <Label className="text-xs font-medium mb-1.5 block">Dividers</Label>
          <div className="space-y-1">
            {dividers.map((divider) => (
              <div key={divider.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  {divider.type === 'horizontal' ? 'Horizontal' : 'Vertical'} at {(divider.position * 100).toFixed(0)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => deleteDivider(divider.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls - always visible with internal scroll if needed */}
      <div className="flex-shrink-0 border-t flex flex-col">
          <div className="p-3 space-y-3">
          {/* Tile for section */}
          {sections.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Section Tile</Label>
              <Select
                value={selectedSection?.tileId || ''}
                onValueChange={(value) => updateSectionSettings('tileId', value)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select tile..." />
                </SelectTrigger>
                <SelectContent>
                  {tiles.map(tile => (
                    <SelectItem key={tile.id} value={tile.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded border"
                          style={{ backgroundColor: tile.color }}
                        />
                        <span className="text-xs">{tile.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Orientation */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tile Orientation</Label>
            <ToggleGroup 
              type="single" 
              value={selectedSection?.orientation || 'horizontal'} 
              onValueChange={(v) => v && updateSectionSettings('orientation', v as TileOrientation)}
              className="justify-start"
            >
              <ToggleGroupItem value="horizontal" className="gap-1 h-7 text-xs px-2">
                <RectangleHorizontal className="h-3 w-3" />
                Horizontal
              </ToggleGroupItem>
              <ToggleGroupItem value="vertical" className="gap-1 h-7 text-xs px-2">
                <RectangleVertical className="h-3 w-3" />
                Vertical
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Pattern */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pattern</Label>
            <Select 
              value={selectedSection?.pattern || 'grid'} 
              onValueChange={(v) => updateSectionSettings('pattern', v as TilePattern)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">
                  <div className="flex items-center gap-2 text-xs">
                    <Grid3X3 className="h-3 w-3" />
                    Grid (Stack Bond)
                  </div>
                </SelectItem>
                <SelectItem value="staggered">
                  <div className="flex items-center gap-2 text-xs">
                    <Layers className="h-3 w-3" />
                    Staggered (Brick)
                  </div>
                </SelectItem>
                <SelectItem value="herringbone">Herringbone</SelectItem>
                <SelectItem value="diagonal">Diagonal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Offset controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Offset X: {selectedSection?.offsetX || 0}%</Label>
              <Slider
                value={[selectedSection?.offsetX || 0]}
                onValueChange={([v]) => updateSectionSettings('offsetX', v)}
                min={0}
                max={100}
                step={5}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Offset Y: {selectedSection?.offsetY || 0}%</Label>
              <Slider
                value={[selectedSection?.offsetY || 0]}
                onValueChange={([v]) => updateSectionSettings('offsetY', v)}
                min={0}
                max={100}
                step={5}
              />
            </div>
          </div>

          {/* Grout color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Grout Color</Label>
            <div className="flex gap-1.5 flex-wrap">
              {GROUT_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    groutColor === color.value 
                      ? 'border-primary ring-2 ring-primary/30' 
                      : 'border-muted-foreground/20 hover:border-muted-foreground/50'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setGroutColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          </div>
        
        {/* Apply buttons - always visible outside scroll area */}
        <div className="p-3 pt-2 border-t bg-background space-y-1.5">
          <Button 
            className="w-full h-9 text-sm font-medium" 
            onClick={handleApply}
            disabled={!wall || !sectionTile}
          >
            <Check className="h-4 w-4 mr-1.5" />
            Apply to Wall {wallIndex >= 0 ? wallIndex + 1 : ''}
          </Button>
          <Button 
            variant="outline" 
            className="w-full h-8 text-xs" 
            onClick={handleApplyAll}
            disabled={!sectionTile}
          >
            <Paintbrush className="h-3 w-3 mr-1" />
            Apply to All Walls
          </Button>
        </div>
      </div>
    </div>
  );
};
