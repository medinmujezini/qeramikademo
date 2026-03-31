import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import type { Point, Wall, Tile } from '@/types/floorPlan';
import { TILE_LIBRARY, isWallCurved, isWallSloped, isTileSuitableForCurve, getRecommendedTileSize } from '@/types/floorPlan';
import { renderWallTiles } from '@/utils/tileRenderer';
import { getArcPoints, calculateArcInfo } from '@/utils/arcUtils';

interface TilesCanvasProps {
  selectedTile: Tile | null;
  selectedWallId: string | null;
  onWallSelect: (wallId: string | null) => void;
  jointWidth: number;
  showTilePreview: boolean;
  pendingWallId?: string | null;
  tiles?: Tile[];
}

export const TilesCanvas: React.FC<TilesCanvasProps> = ({
  selectedTile,
  selectedWallId,
  onWallSelect,
  jointWidth,
  showTilePreview,
  pendingWallId,
  tiles: externalTiles,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { floorPlan } = useFloorPlanContext();

  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);

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

  const findWallAt = useCallback((worldX: number, worldY: number, threshold: number = 20): Wall | null => {
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw grid - thin white lines for high-tech look
    ctx.strokeStyle = 'rgba(201, 169, 110, 0.12)'; // Gold grid
    ctx.lineWidth = 0.5;
    const gridSize = 25;
    const gridStart = screenToWorld(0, 0);
    const gridEnd = screenToWorld(width, height);
    
    for (let x = Math.floor(gridStart.x / gridSize) * gridSize; x <= gridEnd.x; x += gridSize) {
      const screenX = worldToScreen(x, 0).x;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }
    
    for (let y = Math.floor(gridStart.y / gridSize) * gridSize; y <= gridEnd.y; y += gridSize) {
      const screenY = worldToScreen(0, y).y;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }

    // Draw walls with tile patterns
    floorPlan.walls.forEach((wall, wallIndex) => {
      const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
      const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!startPoint || !endPoint) return;

      const start = worldToScreen(startPoint.x, startPoint.y);
      const end = worldToScreen(endPoint.x, endPoint.y);
      
      const isSelected = selectedWallId === wall.id;
      const isHovered = hoveredWallId === wall.id;
      const isPending = pendingWallId === wall.id;
      const isCurved = isWallCurved(wall);
      const isSloped = isWallSloped(wall);
      
      // Get existing tile for this wall
      const tileSection = floorPlan.tileSections.find(s => s.wallId === wall.id);
      const tileSource = externalTiles && externalTiles.length > 0 ? externalTiles : TILE_LIBRARY;
      const existingTile = tileSection ? tileSource.find(t => t.id === tileSection.tileId) : null;
      
      // Determine which tile to show (preview or existing)
      const displayTile = isSelected && selectedTile && showTilePreview ? selectedTile : existingTile;
      
      // Check tile suitability for curved walls
      let hasWarning = false;
      if (isCurved && displayTile && wall.bulge) {
        const arcInfo = calculateArcInfo(startPoint, endPoint, wall.bulge);
        if (arcInfo) {
          hasWarning = !isTileSuitableForCurve(displayTile, arcInfo.radius);
        }
      }

      // Neon color definitions - thinner and less opaque
      const neonEdge = isSelected ? 'hsla(38, 80%, 68%, 0.8)' : 'hsla(38, 60%, 58%, 0.7)';
      const glassFill = 'hsla(38, 30%, 20%, 0.4)';
      
      // Calculate wall angle
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const perpAngle = angle + Math.PI / 2;
      const halfThickness = (wall.thickness * scale) / 2;
      const offsetX = Math.cos(perpAngle) * halfThickness;
      const offsetY = Math.sin(perpAngle) * halfThickness;
      
      // Draw curved or straight wall with glassmorphism + thin glowing edge
      if (isCurved && wall.bulge) {
        const arcPoints = getArcPoints(startPoint, endPoint, wall.bulge, 32);
        const screenArcPoints = arcPoints.map(p => worldToScreen(p.x, p.y));
        
        // Glassmorphism fill
        ctx.strokeStyle = displayTile ? displayTile.color + '30' : glassFill;
        ctx.lineWidth = wall.thickness * scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(screenArcPoints[0].x, screenArcPoints[0].y);
        for (let i = 1; i < screenArcPoints.length; i++) {
          ctx.lineTo(screenArcPoints[i].x, screenArcPoints[i].y);
        }
        ctx.stroke();
        
        // Thin glowing edge
        ctx.shadowColor = neonEdge;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = neonEdge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenArcPoints[0].x, screenArcPoints[0].y);
        for (let i = 1; i < screenArcPoints.length; i++) {
          ctx.lineTo(screenArcPoints[i].x, screenArcPoints[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Draw curve indicator icon at midpoint
        const midArc = screenArcPoints[Math.floor(screenArcPoints.length / 2)];
        ctx.fillStyle = neonEdge;
        ctx.shadowColor = neonEdge;
        ctx.shadowBlur = 6;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⌒', midArc.x, midArc.y - wall.thickness * scale / 2 - 12);
        ctx.shadowBlur = 0;
      } else {
        // Four corners of wall rectangle
        const p1 = { x: start.x - offsetX, y: start.y - offsetY };
        const p2 = { x: start.x + offsetX, y: start.y + offsetY };
        const p3 = { x: end.x + offsetX, y: end.y + offsetY };
        const p4 = { x: end.x - offsetX, y: end.y - offsetY };
        
        // Glassmorphism fill
        ctx.fillStyle = displayTile ? displayTile.color + '30' : glassFill;
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
        
        // Draw tile grid pattern if tile is applied
        if (displayTile) {
          const wallLen = Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2);
          const tileWidth = displayTile.width * scale;
          const numTiles = Math.ceil(wallLen * scale / tileWidth);
          
          ctx.strokeStyle = 'hsla(38, 60%, 55%, 0.2)';
          ctx.lineWidth = 1;
          for (let i = 1; i < numTiles; i++) {
            const t = i / numTiles;
            const tileX = start.x + (end.x - start.x) * t;
            const tileY = start.y + (end.y - start.y) * t;
            
            const perpX = -Math.sin(angle) * wall.thickness * scale / 2;
            const perpY = Math.cos(angle) * wall.thickness * scale / 2;
            ctx.beginPath();
            ctx.moveTo(tileX + perpX, tileY + perpY);
            ctx.lineTo(tileX - perpX, tileY - perpY);
            ctx.stroke();
          }
        }
      }
      
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
      
      // Draw slope indicator
      if (isSloped) {
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        ctx.fillStyle = 'hsl(var(--primary))';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('∠', midX, midY + wall.thickness * scale / 2 + 12);
      }

      // Selection/hover/pending highlight
      if (isSelected || isHovered || isPending) {
        const highlightColor = hasWarning 
          ? 'hsl(var(--destructive))' 
          : isPending 
            ? 'hsl(var(--primary))'
            : (isSelected ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)');
        
        // Thicker, more prominent line for pending wall
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = isPending ? 5 : 3;
        ctx.setLineDash(isPending ? [12, 6] : [8, 4]);
        
        if (isCurved && wall.bulge) {
          const arcPoints = getArcPoints(startPoint, endPoint, wall.bulge, 32);
          const screenArcPoints = arcPoints.map(p => worldToScreen(p.x, p.y));
          ctx.beginPath();
          ctx.moveTo(screenArcPoints[0].x, screenArcPoints[0].y);
          for (let i = 1; i < screenArcPoints.length; i++) {
            ctx.lineTo(screenArcPoints[i].x, screenArcPoints[i].y);
          }
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw pulsing glow effect for pending wall
        if (isPending) {
          const pulsePhase = (Date.now() % 2000) / 2000;
          const pulseAlpha = 0.3 + 0.3 * Math.sin(pulsePhase * Math.PI * 2);
          ctx.strokeStyle = `hsla(var(--primary) / ${pulseAlpha})`;
          ctx.lineWidth = 12;
          ctx.setLineDash([]);
          
          if (isCurved && wall.bulge) {
            const arcPoints = getArcPoints(startPoint, endPoint, wall.bulge, 32);
            const screenArcPoints = arcPoints.map(p => worldToScreen(p.x, p.y));
            ctx.beginPath();
            ctx.moveTo(screenArcPoints[0].x, screenArcPoints[0].y);
            for (let i = 1; i < screenArcPoints.length; i++) {
              ctx.lineTo(screenArcPoints[i].x, screenArcPoints[i].y);
            }
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }
        }
      }

      // Wall label with type indicators
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      ctx.fillStyle = isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      let wallLabel = `Wall ${wallIndex + 1}`;
      if (isCurved) wallLabel += ' ⌒';
      if (isSloped) wallLabel += ' ∠';
      if (hasWarning) wallLabel += ' ⚠';
      
      ctx.fillText(wallLabel, midX, midY - wall.thickness * scale / 2 - 8);
      
      if (displayTile) {
        ctx.font = '10px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(displayTile.name, midX, midY + wall.thickness * scale / 2 + 4);
      }
    });

    // Draw doors on walls
    floorPlan.doors.forEach(door => {
      const wall = floorPlan.walls.find(w => w.id === door.wallId);
      if (!wall) return;
      const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
      const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!startPoint || !endPoint) return;

      const doorX = startPoint.x + (endPoint.x - startPoint.x) * door.position;
      const doorY = startPoint.y + (endPoint.y - startPoint.y) * door.position;
      const doorScreen = worldToScreen(doorX, doorY);
      const wallAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
      const doorHalfWidth = (door.width / 2) * scale;
      const perpAngle = wallAngle + Math.PI / 2;
      const halfThickness = (wall.thickness * scale) / 2;

      // Draw door gap (clear the wall)
      ctx.strokeStyle = 'hsl(var(--background))';
      ctx.lineWidth = wall.thickness * scale + 4;
      ctx.beginPath();
      ctx.moveTo(
        doorScreen.x - Math.cos(wallAngle) * doorHalfWidth,
        doorScreen.y - Math.sin(wallAngle) * doorHalfWidth
      );
      ctx.lineTo(
        doorScreen.x + Math.cos(wallAngle) * doorHalfWidth,
        doorScreen.y + Math.sin(wallAngle) * doorHalfWidth
      );
      ctx.stroke();

      // Draw door swing arc
      ctx.strokeStyle = 'hsla(30, 60%, 50%, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const swingAngle = door.type.includes('left') ? -Math.PI / 2 : Math.PI / 2;
      ctx.arc(
        doorScreen.x - Math.cos(wallAngle) * doorHalfWidth,
        doorScreen.y - Math.sin(wallAngle) * doorHalfWidth,
        door.width * scale,
        wallAngle,
        wallAngle + swingAngle,
        door.type.includes('left')
      );
      ctx.stroke();

      // Door label
      ctx.fillStyle = 'hsla(30, 60%, 50%, 0.9)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚪', doorScreen.x, doorScreen.y);
    });

    // Draw windows on walls
    floorPlan.windows.forEach(win => {
      const wall = floorPlan.walls.find(w => w.id === win.wallId);
      if (!wall) return;
      const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
      const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
      if (!startPoint || !endPoint) return;

      const winX = startPoint.x + (endPoint.x - startPoint.x) * win.position;
      const winY = startPoint.y + (endPoint.y - startPoint.y) * win.position;
      const winScreen = worldToScreen(winX, winY);
      const wallAngle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
      const winHalfWidth = (win.width / 2) * scale;

      // Draw window indicator (blue line across wall)
      ctx.strokeStyle = 'hsla(200, 80%, 60%, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(
        winScreen.x - Math.cos(wallAngle) * winHalfWidth,
        winScreen.y - Math.sin(wallAngle) * winHalfWidth
      );
      ctx.lineTo(
        winScreen.x + Math.cos(wallAngle) * winHalfWidth,
        winScreen.y + Math.sin(wallAngle) * winHalfWidth
      );
      ctx.stroke();

      // Double line for glass effect
      const perpAngle = wallAngle + Math.PI / 2;
      const glassOffset = 2;
      ctx.strokeStyle = 'hsla(200, 80%, 70%, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(
        winScreen.x - Math.cos(wallAngle) * winHalfWidth + Math.cos(perpAngle) * glassOffset,
        winScreen.y - Math.sin(wallAngle) * winHalfWidth + Math.sin(perpAngle) * glassOffset
      );
      ctx.lineTo(
        winScreen.x + Math.cos(wallAngle) * winHalfWidth + Math.cos(perpAngle) * glassOffset,
        winScreen.y + Math.sin(wallAngle) * winHalfWidth + Math.sin(perpAngle) * glassOffset
      );
      ctx.stroke();
    });

    // Draw points as neon squares with subtle glow
    floorPlan.points.forEach(point => {
      const screen = worldToScreen(point.x, point.y);
      const squareSize = 8;
      const halfSize = squareSize / 2;
      
      // Subtle outer glow
      ctx.shadowColor = 'hsl(38, 60%, 58%)';
      ctx.shadowBlur = 12;
      
      // Main square
      ctx.fillStyle = 'hsl(38, 60%, 58%)';
      ctx.fillRect(screen.x - halfSize, screen.y - halfSize, squareSize, squareSize);
      
      // Inner bright core
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'hsl(38, 70%, 75%)';
      const innerSize = squareSize * 0.35;
      const innerHalf = innerSize / 2;
      ctx.fillRect(screen.x - innerHalf, screen.y - innerHalf, innerSize, innerSize);
    });

    // Draw fixtures (faded)
    ctx.globalAlpha = 0.3;
    floorPlan.fixtures.forEach(fixture => {
      const pos = worldToScreen(fixture.cx, fixture.cy);
      const hw = fixture.width * scale / 2;
      const hh = fixture.depth * scale / 2;
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(fixture.rotation * Math.PI / 180);
      
      ctx.fillStyle = 'hsl(var(--accent))';
      ctx.strokeStyle = 'hsl(var(--foreground))';
      ctx.lineWidth = 1;
      ctx.fillRect(0, 0, fixture.width * scale, fixture.depth * scale);
      ctx.strokeRect(0, 0, fixture.width * scale, fixture.depth * scale);
      
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // Instructions
    if (floorPlan.walls.length === 0) {
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Draw walls in Floor Plan tab first', width / 2, height / 2);
    } else if (!selectedWallId) {
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click on a wall to select it for tiling', width / 2, 30);
    }
  }, [floorPlan, offset, scale, selectedWallId, pendingWallId, selectedTile, hoveredWallId, jointWidth, showTilePreview, screenToWorld, worldToScreen, externalTiles]);

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

  // Animation loop for pulsing effect when pending wall exists
  useEffect(() => {
    if (!pendingWallId) return;
    
    let animationFrameId: number;
    const animate = () => {
      draw();
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [pendingWallId, draw]);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      didDragRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isPanning) {
      // Check if we've moved enough to count as a drag (5px threshold)
      if (dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          didDragRef.current = true;
        }
      }
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);
    
    const wall = findWallAt(world.x, world.y);
    setHoveredWallId(wall?.id || null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const wasDragging = didDragRef.current;
    setIsPanning(false);
    didDragRef.current = false;
    dragStartRef.current = null;

    // Only select wall if it was a click (no drag)
    if (!wasDragging && e.button === 0) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = screenToWorld(screenX, screenY);
      const wall = findWallAt(world.x, world.y);
      onWallSelect(wall?.id || null);
    }
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
    setOffset({
      x: mouseX - worldBefore.x * newScale,
      y: mouseY - worldBefore.y * newScale
    });
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-hidden bg-muted/30"
      style={{ cursor: isPanning && didDragRef.current ? 'grabbing' : (hoveredWallId ? 'pointer' : 'grab') }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsPanning(false); didDragRef.current = false; dragStartRef.current = null; setHoveredWallId(null); }}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};
