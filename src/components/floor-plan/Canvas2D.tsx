import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import type { Point, Wall, Door, Window as WindowType, Fixture, Column } from '@/types/floorPlan';
import { TILE_LIBRARY } from '@/types/floorPlan';
import { checkFixtureCollisions, getClearanceZone, FIXTURE_CLEARANCES } from '@/utils/collisionDetection';
import { useConnectionStatus, getOverallStatus, getConnectionStatusColor } from '@/hooks/useConnectionStatus';
import { getArcPoints, getBulgeHandlePosition, arcLength } from '@/utils/arcUtils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

type Tool = 'select' | 'wall' | 'door' | 'window' | 'pan' | 'column';

interface Canvas2DProps {
  activeTool: Tool;
  showGrid: boolean;
  gridSize: number;
  showTiles?: boolean;
  showRoutes?: boolean;
  editRoutes?: boolean;
  isDrawingWall?: boolean;
  setIsDrawingWall?: (drawing: boolean) => void;
  wallChainLength?: number;
  setWallChainLength?: (length: number) => void;
}

export const Canvas2D: React.FC<Canvas2DProps> = ({ 
  activeTool, 
  showGrid, 
  gridSize,
  showTiles = true,
  showRoutes = true,
  editRoutes = false,
  isDrawingWall = false,
  setIsDrawingWall,
  wallChainLength = 0,
  setWallChainLength
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    floorPlan, 
    setFloorPlan,
    addPoint, 
    addWall, 
    movePoint, 
    deletePoint,
    deleteWall,
    deleteDoor,
    deleteWindow,
    deleteFixture,
    moveFixture,
    rotateFixture,
    splitWall,
    insertPointOnWall,
    mergeWallsAtPoint,
    addDoor,
    addWindow,
    addColumn,
    moveColumn,
    deleteColumn,
    selectedElement, 
    setSelectedElement,
    layerVisibility
  } = useFloorPlanContext();

  // Route editing removed - now handled in MEPTab
  
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedPoint, setDraggedPoint] = useState<string | null>(null);
  const [draggedFixture, setDraggedFixture] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [fixtureOffset, setFixtureOffset] = useState({ x: 0, y: 0 });
  const [columnOffset, setColumnOffset] = useState({ x: 0, y: 0 });
  const [wallStartPoint, setWallStartPoint] = useState<string | null>(null);
  const [tempEndPoint, setTempEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverWallMidpoint, setHoverWallMidpoint] = useState<{ wallId: string; x: number; y: number } | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [hasCollision, setHasCollision] = useState(false);
  const [doorWindowPreview, setDoorWindowPreview] = useState<{ wallId: string; position: number; x: number; y: number } | null>(null);
  const [hoverRoutePoint, setHoverRoutePoint] = useState<{ routeType: 'plumbing' | 'electrical'; routeId: string; pointIndex: number } | null>(null);
  const [hoverRouteSegment, setHoverRouteSegment] = useState<{ routeType: 'plumbing' | 'electrical'; routeId: string; segmentIndex: number; x: number; y: number } | null>(null);
  const [wallChain, setWallChain] = useState<string[]>([]); // Track point IDs in current chain for undo
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<{ x: number; y: number; isCloseLoop: boolean } | null>(null);
  const [columnPreview, setColumnPreview] = useState<{ x: number; y: number } | null>(null);

  const connectionStatus = useConnectionStatus(floorPlan);

  const snapToGrid = useCallback((value: number): number => {
    return Math.round(value / gridSize) * gridSize;
  }, [gridSize]);

  const screenToWorld = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    return {
      x: (screenX - offset.x) / scale,
      y: (screenY - offset.y) / scale
    };
  }, [offset, scale]);

  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * scale + offset.x,
      y: worldY * scale + offset.y
    };
  }, [offset, scale]);

  const findPointAt = useCallback((worldX: number, worldY: number, threshold: number = 15): Point | null => {
    return floorPlan.points.find(p => {
      const dist = Math.sqrt((p.x - worldX) ** 2 + (p.y - worldY) ** 2);
      return dist < threshold / scale;
    }) || null;
  }, [floorPlan.points, scale]);

  const findWallAt = useCallback((worldX: number, worldY: number, threshold: number = 10): Wall | null => {
    for (const wall of floorPlan.walls) {
      const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
      const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!startPoint || !endPoint) continue;

      const lineLen = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
      const dot = ((worldX - startPoint.x) * (endPoint.x - startPoint.x) + 
                   (worldY - startPoint.y) * (endPoint.y - startPoint.y)) / (lineLen * lineLen);
      
      if (dot < 0 || dot > 1) continue;

      const closestX = startPoint.x + dot * (endPoint.x - startPoint.x);
      const closestY = startPoint.y + dot * (endPoint.y - startPoint.y);
      const dist = Math.sqrt((worldX - closestX) ** 2 + (worldY - closestY) ** 2);

      if (dist < (wall.thickness / 2 + threshold / scale)) {
        return wall;
      }
    }
    return null;
  }, [floorPlan.walls, floorPlan.points, scale]);

  const findFixtureAt = useCallback((worldX: number, worldY: number): Fixture | null => {
    for (const fixture of floorPlan.fixtures) {
      // Center-based hit detection with rotation
      const rad = (fixture.rotation * Math.PI) / 180;
      const cos = Math.cos(-rad);
      const sin = Math.sin(-rad);
      
      // Transform point to fixture local space (relative to center)
      const dx = worldX - fixture.cx;
      const dy = worldY - fixture.cy;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      
      // Check if within half-width/half-depth from center
      if (Math.abs(localX) <= fixture.width / 2 &&
          Math.abs(localY) <= fixture.depth / 2) {
        return fixture;
      }
    }
    return null;
  }, [floorPlan.fixtures]);

  const findDoorAt = useCallback((worldX: number, worldY: number): Door | null => {
    for (const door of floorPlan.doors) {
      const wall = floorPlan.walls.find(w => w.id === door.wallId);
      if (!wall) continue;
      const start = floorPlan.points.find(p => p.id === wall.startPointId);
      const end = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!start || !end) continue;

      const doorX = start.x + (end.x - start.x) * door.position;
      const doorY = start.y + (end.y - start.y) * door.position;
      const dist = Math.sqrt((worldX - doorX) ** 2 + (worldY - doorY) ** 2);
      
      if (dist < door.width / 2) {
        return door;
      }
    }
    return null;
  }, [floorPlan.doors, floorPlan.walls, floorPlan.points]);

  const findWindowAt = useCallback((worldX: number, worldY: number): WindowType | null => {
    for (const window of floorPlan.windows) {
      const wall = floorPlan.walls.find(w => w.id === window.wallId);
      if (!wall) continue;
      const start = floorPlan.points.find(p => p.id === wall.startPointId);
      const end = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!start || !end) continue;

      const winX = start.x + (end.x - start.x) * window.position;
      const winY = start.y + (end.y - start.y) * window.position;
      const dist = Math.sqrt((worldX - winX) ** 2 + (worldY - winY) ** 2);
      
      if (dist < window.width / 2) {
        return window;
      }
    }
    return null;
  }, [floorPlan.windows, floorPlan.walls, floorPlan.points]);

  const findColumnAt = useCallback((worldX: number, worldY: number): Column | null => {
    for (const column of floorPlan.columns || []) {
      // Transform point to column local space (with rotation)
      const rad = (column.rotation * Math.PI) / 180;
      const cos = Math.cos(-rad);
      const sin = Math.sin(-rad);
      const dx = worldX - column.x;
      const dy = worldY - column.y;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      
      const halfW = column.width / 2;
      const halfD = column.depth / 2;
      
      switch (column.shape) {
        case 'round':
          if (Math.sqrt(dx * dx + dy * dy) < halfW) return column;
          break;
        case 'square':
        case 'rectangle':
          if (localX >= -halfW && localX <= halfW && localY >= -halfD && localY <= halfD) return column;
          break;
        case 'l-shaped':
        case 't-shaped':
          // Simplified bounding box for L and T shapes
          if (localX >= -halfW && localX <= halfW && localY >= -halfD && localY <= halfD) return column;
          break;
        case 'hexagonal':
        case 'octagonal':
          // Use inscribed circle for hit testing polygonal shapes
          if (Math.sqrt(localX * localX + localY * localY) < halfW * 0.9) return column;
          break;
      }
    }
    return null;
  }, [floorPlan.columns]);

  // Find insertion point on wall - allows clicking ANYWHERE on wall to insert junction
  const findWallInsertionPoint = useCallback((worldX: number, worldY: number, threshold: number = 20): { wallId: string; x: number; y: number; position: number } | null => {
    for (const wall of floorPlan.walls) {
      const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
      const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!startPoint || !endPoint) continue;

      const lineLen = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
      const dot = ((worldX - startPoint.x) * (endPoint.x - startPoint.x) + 
                   (worldY - startPoint.y) * (endPoint.y - startPoint.y)) / (lineLen * lineLen);
      
      // Allow insertion anywhere from 5% to 95% of wall (not too close to endpoints)
      if (dot < 0.05 || dot > 0.95) continue;

      const closestX = startPoint.x + dot * (endPoint.x - startPoint.x);
      const closestY = startPoint.y + dot * (endPoint.y - startPoint.y);
      const dist = Math.sqrt((worldX - closestX) ** 2 + (worldY - closestY) ** 2);

      if (dist < threshold / scale) {
        return { wallId: wall.id, x: closestX, y: closestY, position: dot };
      }
    }
    return null;
  }, [floorPlan.walls, floorPlan.points, scale]);

  // Count how many walls connect to a point
  const getConnectedWallCount = useCallback((pointId: string): number => {
    return floorPlan.walls.filter(
      w => w.startPointId === pointId || w.endPointId === pointId
    ).length;
  }, [floorPlan.walls]);

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw grid - thin white lines for high-tech look
    if (showGrid) {
      ctx.strokeStyle = 'rgba(201, 169, 110, 0.12)'; // Gold grid
      ctx.lineWidth = 0.5;
      const gridStart = screenToWorld(0, 0);
      const gridEnd = screenToWorld(width, height);
      
      for (let x = snapToGrid(gridStart.x); x <= gridEnd.x; x += gridSize) {
        const screenX = worldToScreen(x, 0).x;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
        ctx.stroke();
      }
      
      for (let y = snapToGrid(gridStart.y); y <= gridEnd.y; y += gridSize) {
        const screenY = worldToScreen(0, y).y;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
        ctx.stroke();
      }
    }

    // Draw walls with dimension labels and tile patterns (supports curved walls)
    floorPlan.walls.forEach(wall => {
      const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
      const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!startPoint || !endPoint) return;

      const start = worldToScreen(startPoint.x, startPoint.y);
      const end = worldToScreen(endPoint.x, endPoint.y);

      const isSelected = selectedElement?.type === 'wall' && selectedElement.id === wall.id;
      const isCurved = wall.isCurved && wall.bulge;
      
      // Get tile section for this wall
      const tileSection = showTiles && layerVisibility.tiles 
        ? floorPlan.tileSections.find(s => s.wallId === wall.id) 
        : null;
      const tile = tileSection ? TILE_LIBRARY.find(t => t.id === tileSection.tileId) : null;
      
      // Calculate wall length (arc length for curved walls)
      const wallLength = isCurved 
        ? arcLength(startPoint, endPoint, wall.bulge!) 
        : Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
      
      // Draw wall path (curved or straight)
      const drawWallPath = () => {
        ctx.beginPath();
        if (isCurved) {
          const arcPoints = getArcPoints(startPoint, endPoint, wall.bulge!, 32);
          const screenPoints = arcPoints.map(p => worldToScreen(p.x, p.y));
          ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
          for (let i = 1; i < screenPoints.length; i++) {
            ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
          }
        } else {
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        }
      };
      
      // Neon color definitions - thinner and less opaque
      const neonEdge = isSelected ? 'hsla(38, 80%, 68%, 0.8)' : 'hsla(38, 60%, 58%, 0.7)';
      const glassFill = 'hsla(38, 30%, 20%, 0.4)';
      
      // Calculate wall angle
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const perpAngle = angle + Math.PI / 2;
      const halfThickness = (wall.thickness * scale) / 2;
      const offsetX = Math.cos(perpAngle) * halfThickness;
      const offsetY = Math.sin(perpAngle) * halfThickness;
      
      // Draw wall as filled polygon with glassmorphism + thin glowing edge
      if (isCurved) {
        // For curved walls, draw as thick stroke with fill
        const arcPoints = getArcPoints(startPoint, endPoint, wall.bulge!, 32);
        const screenPoints = arcPoints.map(p => worldToScreen(p.x, p.y));
        
        // Glassmorphism fill
        ctx.strokeStyle = glassFill;
        ctx.lineWidth = wall.thickness * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        ctx.stroke();
        
        // Thin glowing edge
        ctx.shadowColor = neonEdge;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = neonEdge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Four corners of wall rectangle
        const p1 = { x: start.x - offsetX, y: start.y - offsetY };
        const p2 = { x: start.x + offsetX, y: start.y + offsetY };
        const p3 = { x: end.x + offsetX, y: end.y + offsetY };
        const p4 = { x: end.x - offsetX, y: end.y - offsetY };
        
        // Glassmorphism fill
        ctx.fillStyle = glassFill;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        
        // Thin glowing edge stroke
        ctx.shadowColor = neonEdge;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = neonEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw dimension line along the OUTER edge of the wall (accounting for thickness)
      const dimOffset = halfThickness + 15;
      // Dimension line endpoints are at the outer edge of the wall thickness
      const dimX1 = start.x + Math.cos(perpAngle) * dimOffset;
      const dimY1 = start.y + Math.sin(perpAngle) * dimOffset;
      const dimX2 = end.x + Math.cos(perpAngle) * dimOffset;
      const dimY2 = end.y + Math.sin(perpAngle) * dimOffset;
      
      // White dimension lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Left tick
      ctx.moveTo(dimX1 - Math.cos(perpAngle) * 4, dimY1 - Math.sin(perpAngle) * 4);
      ctx.lineTo(dimX1 + Math.cos(perpAngle) * 4, dimY1 + Math.sin(perpAngle) * 4);
      // Right tick
      ctx.moveTo(dimX2 - Math.cos(perpAngle) * 4, dimY2 - Math.sin(perpAngle) * 4);
      ctx.lineTo(dimX2 + Math.cos(perpAngle) * 4, dimY2 + Math.sin(perpAngle) * 4);
      // Connecting line
      ctx.moveTo(dimX1, dimY1);
      ctx.lineTo(dimX2, dimY2);
      ctx.stroke();
      
      // White dimension text
      const dimMidX = (dimX1 + dimX2) / 2;
      const dimMidY = (dimY1 + dimY2) / 2;
      ctx.save();
      ctx.translate(dimMidX, dimMidY);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${wallLength.toFixed(0)} cm`, 0, -4);
      ctx.restore();
      
      // Draw bulge handle for selected curved walls
      if (isSelected && isCurved) {
        const handlePos = getBulgeHandlePosition(startPoint, endPoint, wall.bulge!);
        const handleScreen = worldToScreen(handlePos.x, handlePos.y);
        
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.strokeStyle = 'hsl(var(--background))';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(handleScreen.x, handleScreen.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw curved indicator
        ctx.strokeStyle = 'hsl(var(--primary) / 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo((start.x + end.x) / 2, (start.y + end.y) / 2);
        ctx.lineTo(handleScreen.x, handleScreen.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw doors on this wall
      floorPlan.doors.filter(d => d.wallId === wall.id).forEach(door => {
        const doorX = startPoint.x + (endPoint.x - startPoint.x) * door.position;
        const doorY = startPoint.y + (endPoint.y - startPoint.y) * door.position;
        const doorScreen = worldToScreen(doorX, doorY);
        
        const doorAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        const doorHalfWidth = (door.width / 2) * scale;
        
        // Draw door opening (gap in wall)
        ctx.strokeStyle = 'hsl(var(--background))';
        ctx.lineWidth = (wall.thickness + 4) * scale;
        ctx.beginPath();
        ctx.moveTo(
          doorScreen.x - Math.cos(doorAngle) * doorHalfWidth,
          doorScreen.y - Math.sin(doorAngle) * doorHalfWidth
        );
        ctx.lineTo(
          doorScreen.x + Math.cos(doorAngle) * doorHalfWidth,
          doorScreen.y + Math.sin(doorAngle) * doorHalfWidth
        );
        ctx.stroke();

        // Draw door swing arc
        const isDoorSelected = selectedElement?.type === 'door' && selectedElement.id === door.id;
        ctx.strokeStyle = isDoorSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const swingAngle = door.type.includes('left') ? -Math.PI / 2 : Math.PI / 2;
        ctx.arc(
          doorScreen.x - Math.cos(doorAngle) * doorHalfWidth,
          doorScreen.y - Math.sin(doorAngle) * doorHalfWidth,
          door.width * scale,
          doorAngle,
          doorAngle + swingAngle,
          door.type.includes('left')
        );
        ctx.stroke();
      });

      // Draw windows on this wall
      floorPlan.windows.filter(w => w.wallId === wall.id).forEach(window => {
        const winX = startPoint.x + (endPoint.x - startPoint.x) * window.position;
        const winY = startPoint.y + (endPoint.y - startPoint.y) * window.position;
        const winScreen = worldToScreen(winX, winY);
        
        const winAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        const winHalfWidth = (window.width / 2) * scale;
        
        const isWindowSelected = selectedElement?.type === 'window' && selectedElement.id === window.id;
        
        // Draw window (thinner line with different color)
        ctx.strokeStyle = isWindowSelected ? 'hsl(var(--primary))' : 'hsl(210 100% 50%)';
        ctx.lineWidth = (wall.thickness / 2) * scale;
        ctx.beginPath();
        ctx.moveTo(
          winScreen.x - Math.cos(winAngle) * winHalfWidth,
          winScreen.y - Math.sin(winAngle) * winHalfWidth
        );
        ctx.lineTo(
          winScreen.x + Math.cos(winAngle) * winHalfWidth,
          winScreen.y + Math.sin(winAngle) * winHalfWidth
        );
        ctx.stroke();

        // Draw window frame
        ctx.strokeStyle = isWindowSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          winScreen.x - winHalfWidth,
          winScreen.y - wall.thickness * scale / 2,
          window.width * scale,
          wall.thickness * scale
        );
      });
    });

    // Draw main connection points
    const mainConns = floorPlan.mainConnections;
    
    // Water supply point
    const supplyScreen = worldToScreen(mainConns.waterSupply.x, mainConns.waterSupply.y);
    ctx.fillStyle = 'hsl(210 100% 50%)';
    ctx.strokeStyle = 'hsl(var(--background))';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(supplyScreen.x, supplyScreen.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'hsl(var(--background))';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('W', supplyScreen.x, supplyScreen.y);

    // Drainage point
    const drainScreen = worldToScreen(mainConns.drainage.x, mainConns.drainage.y);
    ctx.fillStyle = 'hsl(30 60% 40%)';
    ctx.strokeStyle = 'hsl(var(--background))';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(drainScreen.x, drainScreen.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'hsl(var(--background))';
    ctx.fillText('D', drainScreen.x, drainScreen.y);

    // Electrical point
    const elecScreen = worldToScreen(mainConns.electrical.x, mainConns.electrical.y);
    ctx.fillStyle = 'hsl(45 100% 50%)';
    ctx.strokeStyle = 'hsl(var(--background))';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(elecScreen.x, elecScreen.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.fillText('E', elecScreen.x, elecScreen.y);

    // Draw plumbing routes with control points
    if (showRoutes && layerVisibility.plumbing) {
      floorPlan.plumbingRoutes.forEach(route => {
        if (route.points.length < 2) return;
        const isManual = route.isManual;
        ctx.strokeStyle = route.type === 'water-supply' ? 'hsl(210 100% 50%)' : 'hsl(30 60% 40%)';
        ctx.lineWidth = isManual ? 4 : 3;
        ctx.setLineDash(isManual ? [] : [5, 5]);
        ctx.beginPath();
        const firstPoint = worldToScreen(route.points[0].x, route.points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < route.points.length; i++) {
          const point = worldToScreen(route.points[i].x, route.points[i].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw control points if in edit mode (disabled - MEP editing moved to MEP tab)
        if (editRoutes) {
          route.points.forEach((point, idx) => {
            const screen = worldToScreen(point.x, point.y);
            const isHovered = hoverRoutePoint?.routeType === 'plumbing' && 
                              hoverRoutePoint.routeId === route.id && 
                              hoverRoutePoint.pointIndex === idx;
            
            ctx.fillStyle = isHovered ? 'hsl(210 100% 60%)' : 
                           route.type === 'water-supply' ? 'hsl(210 100% 50%)' : 'hsl(30 60% 40%)';
            ctx.strokeStyle = 'hsl(var(--background))';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, isHovered ? 6 : 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }

        // Show lock icon for manual routes
        if (isManual && route.points.length > 0) {
          const lastPoint = worldToScreen(route.points[route.points.length - 1].x, route.points[route.points.length - 1].y);
          ctx.fillStyle = 'hsl(var(--muted-foreground))';
          ctx.font = '10px sans-serif';
          ctx.fillText('🔒', lastPoint.x + 8, lastPoint.y - 8);
        }
      });
    }

    // Draw electrical routes with control points
    if (showRoutes && layerVisibility.electrical) {
      floorPlan.electricalRoutes.forEach(route => {
        if (route.points.length < 2) return;
        const isManual = route.isManual;
        ctx.strokeStyle = 'hsl(45 100% 50%)';
        ctx.lineWidth = isManual ? 3 : 2;
        ctx.setLineDash(isManual ? [] : [3, 3]);
        ctx.beginPath();
        const firstPoint = worldToScreen(route.points[0].x, route.points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < route.points.length; i++) {
          const point = worldToScreen(route.points[i].x, route.points[i].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw control points if in edit mode (disabled - MEP editing moved to MEP tab)
        if (editRoutes) {
          route.points.forEach((point, idx) => {
            const screen = worldToScreen(point.x, point.y);
            const isHovered = hoverRoutePoint?.routeType === 'electrical' && 
                              hoverRoutePoint.routeId === route.id && 
                              hoverRoutePoint.pointIndex === idx;
            
            ctx.fillStyle = isHovered ? 'hsl(45 100% 60%)' : 'hsl(45 100% 50%)';
            ctx.strokeStyle = 'hsl(var(--background))';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, isHovered ? 6 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }

        // Show lock icon for manual routes
        if (isManual && route.points.length > 0) {
          const lastPoint = worldToScreen(route.points[route.points.length - 1].x, route.points[route.points.length - 1].y);
          ctx.fillStyle = 'hsl(var(--muted-foreground))';
          ctx.font = '10px sans-serif';
          ctx.fillText('🔒', lastPoint.x + 8, lastPoint.y - 8);
        }
      });
    }

    // Draw route segment insertion indicator (when hovering over segment in edit mode)
    if (editRoutes && hoverRouteSegment) {
      const screen = worldToScreen(hoverRouteSegment.x, hoverRouteSegment.y);
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw + sign
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screen.x - 3, screen.y);
      ctx.lineTo(screen.x + 3, screen.y);
      ctx.moveTo(screen.x, screen.y - 3);
      ctx.lineTo(screen.x, screen.y + 3);
      ctx.stroke();
    }

    // Fixtures are now rendered in the 3D view - removed from 2D canvas

    // Draw columns with all shape types
    (floorPlan.columns || []).forEach(column => {
      const pos = worldToScreen(column.x, column.y);
      const isSelected = selectedElement?.type === 'column' && selectedElement.id === column.id;
      const isDragging = draggedColumn === column.id;
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      
      // Set common styles
      ctx.fillStyle = isDragging 
        ? 'hsl(var(--primary) / 0.5)' 
        : isSelected 
          ? 'hsl(var(--primary) / 0.3)' 
          : column.isStructural 
            ? 'hsl(var(--muted))' 
            : 'hsl(var(--accent))';
      ctx.strokeStyle = isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))';
      ctx.lineWidth = 2;
      
      // Apply rotation for non-round shapes
      if (column.shape !== 'round') {
        ctx.rotate(column.rotation * Math.PI / 180);
      }
      
      const halfW = (column.width / 2) * scale;
      const halfD = (column.depth / 2) * scale;
      const armW = ((column.armWidth ?? 15) / 2) * scale;
      const armL = (column.armLength ?? 20) * scale;
      
      switch (column.shape) {
        case 'round':
          ctx.beginPath();
          ctx.arc(0, 0, halfW, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Structural cross
          if (column.isStructural) {
            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-halfW * 0.7, 0);
            ctx.lineTo(halfW * 0.7, 0);
            ctx.moveTo(0, -halfW * 0.7);
            ctx.lineTo(0, halfW * 0.7);
            ctx.stroke();
          }
          break;
          
        case 'square':
        case 'rectangle':
          ctx.fillRect(-halfW, -halfD, column.width * scale, column.depth * scale);
          ctx.strokeRect(-halfW, -halfD, column.width * scale, column.depth * scale);
          // Structural X pattern
          if (column.isStructural) {
            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-halfW * 0.8, -halfD * 0.8);
            ctx.lineTo(halfW * 0.8, halfD * 0.8);
            ctx.moveTo(halfW * 0.8, -halfD * 0.8);
            ctx.lineTo(-halfW * 0.8, halfD * 0.8);
            ctx.stroke();
          }
          break;
          
        case 'l-shaped':
          // L-shape: main body with arm extending right and down
          ctx.beginPath();
          ctx.moveTo(-halfW, -halfD);
          ctx.lineTo(halfW, -halfD);
          ctx.lineTo(halfW, -halfD + armW * 2);
          ctx.lineTo(-halfW + armW * 2, -halfD + armW * 2);
          ctx.lineTo(-halfW + armW * 2, halfD);
          ctx.lineTo(-halfW, halfD);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Structural indicator
          if (column.isStructural) {
            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-halfW + armW, -halfD + armW);
            ctx.lineTo(-halfW + armW, halfD - armW);
            ctx.moveTo(-halfW + armW, -halfD + armW);
            ctx.lineTo(halfW - armW, -halfD + armW);
            ctx.stroke();
          }
          break;
          
        case 't-shaped':
          // T-shape: horizontal bar on top, vertical stem below
          ctx.beginPath();
          // Top bar
          ctx.moveTo(-halfW, -halfD);
          ctx.lineTo(halfW, -halfD);
          ctx.lineTo(halfW, -halfD + armW * 2);
          ctx.lineTo(armW, -halfD + armW * 2);
          ctx.lineTo(armW, halfD);
          ctx.lineTo(-armW, halfD);
          ctx.lineTo(-armW, -halfD + armW * 2);
          ctx.lineTo(-halfW, -halfD + armW * 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Structural indicator
          if (column.isStructural) {
            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -halfD + armW);
            ctx.lineTo(0, halfD - armW);
            ctx.moveTo(-halfW + armW, -halfD + armW);
            ctx.lineTo(halfW - armW, -halfD + armW);
            ctx.stroke();
          }
          break;
          
        case 'hexagonal':
          // Regular hexagon
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const x = halfW * Math.cos(angle);
            const y = halfW * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Structural pattern
          if (column.isStructural) {
            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
              const angle1 = (Math.PI / 3) * i - Math.PI / 6;
              const angle2 = angle1 + Math.PI;
              ctx.moveTo(halfW * 0.6 * Math.cos(angle1), halfW * 0.6 * Math.sin(angle1));
              ctx.lineTo(halfW * 0.6 * Math.cos(angle2), halfW * 0.6 * Math.sin(angle2));
            }
            ctx.stroke();
          }
          break;
          
        case 'octagonal':
          // Regular octagon
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i - Math.PI / 8;
            const x = halfW * Math.cos(angle);
            const y = halfW * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Structural pattern
          if (column.isStructural) {
            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-halfW * 0.5, -halfW * 0.5);
            ctx.lineTo(halfW * 0.5, halfW * 0.5);
            ctx.moveTo(halfW * 0.5, -halfW * 0.5);
            ctx.lineTo(-halfW * 0.5, halfW * 0.5);
            ctx.moveTo(-halfW * 0.7, 0);
            ctx.lineTo(halfW * 0.7, 0);
            ctx.moveTo(0, -halfW * 0.7);
            ctx.lineTo(0, halfW * 0.7);
            ctx.stroke();
          }
          break;
      }
      
      ctx.restore();
    });

    // Draw column placement preview (rectangle by default)
    if (columnPreview && activeTool === 'column') {
      const previewScreen = worldToScreen(columnPreview.x, columnPreview.y);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      // Draw rectangle preview (default shape)
      const previewSize = 15 * scale;
      ctx.fillRect(previewScreen.x - previewSize, previewScreen.y - previewSize, previewSize * 2, previewSize * 2);
      ctx.strokeRect(previewScreen.x - previewSize, previewScreen.y - previewSize, previewSize * 2, previewSize * 2);
      ctx.globalAlpha = 1;
    }

    // Corner points removed - walls render with their own edges

    // Draw wall junction insertion indicator (hover feedback)
    if (hoverWallMidpoint && activeTool === 'select') {
      const screen = worldToScreen(hoverWallMidpoint.x, hoverWallMidpoint.y);
      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Draw + sign to indicate "add junction"
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(screen.x - 4, screen.y);
      ctx.lineTo(screen.x + 4, screen.y);
      ctx.moveTo(screen.x, screen.y - 4);
      ctx.lineTo(screen.x, screen.y + 4);
      ctx.stroke();
    }

    // Draw temporary wall being created
    if (wallStartPoint && tempEndPoint) {
      const startPoint = floorPlan.points.find(p => p.id === wallStartPoint);
      if (startPoint) {
        const start = worldToScreen(startPoint.x, startPoint.y);
        const end = worldToScreen(tempEndPoint.x, tempEndPoint.y);
        
        ctx.strokeStyle = 'hsl(var(--primary) / 0.5)';
        ctx.lineWidth = 15 * scale;
        ctx.lineCap = 'round';
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Show length while drawing
        const tempLength = Math.sqrt((tempEndPoint.x - startPoint.x) ** 2 + (tempEndPoint.y - startPoint.y) ** 2);
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tempLength.toFixed(0)} cm`, midX, midY - 15);
      }
    }

    // Draw door/window preview when using those tools
    if (doorWindowPreview && (activeTool === 'door' || activeTool === 'window')) {
      const previewScreen = worldToScreen(doorWindowPreview.x, doorWindowPreview.y);
      const wall = floorPlan.walls.find(w => w.id === doorWindowPreview.wallId);
      if (wall) {
        const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
        const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
        if (startPoint && endPoint) {
          const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
          const previewWidth = activeTool === 'door' ? 90 : 120;
          const halfWidth = (previewWidth / 2) * scale;
          
          ctx.save();
          ctx.globalAlpha = 0.6;
          
          if (activeTool === 'door') {
            // Door preview
            ctx.strokeStyle = 'hsl(var(--primary))';
            ctx.lineWidth = (wall.thickness + 4) * scale;
            ctx.beginPath();
            ctx.moveTo(
              previewScreen.x - Math.cos(angle) * halfWidth,
              previewScreen.y - Math.sin(angle) * halfWidth
            );
            ctx.lineTo(
              previewScreen.x + Math.cos(angle) * halfWidth,
              previewScreen.y + Math.sin(angle) * halfWidth
            );
            ctx.stroke();
            
            // Swing arc
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
              previewScreen.x - Math.cos(angle) * halfWidth,
              previewScreen.y - Math.sin(angle) * halfWidth,
              previewWidth * scale,
              angle,
              angle + Math.PI / 2,
              false
            );
            ctx.stroke();
          } else {
            // Window preview
            ctx.strokeStyle = 'hsl(210 100% 50%)';
            ctx.lineWidth = (wall.thickness / 2) * scale;
            ctx.beginPath();
            ctx.moveTo(
              previewScreen.x - Math.cos(angle) * halfWidth,
              previewScreen.y - Math.sin(angle) * halfWidth
            );
            ctx.lineTo(
              previewScreen.x + Math.cos(angle) * halfWidth,
              previewScreen.y + Math.sin(angle) * halfWidth
            );
            ctx.stroke();
            
            // Frame
            ctx.strokeStyle = 'hsl(var(--primary))';
            ctx.lineWidth = 2;
            ctx.strokeRect(
              previewScreen.x - halfWidth,
              previewScreen.y - wall.thickness * scale / 2,
              previewWidth * scale,
              wall.thickness * scale
            );
          }
          
          ctx.restore();
        }
      }
    }

    // Draw snap indicator when hovering near existing point while drawing wall
    if (snapIndicator && activeTool === 'wall') {
      const snapScreen = worldToScreen(snapIndicator.x, snapIndicator.y);
      ctx.strokeStyle = snapIndicator.isCloseLoop ? 'hsl(185 76% 36%)' : 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(snapScreen.x, snapScreen.y, 18, 0, Math.PI * 2);
      ctx.stroke();
      
      if (snapIndicator.isCloseLoop) {
        // Draw "close loop" indicator
        ctx.fillStyle = 'hsl(185 76% 36%)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Close', snapScreen.x, snapScreen.y - 25);
      }
    }
  }, [
    floorPlan, offset, scale, showGrid, gridSize, showTiles, showRoutes, editRoutes,
    selectedElement, draggedPoint, draggedFixture, draggedColumn, wallStartPoint, tempEndPoint, hoverWallMidpoint, activeTool, hasCollision, doorWindowPreview, connectionStatus,
    snapToGrid, worldToScreen, screenToWorld, getConnectedWallCount, layerVisibility, hoverRoutePoint, hoverRouteSegment, snapIndicator, columnPreview
  ]);

  // Handle resize
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

  // Redraw on state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);
    const snappedWorld = { x: snapToGrid(world.x), y: snapToGrid(world.y) };

    if (activeTool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    if (activeTool === 'select') {
      // Route editing removed - now handled in MEP tab

      const point = findPointAt(world.x, world.y);
      if (point) {
        setDraggedPoint(point.id);
        setSelectedElement({ type: 'point', id: point.id });
        return;
      }

      const column = findColumnAt(world.x, world.y);
      if (column) {
        setDraggedColumn(column.id);
        setColumnOffset({ x: world.x - column.x, y: world.y - column.y });
        setSelectedElement({ type: 'column', id: column.id });
        return;
      }

      const fixture = findFixtureAt(world.x, world.y);
      if (fixture) {
        setDraggedFixture(fixture.id);
        setFixtureOffset({ x: world.x - fixture.cx, y: world.y - fixture.cy });
        setSelectedElement({ type: 'fixture', id: fixture.id });
        return;
      }

      const door = findDoorAt(world.x, world.y);
      if (door) {
        setSelectedElement({ type: 'door', id: door.id });
        return;
      }

      const window = findWindowAt(world.x, world.y);
      if (window) {
        setSelectedElement({ type: 'window', id: window.id });
        return;
      }

      const wall = findWallAt(world.x, world.y);
      if (wall) {
        setSelectedElement({ type: 'wall', id: wall.id });
        return;
      }

      setSelectedElement(null);
    }

    if (activeTool === 'column') {
      // Place a new column at clicked position
      addColumn(snappedWorld.x, snappedWorld.y);
    }

    if (activeTool === 'wall') {
      // Apply shift constraint for angle snapping
      let finalPoint = { ...snappedWorld };
      if (isShiftHeld && wallStartPoint) {
        const startPoint = floorPlan.points.find(p => p.id === wallStartPoint);
        if (startPoint) {
          const angle = Math.atan2(snappedWorld.y - startPoint.y, snappedWorld.x - startPoint.x);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const dist = Math.sqrt((snappedWorld.x - startPoint.x) ** 2 + (snappedWorld.y - startPoint.y) ** 2);
          finalPoint.x = snapToGrid(startPoint.x + Math.cos(snappedAngle) * dist);
          finalPoint.y = snapToGrid(startPoint.y + Math.sin(snappedAngle) * dist);
        }
      }
      
      const existingPoint = findPointAt(finalPoint.x, finalPoint.y);
      
      if (wallStartPoint) {
        // Complete the wall segment and continue chain
        let endPointId: string;
        if (existingPoint) {
          endPointId = existingPoint.id;
        } else {
          endPointId = addPoint(finalPoint.x, finalPoint.y);
        }
        addWall(wallStartPoint, endPointId);
        
        // Continue chain from end point (CAD-style continuous mode)
        setWallStartPoint(endPointId);
        setWallChain(prev => [...prev, endPointId]);
        setWallChainLength?.((wallChainLength || 0) + 1);
        // Don't clear tempEndPoint - keep drawing
      } else {
        // Start a new wall chain
        let startPointId: string;
        if (existingPoint) {
          startPointId = existingPoint.id;
        } else {
          startPointId = addPoint(finalPoint.x, finalPoint.y);
        }
        setWallStartPoint(startPointId);
        setWallChain([startPointId]);
        setIsDrawingWall?.(true);
        setWallChainLength?.(0);
      }
    }

    if (activeTool === 'door') {
      const wall = findWallAt(world.x, world.y);
      if (wall) {
        const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
        const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
        if (startPoint && endPoint) {
          const wallLen = Math.sqrt(
            (endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2
          );
          const clickDist = Math.sqrt(
            (world.x - startPoint.x) ** 2 + (world.y - startPoint.y) ** 2
          );
          const position = clickDist / wallLen;
          addDoor(wall.id, Math.max(0.1, Math.min(0.9, position)));
        }
      }
    }

    if (activeTool === 'window') {
      const wall = findWallAt(world.x, world.y);
      if (wall) {
        const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
        const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
        if (startPoint && endPoint) {
          const wallLen = Math.sqrt(
            (endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2
          );
          const clickDist = Math.sqrt(
            (world.x - startPoint.x) ** 2 + (world.y - startPoint.y) ** 2
          );
          const position = clickDist / wallLen;
          addWindow(wall.id, Math.max(0.1, Math.min(0.9, position)));
        }
      }
    }
  }, [
    activeTool, offset, scale, wallStartPoint,
    floorPlan, findPointAt, findWallAt, findFixtureAt, findDoorAt, findWindowAt, screenToWorld, snapToGrid,
    addPoint, addWall, addDoor, addWindow, setSelectedElement
  ]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);
    const snappedWorld = { x: snapToGrid(world.x), y: snapToGrid(world.y) };

    // Route editing removed - now handled in MEP tab

    if (draggedPoint) {
      movePoint(draggedPoint, snappedWorld.x, snappedWorld.y);
    }

    if (draggedFixture) {
      const newX = snappedWorld.x - fixtureOffset.x;
      const newY = snappedWorld.y - fixtureOffset.y;
      
      // Check for collisions
      const fixture = floorPlan.fixtures.find(f => f.id === draggedFixture);
      if (fixture) {
        const testFixture = { ...fixture, x: newX, y: newY };
        const collisions = checkFixtureCollisions(testFixture, floorPlan.fixtures, fixture.id);
        setHasCollision(collisions.length > 0);
      }
      
      moveFixture(draggedFixture, newX, newY);
    }

    if (draggedColumn) {
      const newX = snappedWorld.x - columnOffset.x;
      const newY = snappedWorld.y - columnOffset.y;
      moveColumn(draggedColumn, newX, newY);
    }

    // Column preview
    if (activeTool === 'column') {
      setColumnPreview(snappedWorld);
    } else {
      setColumnPreview(null);
    }

    if (wallStartPoint) {
      // Apply shift constraint for angle snapping
      let finalPoint = { ...snappedWorld };
      if (isShiftHeld) {
        const startPoint = floorPlan.points.find(p => p.id === wallStartPoint);
        if (startPoint) {
          const angle = Math.atan2(snappedWorld.y - startPoint.y, snappedWorld.x - startPoint.x);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const dist = Math.sqrt((snappedWorld.x - startPoint.x) ** 2 + (snappedWorld.y - startPoint.y) ** 2);
          finalPoint.x = snapToGrid(startPoint.x + Math.cos(snappedAngle) * dist);
          finalPoint.y = snapToGrid(startPoint.y + Math.sin(snappedAngle) * dist);
        }
      }
      setTempEndPoint(finalPoint);
      
      // Check for snap indicator (existing point or close loop)
      const nearPoint = findPointAt(finalPoint.x, finalPoint.y, 30);
      if (nearPoint) {
        const isCloseLoop = wallChain.length > 1 && nearPoint.id === wallChain[0];
        setSnapIndicator({ x: nearPoint.x, y: nearPoint.y, isCloseLoop });
      } else {
        setSnapIndicator(null);
      }
    } else {
      setSnapIndicator(null);
    }

    // Check for wall insertion point hover (for adding junction points)
    if (activeTool === 'select' && !draggedPoint && !draggedFixture) {
      const insertPoint = findWallInsertionPoint(world.x, world.y);
      setHoverWallMidpoint(insertPoint);
      
      // Route hover removed - now handled in MEP tab
      if (editRoutes) {
        setHoverRoutePoint(null);
        setHoverRouteSegment(null);
      }
    } else {
      setHoverWallMidpoint(null);
      setHoverRoutePoint(null);
      setHoverRouteSegment(null);
    }

    // Door/window preview
    if (activeTool === 'door' || activeTool === 'window') {
      const wall = findWallAt(world.x, world.y);
      if (wall) {
        const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
        const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
        if (startPoint && endPoint) {
          const wallLen = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
          const clickDist = Math.sqrt((world.x - startPoint.x) ** 2 + (world.y - startPoint.y) ** 2);
          const position = Math.max(0.1, Math.min(0.9, clickDist / wallLen));
          const previewX = startPoint.x + (endPoint.x - startPoint.x) * position;
          const previewY = startPoint.y + (endPoint.y - startPoint.y) * position;
          setDoorWindowPreview({ wallId: wall.id, position, x: previewX, y: previewY });
        }
      } else {
        setDoorWindowPreview(null);
      }
    } else {
      setDoorWindowPreview(null);
    }
  }, [isPanning, panStart, draggedPoint, draggedFixture, draggedColumn, fixtureOffset, columnOffset, wallStartPoint, activeTool, screenToWorld, snapToGrid, movePoint, moveFixture, moveColumn, findWallInsertionPoint, findWallAt, floorPlan.fixtures, floorPlan.points, floorPlan.walls, editRoutes]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedPoint(null);
    // Route editing removed - now handled in MEP tab
    if (draggedFixture) {
      setDraggedFixture(null);
      setHasCollision(false);
    }
    if (draggedColumn) {
      setDraggedColumn(null);
    }
  }, [draggedFixture, draggedColumn]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);
    const snappedWorld = { x: snapToGrid(world.x), y: snapToGrid(world.y) };

    // Double-click to finish wall chain (CAD-style)
    if (activeTool === 'wall' && wallStartPoint) {
      const existingPoint = findPointAt(snappedWorld.x, snappedWorld.y);
      
      // If clicking on an existing point, connect to it first
      if (existingPoint && existingPoint.id !== wallStartPoint) {
        addWall(wallStartPoint, existingPoint.id);
        setWallChainLength?.((wallChainLength || 0) + 1);
      }
      
      // Finish the chain
      setWallStartPoint(null);
      setTempEndPoint(null);
      setWallChain([]);
      setSnapIndicator(null);
      setIsDrawingWall?.(false);
      setWallChainLength?.(0);
      return;
    }

    // Route segment double-click removed - now handled in MEP tab

    // Double-click on wall to insert junction point
    if (activeTool === 'select') {
      const insertPoint = findWallInsertionPoint(world.x, world.y);
      if (insertPoint) {
        insertPointOnWall(insertPoint.wallId, insertPoint.x, insertPoint.y);
        return;
      }

      // Double-click on a junction point (2 walls connected) to merge walls
      const point = findPointAt(world.x, world.y);
      if (point) {
        const connectedCount = getConnectedWallCount(point.id);
        if (connectedCount === 2) {
          mergeWallsAtPoint(point.id);
        }
      }
    }
  }, [activeTool, screenToWorld, snapToGrid, findWallInsertionPoint, findPointAt, getConnectedWallCount, insertPointOnWall, mergeWallsAtPoint, editRoutes, wallStartPoint, addWall, wallChainLength, setWallChainLength, setIsDrawingWall]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));
    
    // Zoom towards mouse position
    const worldBefore = screenToWorld(mouseX, mouseY);
    const newOffset = {
      x: mouseX - worldBefore.x * newScale,
      y: mouseY - worldBefore.y * newScale
    };
    
    setScale(newScale);
    setOffset(newOffset);
  }, [scale, screenToWorld]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Track shift key
    if (e.key === 'Shift') {
      setIsShiftHeld(true);
    }
    
    // Enter: Finish wall chain
    if (e.key === 'Enter' && wallStartPoint) {
      setWallStartPoint(null);
      setTempEndPoint(null);
      setWallChain([]);
      setSnapIndicator(null);
      setIsDrawingWall?.(false);
      setWallChainLength?.(0);
      return;
    }
    
    // Escape: Cancel/stop tool
    if (e.key === 'Escape') {
      setWallStartPoint(null);
      setTempEndPoint(null);
      setWallChain([]);
      setSnapIndicator(null);
      setSelectedElement(null);
      setIsDrawingWall?.(false);
      setWallChainLength?.(0);
    }
    
    // Backspace: Undo last segment in chain (only when drawing walls)
    if (e.key === 'Backspace' && activeTool === 'wall' && wallChain.length > 0) {
      e.preventDefault(); // Prevent browser back
      
      // Get the last point in the chain
      const lastPointId = wallChain[wallChain.length - 1];
      
      // Find the wall connecting the current start point to that point
      const wallToRemove = floorPlan.walls.find(
        w => (w.startPointId === lastPointId && w.endPointId === wallStartPoint) ||
             (w.endPointId === lastPointId && w.startPointId === wallStartPoint)
      );
      
      if (wallToRemove) {
        deleteWall(wallToRemove.id);
      }
      
      // Move back to the previous point
      if (wallChain.length > 1) {
        setWallStartPoint(wallChain[wallChain.length - 2]);
        setWallChain(prev => prev.slice(0, -1));
        setWallChainLength?.((wallChainLength || 1) - 1);
      } else {
        // Only one point in chain, exit drawing
        setWallStartPoint(null);
        setTempEndPoint(null);
        setWallChain([]);
        setSnapIndicator(null);
        setIsDrawingWall?.(false);
        setWallChainLength?.(0);
      }
      return;
    }
    
    // Delete/Backspace for deleting selected elements (when not drawing walls)
    if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool !== 'wall') {
      if (selectedElement) {
        switch (selectedElement.type) {
          case 'point':
            deletePoint(selectedElement.id);
            break;
          case 'wall':
            deleteWall(selectedElement.id);
            break;
          case 'door':
            deleteDoor(selectedElement.id);
            break;
          case 'window':
            deleteWindow(selectedElement.id);
            break;
          case 'fixture':
            deleteFixture(selectedElement.id);
            break;
          case 'column':
            deleteColumn(selectedElement.id);
            break;
        }
        setSelectedElement(null);
      }
    }
    // Rotate fixture or column with R key
    if (e.key === 'r' || e.key === 'R') {
      if (selectedElement?.type === 'fixture') {
        const fixture = floorPlan.fixtures.find(f => f.id === selectedElement.id);
        if (fixture) {
          rotateFixture(fixture.id, (fixture.rotation + 90) % 360);
        }
      }
      if (selectedElement?.type === 'column') {
        const column = floorPlan.columns?.find(c => c.id === selectedElement.id);
        if (column && column.shape === 'rectangle') {
          // Rotate column 45 degrees
          const newRotation = (column.rotation + 45) % 360;
          // Use updateColumn from context - but it's not imported, so we'll skip for now
        }
      }
    }
  }, [selectedElement, deletePoint, deleteWall, deleteDoor, deleteWindow, deleteFixture, deleteColumn, rotateFixture, floorPlan.fixtures, floorPlan.columns, floorPlan.walls, setSelectedElement, setIsDrawingWall, wallStartPoint, wallChain, activeTool, wallChainLength, setWallChainLength]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Shift') {
      setIsShiftHeld(false);
    }
  }, []);

  // Reset drawing state when tool changes or cancel is triggered from parent
  useEffect(() => {
    if (!isDrawingWall && wallStartPoint) {
      setWallStartPoint(null);
      setTempEndPoint(null);
      setWallChain([]);
      setSnapIndicator(null);
    }
  }, [isDrawingWall, wallStartPoint]);

  // Reset drawing when switching away from wall tool
  useEffect(() => {
    if (activeTool !== 'wall') {
      setWallStartPoint(null);
      setTempEndPoint(null);
      setWallChain([]);
      setSnapIndicator(null);
      setIsDrawingWall?.(false);
      setWallChainLength?.(0);
    }
  }, [activeTool, setIsDrawingWall, setWallChainLength]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Find what's under the cursor
    const point = findPointAt(world.x, world.y);
    const fixture = findFixtureAt(world.x, world.y);
    const door = findDoorAt(world.x, world.y);
    const window = findWindowAt(world.x, world.y);
    const wall = findWallAt(world.x, world.y);

    if (point) setSelectedElement({ type: 'point', id: point.id });
    else if (fixture) setSelectedElement({ type: 'fixture', id: fixture.id });
    else if (door) setSelectedElement({ type: 'door', id: door.id });
    else if (window) setSelectedElement({ type: 'window', id: window.id });
    else if (wall) setSelectedElement({ type: 'wall', id: wall.id });

    setContextMenuPos({ x: e.clientX, y: e.clientY });
  }, [screenToWorld, findPointAt, findFixtureAt, findDoorAt, findWindowAt, findWallAt, setSelectedElement]);

  const getCursor = () => {
    if (activeTool === 'pan') return isPanning ? 'grabbing' : 'grab';
    if (isPanning) return 'grabbing';
    if (draggedPoint || draggedFixture) return 'move';
    if (hoverWallMidpoint) return 'pointer';
    if (activeTool === 'wall' || activeTool === 'door' || activeTool === 'window') return 'crosshair';
    return 'default';
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div 
          ref={containerRef} 
          className="w-full h-full bg-background overflow-hidden"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            style={{ cursor: getCursor() }}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {selectedElement?.type === 'wall' && (
          <>
            <ContextMenuItem onClick={() => {
              const wall = floorPlan.walls.find(w => w.id === selectedElement.id);
              if (wall) splitWall(wall.id, 0.5);
            }}>
              Split Wall
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {selectedElement?.type === 'fixture' && (
          <>
            <ContextMenuItem onClick={() => {
              const fixture = floorPlan.fixtures.find(f => f.id === selectedElement.id);
              if (fixture) rotateFixture(fixture.id, (fixture.rotation + 90) % 360);
            }}>
              Rotate 90°
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {selectedElement && (
          <ContextMenuItem 
            className="text-destructive"
            onClick={() => {
              switch (selectedElement.type) {
                case 'point': deletePoint(selectedElement.id); break;
                case 'wall': deleteWall(selectedElement.id); break;
                case 'door': deleteDoor(selectedElement.id); break;
                case 'window': deleteWindow(selectedElement.id); break;
                case 'fixture': deleteFixture(selectedElement.id); break;
              }
              setSelectedElement(null);
            }}
          >
            Delete
          </ContextMenuItem>
        )}
        {!selectedElement && (
          <ContextMenuItem disabled>No element selected</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
