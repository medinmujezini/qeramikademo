import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import type { Point, Wall, Fixture } from '@/types/floorPlan';
import { TILE_LIBRARY } from '@/types/floorPlan';

export interface LayerCanvasProps {
  // Display options
  showGrid?: boolean;
  gridSize?: number;
  showWalls?: boolean;
  showFixtures?: boolean;
  showDoors?: boolean;
  showWindows?: boolean;
  showRoutes?: boolean;
  showTiles?: boolean;
  showMainConnections?: boolean;
  
  // Interactivity
  wallsInteractive?: boolean;
  fixturesInteractive?: boolean;
  
  // Styling
  wallsOpacity?: number;
  fixturesOpacity?: number;
  
  // Custom render function for layer-specific elements
  renderLayerContent?: (
    ctx: CanvasRenderingContext2D,
    state: CanvasState
  ) => void;
  
  // Event handlers for layer-specific interactions
  onCanvasClick?: (worldPos: Point, screenPos: { x: number; y: number }) => void;
  onCanvasMouseMove?: (worldPos: Point, screenPos: { x: number; y: number }) => void;
  onCanvasMouseDown?: (worldPos: Point, screenPos: { x: number; y: number }) => void;
  onCanvasMouseUp?: (worldPos: Point, screenPos: { x: number; y: number }) => void;
  onWallClick?: (wall: Wall, position: number) => void;
  onFixtureClick?: (fixture: Fixture) => void;
  
  // Selected elements highlighting
  selectedWallId?: string | null;
  selectedFixtureId?: string | null;
}

export interface CanvasState {
  offset: { x: number; y: number };
  scale: number;
  width: number;
  height: number;
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  snapToGrid: (value: number) => number;
}

export const LayerCanvas: React.FC<LayerCanvasProps> = ({
  showGrid = true,
  gridSize = 25,
  showWalls = true,
  showFixtures = true,
  showDoors = true,
  showWindows = true,
  showRoutes = false,
  showTiles = false,
  showMainConnections = false,
  wallsInteractive = false,
  fixturesInteractive = false,
  wallsOpacity = 1,
  fixturesOpacity = 1,
  renderLayerContent,
  onCanvasClick,
  onCanvasMouseMove,
  onCanvasMouseDown,
  onCanvasMouseUp,
  onWallClick,
  onFixtureClick,
  selectedWallId,
  selectedFixtureId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { floorPlan } = useFloorPlanContext();

  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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

  const findWallAt = useCallback((worldX: number, worldY: number, threshold: number = 15): { wall: Wall; position: number } | null => {
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
        return { wall, position: dot };
      }
    }
    return null;
  }, [floorPlan.walls, floorPlan.points, scale]);

  const findFixtureAt = useCallback((worldX: number, worldY: number): Fixture | null => {
    for (const fixture of floorPlan.fixtures) {
      const rad = (fixture.rotation * Math.PI) / 180;
      const cos = Math.cos(-rad);
      const sin = Math.sin(-rad);
      
      const dx = worldX - fixture.cx;
      const dy = worldY - fixture.cy;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      
      if (Math.abs(localX) <= fixture.width / 2 &&
          Math.abs(localY) <= fixture.depth / 2) {
        return fixture;
      }
    }
    return null;
  }, [floorPlan.fixtures]);

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

    // Draw walls with glassmorphism + thin glowing edge
    if (showWalls) {
      ctx.globalAlpha = wallsOpacity;
      
      // Neon color definitions - thinner and less opaque
      const neonEdge = 'hsla(38, 60%, 58%, 0.7)';
      const glassFill = 'hsla(38, 30%, 20%, 0.4)';
      
      floorPlan.walls.forEach(wall => {
        const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
        const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
        if (!startPoint || !endPoint) return;

        const start = worldToScreen(startPoint.x, startPoint.y);
        const end = worldToScreen(endPoint.x, endPoint.y);
        const isSelected = selectedWallId === wall.id;
        
        // Get tile section for this wall
        const tileSection = showTiles 
          ? floorPlan.tileSections.find(s => s.wallId === wall.id) 
          : null;
        const tile = tileSection ? TILE_LIBRARY.find(t => t.id === tileSection.tileId) : null;

        // Calculate wall angle
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const perpAngle = angle + Math.PI / 2;
        const halfThickness = (wall.thickness * scale) / 2;
        const offsetX = Math.cos(perpAngle) * halfThickness;
        const offsetY = Math.sin(perpAngle) * halfThickness;
        
        // Four corners of wall rectangle
        const p1 = { x: start.x - offsetX, y: start.y - offsetY };
        const p2 = { x: start.x + offsetX, y: start.y + offsetY };
        const p3 = { x: end.x + offsetX, y: end.y + offsetY };
        const p4 = { x: end.x - offsetX, y: end.y - offsetY };
        
        // Glassmorphism fill
        ctx.fillStyle = tile ? tile.color + '30' : glassFill;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        
        // Thin glowing edge stroke
        const edgeColor = isSelected ? 'hsla(142, 100%, 65%, 0.7)' : neonEdge;
        ctx.shadowColor = edgeColor;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw dimension line along the OUTER edge of the wall
        const wallLength = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
        const dimOffset = halfThickness + 15;
        const dimX1 = start.x + Math.cos(perpAngle) * dimOffset;
        const dimY1 = start.y + Math.sin(perpAngle) * dimOffset;
        const dimX2 = end.x + Math.cos(perpAngle) * dimOffset;
        const dimY2 = end.y + Math.sin(perpAngle) * dimOffset;
        
        // White dimension lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dimX1 - Math.cos(perpAngle) * 4, dimY1 - Math.sin(perpAngle) * 4);
        ctx.lineTo(dimX1 + Math.cos(perpAngle) * 4, dimY1 + Math.sin(perpAngle) * 4);
        ctx.moveTo(dimX2 - Math.cos(perpAngle) * 4, dimY2 - Math.sin(perpAngle) * 4);
        ctx.lineTo(dimX2 + Math.cos(perpAngle) * 4, dimY2 + Math.sin(perpAngle) * 4);
        ctx.moveTo(dimX1, dimY1);
        ctx.lineTo(dimX2, dimY2);
        ctx.stroke();
        
        // White dimension text
        ctx.save();
        ctx.translate((dimX1 + dimX2) / 2, (dimY1 + dimY2) / 2);
        ctx.rotate(angle);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${wallLength.toFixed(0)} cm`, 0, -4);
        ctx.restore();

        // Draw doors
        if (showDoors) {
          floorPlan.doors.filter(d => d.wallId === wall.id).forEach(door => {
            const doorX = startPoint.x + (endPoint.x - startPoint.x) * door.position;
            const doorY = startPoint.y + (endPoint.y - startPoint.y) * door.position;
            const doorScreen = worldToScreen(doorX, doorY);
            const doorAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
            const doorHalfWidth = (door.width / 2) * scale;
            
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

            ctx.strokeStyle = 'hsl(var(--muted-foreground))';
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
        }

        // Draw windows
        if (showWindows) {
          floorPlan.windows.filter(w => w.wallId === wall.id).forEach(window => {
            const winX = startPoint.x + (endPoint.x - startPoint.x) * window.position;
            const winY = startPoint.y + (endPoint.y - startPoint.y) * window.position;
            const winScreen = worldToScreen(winX, winY);
            const winAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
            const winHalfWidth = (window.width / 2) * scale;
            
            ctx.strokeStyle = 'hsl(210 100% 50%)';
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
          });
        }
      });

      // Draw points as neon squares with subtle glow
      floorPlan.points.forEach(point => {
        const screen = worldToScreen(point.x, point.y);
        const squareSize = 8;
        const halfSize = squareSize / 2;
        
        // Subtle outer glow
        ctx.shadowColor = 'hsl(142, 76%, 45%)';
        ctx.shadowBlur = 12;
        
        // Main square
        ctx.fillStyle = 'hsl(142, 76%, 45%)';
        ctx.fillRect(screen.x - halfSize, screen.y - halfSize, squareSize, squareSize);
        
        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'hsl(142, 90%, 70%)';
        const innerSize = squareSize * 0.35;
        const innerHalf = innerSize / 2;
        ctx.fillRect(screen.x - innerHalf, screen.y - innerHalf, innerSize, innerSize);
      });

      ctx.globalAlpha = 1;
    }

    // Draw main connection points
    if (showMainConnections) {
      const mainConns = floorPlan.mainConnections;
      
      // Water supply
      const supplyScreen = worldToScreen(mainConns.waterSupply.x, mainConns.waterSupply.y);
      ctx.fillStyle = 'hsl(210 100% 50%)';
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(supplyScreen.x, supplyScreen.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('W', supplyScreen.x, supplyScreen.y);

      // Drainage
      const drainScreen = worldToScreen(mainConns.drainage.x, mainConns.drainage.y);
      ctx.fillStyle = 'hsl(30 60% 40%)';
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.beginPath();
      ctx.arc(drainScreen.x, drainScreen.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillText('D', drainScreen.x, drainScreen.y);

      // Electrical
      const elecScreen = worldToScreen(mainConns.electrical.x, mainConns.electrical.y);
      ctx.fillStyle = 'hsl(45 100% 50%)';
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.beginPath();
      ctx.arc(elecScreen.x, elecScreen.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.fillText('E', elecScreen.x, elecScreen.y);
    }

    // Draw plumbing routes
    if (showRoutes) {
      floorPlan.plumbingRoutes.forEach(route => {
        if (route.points.length < 2) return;
        ctx.strokeStyle = route.type === 'water-supply' ? 'hsl(210 100% 50%)' : 'hsl(30 60% 40%)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const firstPoint = worldToScreen(route.points[0].x, route.points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < route.points.length; i++) {
          const point = worldToScreen(route.points[i].x, route.points[i].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      floorPlan.electricalRoutes.forEach(route => {
        if (route.points.length < 2) return;
        ctx.strokeStyle = 'hsl(45 100% 50%)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const firstPoint = worldToScreen(route.points[0].x, route.points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < route.points.length; i++) {
          const point = worldToScreen(route.points[i].x, route.points[i].y);
          ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Draw fixtures
    if (showFixtures) {
      ctx.globalAlpha = fixturesOpacity;
      floorPlan.fixtures.forEach(fixture => {
        const pos = worldToScreen(fixture.cx, fixture.cy);
        const isSelected = selectedFixtureId === fixture.id;
        const hw = fixture.width * scale / 2;
        const hh = fixture.depth * scale / 2;
        
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(fixture.rotation * Math.PI / 180);
        
        ctx.fillStyle = isSelected ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--accent))';
        ctx.strokeStyle = isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))';
        ctx.lineWidth = 2;
        
        ctx.fillRect(-hw, -hh, fixture.width * scale, fixture.depth * scale);
        ctx.strokeRect(-hw, -hh, fixture.width * scale, fixture.depth * scale);
        
        ctx.fillStyle = 'hsl(var(--foreground))';
        ctx.font = `${10 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fixture.type, 0, 0);

        // Plumbing connection points
        fixture.plumbingConnections.forEach(conn => {
          ctx.fillStyle = conn.type === 'water-supply' ? 'hsl(210 100% 50%)' : 'hsl(30 60% 40%)';
          ctx.beginPath();
          ctx.arc(conn.localX * scale, conn.localY * scale, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Electrical connection points
        fixture.electricalConnections.forEach(conn => {
          ctx.fillStyle = 'hsl(45 100% 50%)';
          ctx.beginPath();
          ctx.arc(conn.localX * scale, conn.localY * scale, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // Call custom render function for layer-specific content
    if (renderLayerContent) {
      const canvasState: CanvasState = {
        offset,
        scale,
        width,
        height,
        worldToScreen,
        screenToWorld,
        snapToGrid,
      };
      renderLayerContent(ctx, canvasState);
    }
  }, [
    showGrid, gridSize, showWalls, showFixtures, showDoors, showWindows, 
    showRoutes, showTiles, showMainConnections, wallsOpacity, fixturesOpacity,
    selectedWallId, selectedFixtureId, floorPlan, offset, scale,
    worldToScreen, screenToWorld, snapToGrid, renderLayerContent
  ]);

  // Resize handling
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

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Middle mouse button for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    onCanvasMouseDown?.({ id: '', x: world.x, y: world.y }, { x: screenX, y: screenY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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

    onCanvasMouseMove?.({ id: '', x: world.x, y: world.y }, { x: screenX, y: screenY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    onCanvasMouseUp?.({ id: '', x: world.x, y: world.y }, { x: screenX, y: screenY });
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Check for wall click
    if (wallsInteractive) {
      const wallHit = findWallAt(world.x, world.y);
      if (wallHit) {
        onWallClick?.(wallHit.wall, wallHit.position);
        return;
      }
    }

    // Check for fixture click
    if (fixturesInteractive) {
      const fixture = findFixtureAt(world.x, world.y);
      if (fixture) {
        onFixtureClick?.(fixture);
        return;
      }
    }

    onCanvasClick?.({ id: '', x: world.x, y: world.y }, { x: screenX, y: screenY });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldBefore = screenToWorld(mouseX, mouseY);
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 5);
    
    setScale(newScale);
    
    // Adjust offset to zoom toward mouse position
    setOffset({
      x: mouseX - worldBefore.x * newScale,
      y: mouseY - worldBefore.y * newScale
    });
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-hidden bg-muted/30"
      style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsPanning(false)}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};
