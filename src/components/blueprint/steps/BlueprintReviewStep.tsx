import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Check, Eye, EyeOff, Layers, Pencil, Move, Grid3X3, Plus, Trash2, Link2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FloorPlanAnalysis, AnalyzedWall } from '../BlueprintImportWizard';

interface BlueprintReviewStepProps {
  imageUrl: string;
  analysis: FloorPlanAnalysis;
  pixelsPerCm: number;
  onComplete: () => void;
  onBack: () => void;
  onUpdateAnalysis?: (analysis: FloorPlanAnalysis) => void;
}

interface DragState {
  wallId: string;
  endpoint: 'start' | 'end';
  originalX: number;
  originalY: number;
}

interface HoveredHandle {
  wallId: string;
  endpoint: 'start' | 'end';
}

type EditTool = 'move' | 'add' | 'delete';

const HANDLE_RADIUS = 8;
const SNAP_GRID = 10; // cm
const SNAP_ANGLE_TOLERANCE = 5; // degrees
const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const INTERSECTION_SNAP_DISTANCE = 15; // cm

export const BlueprintReviewStep: React.FC<BlueprintReviewStepProps> = ({
  imageUrl,
  analysis,
  pixelsPerCm,
  onComplete,
  onBack,
  onUpdateAnalysis,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [showWalls, setShowWalls] = useState(true);
  const [showDoors, setShowDoors] = useState(true);
  const [showWindows, setShowWindows] = useState(true);
  const [showRooms, setShowRooms] = useState(true);
  const [showImage, setShowImage] = useState(false);
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editTool, setEditTool] = useState<EditTool>('move');
  const [localAnalysis, setLocalAnalysis] = useState<FloorPlanAnalysis>(analysis);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandle | null>(null);
  const [hoveredWall, setHoveredWall] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number; type: 'grid' | 'angle' | 'intersection' } | null>(null);
  
  // Add wall state
  const [addWallStart, setAddWallStart] = useState<{ x: number; y: number } | null>(null);
  const [addWallPreview, setAddWallPreview] = useState<{ x: number; y: number } | null>(null);

  // Transform state for canvas coordinates
  const [canvasTransform, setCanvasTransform] = useState({ 
    drawX: 0, 
    drawY: 0, 
    fitScale: 1, 
    cmToCanvas: 1 
  });

  // Sync local analysis with prop changes
  useEffect(() => {
    setLocalAnalysis(analysis);
  }, [analysis]);

  const snapToGrid = useCallback((value: number): number => {
    return Math.round(value / SNAP_GRID) * SNAP_GRID;
  }, []);

  const snapToAngle = useCallback((startX: number, startY: number, endX: number, endY: number): { x: number; y: number } | null => {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 5) return null;

    const currentAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;

    for (const snapAngle of SNAP_ANGLES) {
      if (Math.abs(currentAngle - snapAngle) < SNAP_ANGLE_TOLERANCE) {
        const radians = snapAngle * Math.PI / 180;
        return {
          x: startX + Math.cos(radians) * length,
          y: startY + Math.sin(radians) * length,
        };
      }
    }
    return null;
  }, []);

  const snapToIntersection = useCallback((x: number, y: number, excludeWallId?: string): { x: number; y: number } | null => {
    for (const wall of localAnalysis.walls) {
      if (wall.id === excludeWallId) continue;

      // Check start point
      const distStart = Math.sqrt((wall.startX - x) ** 2 + (wall.startY - y) ** 2);
      if (distStart < INTERSECTION_SNAP_DISTANCE) {
        return { x: wall.startX, y: wall.startY };
      }

      // Check end point
      const distEnd = Math.sqrt((wall.endX - x) ** 2 + (wall.endY - y) ** 2);
      if (distEnd < INTERSECTION_SNAP_DISTANCE) {
        return { x: wall.endX, y: wall.endY };
      }
    }
    return null;
  }, [localAnalysis.walls]);

  // Find wall at position (for delete tool)
  const findWallAt = useCallback((canvasX: number, canvasY: number): string | null => {
    const { drawX, drawY, cmToCanvas } = canvasTransform;
    
    for (const wall of localAnalysis.walls) {
      const startX = drawX + wall.startX * cmToCanvas;
      const startY = drawY + wall.startY * cmToCanvas;
      const endX = drawX + wall.endX * cmToCanvas;
      const endY = drawY + wall.endY * cmToCanvas;
      
      // Calculate distance from point to line segment
      const dx = endX - startX;
      const dy = endY - startY;
      const lengthSq = dx * dx + dy * dy;
      
      if (lengthSq === 0) continue;
      
      const t = Math.max(0, Math.min(1, ((canvasX - startX) * dx + (canvasY - startY) * dy) / lengthSq));
      const projX = startX + t * dx;
      const projY = startY + t * dy;
      
      const dist = Math.sqrt((canvasX - projX) ** 2 + (canvasY - projY) ** 2);
      const wallWidth = Math.max(5, wall.thickness * cmToCanvas * 0.5);
      
      if (dist < wallWidth + 5) {
        return wall.id;
      }
    }
    return null;
  }, [localAnalysis.walls, canvasTransform]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let fitScale: number;
    let drawX: number;
    let drawY: number;
    let drawWidth: number;
    let drawHeight: number;
    let cmToCanvas: number;

    const useBboxFit = !showImage && localAnalysis.walls.length > 0;

    if (useBboxFit) {
      // Compute bounding box from all detected content
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      for (const wall of localAnalysis.walls) {
        minX = Math.min(minX, wall.startX, wall.endX);
        maxX = Math.max(maxX, wall.startX, wall.endX);
        minY = Math.min(minY, wall.startY, wall.endY);
        maxY = Math.max(maxY, wall.startY, wall.endY);
      }
      if (localAnalysis.doors) {
        for (const door of localAnalysis.doors) {
          minX = Math.min(minX, door.x);
          maxX = Math.max(maxX, door.x);
          minY = Math.min(minY, door.y);
          maxY = Math.max(maxY, door.y);
        }
      }
      if (localAnalysis.windows) {
        for (const win of localAnalysis.windows) {
          minX = Math.min(minX, win.x);
          maxX = Math.max(maxX, win.x);
          minY = Math.min(minY, win.y);
          maxY = Math.max(maxY, win.y);
        }
      }

      const bboxW = (maxX - minX) * 1.3 || 100;
      const bboxH = (maxY - minY) * 1.3 || 100;
      const bboxCenterX = (minX + maxX) / 2;
      const bboxCenterY = (minY + maxY) / 2;

      fitScale = Math.min(
        (canvas.width - 40) / bboxW,
        (canvas.height - 40) / bboxH
      );
      cmToCanvas = pixelsPerCm * fitScale;
      drawX = canvas.width / 2 - bboxCenterX * cmToCanvas;
      drawY = canvas.height / 2 - bboxCenterY * cmToCanvas;
      drawWidth = img.width * fitScale;
      drawHeight = img.height * fitScale;
    } else {
      // Image-based fit (default when showing image or no walls)
      fitScale = Math.min(
        (canvas.width - 40) / img.width,
        (canvas.height - 40) / img.height
      );
      drawWidth = img.width * fitScale;
      drawHeight = img.height * fitScale;
      drawX = (canvas.width - drawWidth) / 2;
      drawY = (canvas.height - drawHeight) / 2;
      cmToCanvas = pixelsPerCm * fitScale;
    }

    // Store transform for interaction
    setCanvasTransform({ drawX, drawY, fitScale, cmToCanvas });

    // Draw grid if enabled
    if (showGrid && editMode) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const gridSpacing = SNAP_GRID * cmToCanvas;
      
      for (let x = drawX; x < drawX + drawWidth; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, drawY);
        ctx.lineTo(x, drawY + drawHeight);
        ctx.stroke();
      }
      for (let y = drawY; y < drawY + drawHeight; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(drawX, y);
        ctx.lineTo(drawX + drawWidth, y);
        ctx.stroke();
      }
    }

    // Draw image
    if (showImage) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.globalAlpha = 1;
    }

    // Draw rooms (filled polygons)
    if (showRooms && localAnalysis.rooms) {
      localAnalysis.rooms.forEach((room, idx) => {
        if (room.vertices.length < 3) return;

        const colors = [
          'hsla(200, 70%, 50%, 0.15)',
          'hsla(120, 70%, 50%, 0.15)',
          'hsla(280, 70%, 50%, 0.15)',
          'hsla(40, 70%, 50%, 0.15)',
          'hsla(320, 70%, 50%, 0.15)',
        ];
        const color = colors[idx % colors.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        room.vertices.forEach((v, i) => {
          const x = drawX + v.x * cmToCanvas;
          const y = drawY + v.y * cmToCanvas;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();

        // Room label
        if (room.label) {
          const centerX = room.vertices.reduce((sum, v) => sum + v.x, 0) / room.vertices.length;
          const centerY = room.vertices.reduce((sum, v) => sum + v.y, 0) / room.vertices.length;
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(room.label, drawX + centerX * cmToCanvas, drawY + centerY * cmToCanvas);
        }
      });
    }

    // Draw walls
    if (showWalls && localAnalysis.walls) {
      localAnalysis.walls.forEach(wall => {
        const startX = drawX + wall.startX * cmToCanvas;
        const startY = drawY + wall.startY * cmToCanvas;
        const endX = drawX + wall.endX * cmToCanvas;
        const endY = drawY + wall.endY * cmToCanvas;

        // Highlight if hovered for delete
        const isHoveredForDelete = editMode && editTool === 'delete' && hoveredWall === wall.id;
        
        // Wall fill
        ctx.strokeStyle = isHoveredForDelete 
          ? 'hsl(0, 70%, 50%)' 
          : wall.isExterior 
          ? 'hsl(142, 70%, 45%)' 
          : 'hsl(142, 60%, 55%)';
        ctx.lineWidth = Math.max(3, wall.thickness * cmToCanvas * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Wall outline
        ctx.strokeStyle = isHoveredForDelete ? 'rgba(255, 100, 100, 0.5)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw handles in edit mode (move tool only)
        if (editMode && editTool === 'move') {
          // Start handle
          const isHoveredStart = hoveredHandle?.wallId === wall.id && hoveredHandle?.endpoint === 'start';
          const isDraggingStart = dragState?.wallId === wall.id && dragState?.endpoint === 'start';
          
          ctx.fillStyle = isDraggingStart 
            ? 'hsl(45, 80%, 50%)' 
            : isHoveredStart 
            ? 'hsl(45, 80%, 60%)' 
            : 'hsl(142, 70%, 50%)';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(startX, startY, HANDLE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // End handle
          const isHoveredEnd = hoveredHandle?.wallId === wall.id && hoveredHandle?.endpoint === 'end';
          const isDraggingEnd = dragState?.wallId === wall.id && dragState?.endpoint === 'end';
          
          ctx.fillStyle = isDraggingEnd 
            ? 'hsl(45, 80%, 50%)' 
            : isHoveredEnd 
            ? 'hsl(45, 80%, 60%)' 
            : 'hsl(200, 70%, 50%)';
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(endX, endY, HANDLE_RADIUS, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // Draw add wall preview
    if (editMode && editTool === 'add' && addWallStart && addWallPreview) {
      const startX = drawX + addWallStart.x * cmToCanvas;
      const startY = drawY + addWallStart.y * cmToCanvas;
      const endX = drawX + addWallPreview.x * cmToCanvas;
      const endY = drawY + addWallPreview.y * cmToCanvas;

      ctx.strokeStyle = 'hsl(200, 80%, 60%)';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start point
      ctx.fillStyle = 'hsl(142, 70%, 50%)';
      ctx.beginPath();
      ctx.arc(startX, startY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Preview end point
      ctx.fillStyle = 'hsl(200, 70%, 50%)';
      ctx.beginPath();
      ctx.arc(endX, endY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw snap indicator
    if (snapIndicator) {
      const indicatorX = drawX + snapIndicator.x * cmToCanvas;
      const indicatorY = drawY + snapIndicator.y * cmToCanvas;
      
      ctx.strokeStyle = snapIndicator.type === 'intersection' 
        ? 'hsl(280, 80%, 60%)' 
        : snapIndicator.type === 'angle'
        ? 'hsl(45, 80%, 60%)'
        : 'hsl(200, 80%, 60%)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw doors
    if (showDoors && localAnalysis.doors) {
      localAnalysis.doors.forEach(door => {
        const x = drawX + door.x * cmToCanvas;
        const y = drawY + door.y * cmToCanvas;
        const width = door.width * cmToCanvas;

        ctx.fillStyle = 'hsl(45, 80%, 50%)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(6, width / 4), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Door swing arc
        ctx.strokeStyle = 'hsla(45, 80%, 50%, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, width / 2, 0, Math.PI / 2);
        ctx.stroke();
      });
    }

    // Draw windows
    if (showWindows && localAnalysis.windows) {
      localAnalysis.windows.forEach(window => {
        const x = drawX + window.x * cmToCanvas;
        const y = drawY + window.y * cmToCanvas;
        const width = Math.max(10, window.width * cmToCanvas);

        ctx.fillStyle = 'hsl(200, 80%, 60%)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.fillRect(x - width / 2, y - 3, width, 6);
        ctx.strokeRect(x - width / 2, y - 3, width, 6);
      });
    }
  }, [localAnalysis, pixelsPerCm, showWalls, showDoors, showWindows, showRooms, showImage, editMode, editTool, hoveredHandle, hoveredWall, dragState, showGrid, snapIndicator, addWallStart, addWallPreview]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Convert canvas coordinates to cm
  const canvasToCm = useCallback((canvasX: number, canvasY: number) => {
    const { drawX, drawY, cmToCanvas } = canvasTransform;
    return {
      x: (canvasX - drawX) / cmToCanvas,
      y: (canvasY - drawY) / cmToCanvas,
    };
  }, [canvasTransform]);

  // Find handle at position
  const findHandleAt = useCallback((canvasX: number, canvasY: number): HoveredHandle | null => {
    const { drawX, drawY, cmToCanvas } = canvasTransform;
    
    for (const wall of localAnalysis.walls) {
      const startX = drawX + wall.startX * cmToCanvas;
      const startY = drawY + wall.startY * cmToCanvas;
      const endX = drawX + wall.endX * cmToCanvas;
      const endY = drawY + wall.endY * cmToCanvas;

      const distStart = Math.sqrt((canvasX - startX) ** 2 + (canvasY - startY) ** 2);
      if (distStart <= HANDLE_RADIUS + 4) {
        return { wallId: wall.id, endpoint: 'start' };
      }

      const distEnd = Math.sqrt((canvasX - endX) ** 2 + (canvasY - endY) ** 2);
      if (distEnd <= HANDLE_RADIUS + 4) {
        return { wallId: wall.id, endpoint: 'end' };
      }
    }
    return null;
  }, [localAnalysis.walls, canvasTransform]);

  // Delete wall handler
  const handleDeleteWall = useCallback((wallId: string) => {
    setLocalAnalysis(prev => ({
      ...prev,
      walls: prev.walls.filter(w => w.id !== wallId),
    }));
    toast.success('Wall deleted');
  }, []);

  // Auto-connect nearby endpoints
  const handleAutoConnect = useCallback(() => {
    const threshold = 20; // cm
    const walls = [...localAnalysis.walls];
    let connections = 0;

    // Collect all endpoints
    const endpoints: { wallId: string; endpoint: 'start' | 'end'; x: number; y: number }[] = [];
    for (const wall of walls) {
      endpoints.push({ wallId: wall.id, endpoint: 'start', x: wall.startX, y: wall.startY });
      endpoints.push({ wallId: wall.id, endpoint: 'end', x: wall.endX, y: wall.endY });
    }

    // Group nearby endpoints
    const clusters: typeof endpoints[] = [];
    const used = new Set<string>();

    for (const ep of endpoints) {
      if (used.has(`${ep.wallId}-${ep.endpoint}`)) continue;
      
      const cluster = [ep];
      used.add(`${ep.wallId}-${ep.endpoint}`);

      for (const other of endpoints) {
        if (used.has(`${other.wallId}-${other.endpoint}`)) continue;
        const dist = Math.sqrt((ep.x - other.x) ** 2 + (ep.y - other.y) ** 2);
        if (dist < threshold && dist > 0) {
          cluster.push(other);
          used.add(`${other.wallId}-${other.endpoint}`);
        }
      }

      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }

    // Snap each cluster to centroid
    for (const cluster of clusters) {
      const avgX = cluster.reduce((sum, ep) => sum + ep.x, 0) / cluster.length;
      const avgY = cluster.reduce((sum, ep) => sum + ep.y, 0) / cluster.length;

      for (const ep of cluster) {
        const wall = walls.find(w => w.id === ep.wallId);
        if (wall) {
          if (ep.endpoint === 'start') {
            wall.startX = Math.round(avgX);
            wall.startY = Math.round(avgY);
          } else {
            wall.endX = Math.round(avgX);
            wall.endY = Math.round(avgY);
          }
          connections++;
        }
      }
    }

    setLocalAnalysis(prev => ({ ...prev, walls }));
    toast.success(`Connected ${clusters.length} endpoint clusters (${connections} endpoints)`);
  }, [localAnalysis.walls]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!editMode) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (editTool === 'move') {
      const handle = findHandleAt(canvasX, canvasY);
      if (handle) {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        const wall = localAnalysis.walls.find(w => w.id === handle.wallId);
        if (wall) {
          setDragState({
            wallId: handle.wallId,
            endpoint: handle.endpoint,
            originalX: handle.endpoint === 'start' ? wall.startX : wall.endX,
            originalY: handle.endpoint === 'start' ? wall.startY : wall.endY,
          });
        }
      }
    } else if (editTool === 'add') {
      const pos = canvasToCm(canvasX, canvasY);
      
      // Apply snapping
      let newX = snapToGrid(pos.x);
      let newY = snapToGrid(pos.y);
      
      // Try intersection snap
      const intersectionSnap = snapToIntersection(newX, newY);
      if (intersectionSnap) {
        newX = intersectionSnap.x;
        newY = intersectionSnap.y;
      }

      if (!addWallStart) {
        setAddWallStart({ x: newX, y: newY });
      } else {
        // Complete the wall
        const newWall: AnalyzedWall = {
          id: `wall_user_${Date.now()}`,
          startX: addWallStart.x,
          startY: addWallStart.y,
          endX: newX,
          endY: newY,
          thickness: 15,
          confidence: 1,
          isExterior: false,
        };
        
        setLocalAnalysis(prev => ({
          ...prev,
          walls: [...prev.walls, newWall],
        }));
        
        setAddWallStart(null);
        setAddWallPreview(null);
        toast.success('Wall added');
      }
    } else if (editTool === 'delete') {
      const wallId = findWallAt(canvasX, canvasY);
      if (wallId) {
        handleDeleteWall(wallId);
      }
    }
  }, [editMode, editTool, findHandleAt, localAnalysis.walls, canvasToCm, snapToGrid, snapToIntersection, addWallStart, findWallAt, handleDeleteWall]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (editTool === 'move' && dragState) {
      const pos = canvasToCm(canvasX, canvasY);
      
      // Apply snapping
      let newX = snapToGrid(pos.x);
      let newY = snapToGrid(pos.y);
      let snapType: 'grid' | 'angle' | 'intersection' | null = 'grid';

      // Try intersection snap first (highest priority)
      const intersectionSnap = snapToIntersection(newX, newY, dragState.wallId);
      if (intersectionSnap) {
        newX = intersectionSnap.x;
        newY = intersectionSnap.y;
        snapType = 'intersection';
      } else {
        // Try angle snap
        const wall = localAnalysis.walls.find(w => w.id === dragState.wallId);
        if (wall) {
          const otherX = dragState.endpoint === 'start' ? wall.endX : wall.startX;
          const otherY = dragState.endpoint === 'start' ? wall.endY : wall.startY;
          const angleSnap = snapToAngle(otherX, otherY, newX, newY);
          if (angleSnap) {
            newX = angleSnap.x;
            newY = angleSnap.y;
            snapType = 'angle';
          }
        }
      }

      setSnapIndicator({ x: newX, y: newY, type: snapType });

      // Update wall
      setLocalAnalysis(prev => ({
        ...prev,
        walls: prev.walls.map(wall => {
          if (wall.id !== dragState.wallId) return wall;
          
          if (dragState.endpoint === 'start') {
            return { ...wall, startX: newX, startY: newY };
          } else {
            return { ...wall, endX: newX, endY: newY };
          }
        }),
      }));
    } else if (editMode) {
      if (editTool === 'move') {
        // Update hover state
        const handle = findHandleAt(canvasX, canvasY);
        setHoveredHandle(handle);
        
        if (canvasRef.current) {
          canvasRef.current.style.cursor = handle ? 'grab' : 'default';
        }
      } else if (editTool === 'add' && addWallStart) {
        // Update preview
        const pos = canvasToCm(canvasX, canvasY);
        let newX = snapToGrid(pos.x);
        let newY = snapToGrid(pos.y);
        
        const intersectionSnap = snapToIntersection(newX, newY);
        if (intersectionSnap) {
          newX = intersectionSnap.x;
          newY = intersectionSnap.y;
          setSnapIndicator({ x: newX, y: newY, type: 'intersection' });
        } else {
          const angleSnap = snapToAngle(addWallStart.x, addWallStart.y, newX, newY);
          if (angleSnap) {
            newX = angleSnap.x;
            newY = angleSnap.y;
            setSnapIndicator({ x: newX, y: newY, type: 'angle' });
          } else {
            setSnapIndicator({ x: newX, y: newY, type: 'grid' });
          }
        }
        
        setAddWallPreview({ x: newX, y: newY });
        
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'crosshair';
        }
      } else if (editTool === 'delete') {
        const wallId = findWallAt(canvasX, canvasY);
        setHoveredWall(wallId);
        
        if (canvasRef.current) {
          canvasRef.current.style.cursor = wallId ? 'pointer' : 'default';
        }
      }
    }
  }, [editMode, editTool, dragState, canvasToCm, snapToGrid, snapToIntersection, snapToAngle, findHandleAt, findWallAt, localAnalysis.walls, addWallStart]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragState) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      
      // Notify parent of changes
      onUpdateAnalysis?.(localAnalysis);
      
      setDragState(null);
      setSnapIndicator(null);
    }
  }, [dragState, localAnalysis, onUpdateAnalysis]);

  const handleComplete = useCallback(() => {
    // Ensure latest changes are saved
    onUpdateAnalysis?.(localAnalysis);
    onComplete();
  }, [localAnalysis, onUpdateAnalysis, onComplete]);

  // Cancel add wall on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && addWallStart) {
        setAddWallStart(null);
        setAddWallPreview(null);
        setSnapIndicator(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addWallStart]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex">
        {/* Canvas area */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-muted/30"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => {
              setHoveredHandle(null);
              setHoveredWall(null);
              if (canvasRef.current) {
                canvasRef.current.style.cursor = 'default';
              }
            }}
          />
          
          {/* Edit mode indicator */}
          {editMode && (
            <div className="absolute top-4 left-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
              {editTool === 'move' && <Move className="h-4 w-4" />}
              {editTool === 'add' && <Plus className="h-4 w-4" />}
              {editTool === 'delete' && <Trash2 className="h-4 w-4" />}
              {editTool === 'move' && 'Drag wall endpoints to adjust'}
              {editTool === 'add' && (addWallStart ? 'Click to set end point (Esc to cancel)' : 'Click to set start point')}
              {editTool === 'delete' && 'Click on a wall to delete it'}
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="w-72 border-l bg-background p-4 overflow-auto">
          {/* Edit Mode Toggle */}
          <div className="mb-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="edit-mode" className="flex items-center gap-2 font-medium">
                <Pencil className="h-4 w-4" />
                Edit Mode
              </Label>
              <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} />
            </div>
            <p className="text-xs text-muted-foreground">
              Enable to manually correct detection errors
            </p>
            
            {editMode && (
              <div className="mt-3 pt-3 border-t border-primary/20 space-y-3">
                {/* Tool buttons */}
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant={editTool === 'move' ? 'default' : 'outline'}
                    onClick={() => setEditTool('move')}
                    className="flex-1"
                  >
                    <Move className="h-3 w-3 mr-1" />
                    Move
                  </Button>
                  <Button 
                    size="sm" 
                    variant={editTool === 'add' ? 'default' : 'outline'}
                    onClick={() => { setEditTool('add'); setAddWallStart(null); setAddWallPreview(null); }}
                    className="flex-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                  <Button 
                    size="sm" 
                    variant={editTool === 'delete' ? 'destructive' : 'outline'}
                    onClick={() => setEditTool('delete')}
                    className="flex-1"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>

                {/* Auto-connect button */}
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleAutoConnect}
                  className="w-full"
                >
                  <Link2 className="h-3 w-3 mr-2" />
                  Auto-Connect Endpoints
                </Button>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-grid" className="flex items-center gap-2 text-xs">
                    <Grid3X3 className="h-3 w-3" />
                    Show Grid
                  </Label>
                  <Switch id="show-grid" checked={showGrid} onCheckedChange={setShowGrid} />
                </div>
              </div>
            )}
          </div>

          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Layer Visibility
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-image" className="flex items-center gap-2">
                {showImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Background
              </Label>
              <Switch id="show-image" checked={showImage} onCheckedChange={setShowImage} />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-walls">Walls</Label>
              <Switch id="show-walls" checked={showWalls} onCheckedChange={setShowWalls} />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-doors">Doors</Label>
              <Switch id="show-doors" checked={showDoors} onCheckedChange={setShowDoors} />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-windows">Windows</Label>
              <Switch id="show-windows" checked={showWindows} onCheckedChange={setShowWindows} />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-rooms">Rooms</Label>
              <Switch id="show-rooms" checked={showRooms} onCheckedChange={setShowRooms} />
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-3">Detection Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Walls</span>
                <Badge variant="secondary">{localAnalysis.walls.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Doors</span>
                <Badge variant="secondary">{localAnalysis.doors.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Windows</span>
                <Badge variant="secondary">{localAnalysis.windows.length}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rooms</span>
                <Badge variant="secondary">{localAnalysis.rooms.length}</Badge>
              </div>
            </div>
            
            <div className="mt-4 p-3 rounded bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium">{(localAnalysis.analysisConfidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          {editMode && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Tips
              </h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>• <strong>Move:</strong> Drag handles to adjust wall endpoints</li>
                <li>• <strong>Add:</strong> Click twice to create a new wall</li>
                <li>• <strong>Delete:</strong> Click on walls to remove them</li>
                <li>• <strong>Auto-Connect:</strong> Snap nearby endpoints together</li>
                <li>• Walls snap to grid ({SNAP_GRID}cm) and angles (0°, 45°, 90°)</li>
              </ul>
            </div>
          )}

          {/* Snapping legend */}
          {editMode && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-3 text-sm">Snapping</h3>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
                  <span>Grid snap ({SNAP_GRID}cm)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-yellow-500" />
                  <span>Angle snap (0°, 45°, 90°)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-purple-500" />
                  <span>Intersection snap</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 border-t bg-background">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleComplete} className="gap-2">
            <Check className="h-4 w-4" />
            Apply to Editor
          </Button>
        </div>
      </div>
    </div>
  );
};
