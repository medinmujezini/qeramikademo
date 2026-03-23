/**
 * MEP Canvas Component
 * 
 * Interactive 2D canvas for placing and managing MEP fixtures.
 * Features:
 * - Pan/zoom with mouse wheel
 * - Fixture placement with wall snapping
 * - Connection point visualization
 * - Route visualization with layer toggles
 * - Clearance zone overlays
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { MEPFixture, MEPNode, MEPRoute, MEPClash, MEPSystemState } from '@/types/mep';
import type { FixtureTemplate } from '@/data/fixtureLibrary';
import type { Wall, Point } from '@/types/floorPlan';
import { SYSTEM_COLORS } from '@/types/mep';
import { calculateSnapPreview, type SnapResult } from '@/utils/wallSnapping';
import { calculateNodeSnap, hitTestNode, type NodeSnapResult } from '@/utils/mepNodeSnapping';
import { drawClashMarkers } from './ClashVisualizationOverlay';
import { createTrapInfo, drawTrapSymbol, detectSTraps } from '@/utils/mepTraps';
import { placeCleanouts, getCleanoutSymbols, drawCleanoutSymbol } from '@/utils/mepCleanouts';
import { calculateSegmentSlope, formatSlope } from '@/utils/mepSlopeEngine';

// =============================================================================
// TYPES
// =============================================================================

interface MEPCanvasProps {
  // Room geometry
  walls: Wall[];
  points: Point[];
  roomWidth: number;
  roomHeight: number;
  
  // MEP state
  fixtures: MEPFixture[];
  nodes: MEPNode[];
  routes: MEPRoute[];
  clashes: MEPClash[];
  layerVisibility: MEPSystemState['layerVisibility'];
  
  // Placement mode
  placingTemplate: FixtureTemplate | null;
  onPlaceFixture: (position: { x: number; y: number }, rotation: number) => void;
  
  // Selection
  selectedFixtureId: string | null;
  onSelectFixture: (id: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  
  // Editing
  onMoveFixture: (id: string, position: { x: number; y: number }) => void;
  onRotateFixture: (id: string, rotation: number) => void;
  onDeleteFixture: (id: string) => void;
  onMoveNode: (id: string, position: { x: number; y: number; z: number }) => void;
}

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CANVAS_PADDING = 50;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const GRID_SIZE = 20;
const FLOW_ANIMATION_SPEED = 0.02; // Speed of flow animation
const FLOW_ARROW_SPACING = 40; // Pixels between flow arrows

// =============================================================================
// FLOW INDICATOR DRAWING
// =============================================================================

/**
 * Draw animated flow direction arrows along a route
 */
function drawFlowIndicators(
  ctx: CanvasRenderingContext2D,
  route: MEPRoute,
  flowOffset: number,
  scale: number,
  color: string
): void {
  const arrowSize = 6 / scale;
  const spacing = FLOW_ARROW_SPACING;
  
  // Determine flow direction based on system type
  // Drainage/vent flows away from fixtures (source to destination reversed visually)
  // Water flows toward fixtures (source to destination)
  const isDrainageOrVent = route.systemType === 'drainage' || route.systemType === 'vent';
  
  // Build path points for the entire route
  const pathPoints: Array<{ x: number; y: number }> = [];
  for (const segment of route.segments) {
    if (pathPoints.length === 0) {
      pathPoints.push({ x: segment.startPoint.x, y: segment.startPoint.y });
    }
    pathPoints.push({ x: segment.endPoint.x, y: segment.endPoint.y });
  }
  
  if (pathPoints.length < 2) return;
  
  // Calculate total path length
  let totalLength = 0;
  const segmentLengths: number[] = [];
  for (let i = 1; i < pathPoints.length; i++) {
    const dx = pathPoints[i].x - pathPoints[i - 1].x;
    const dy = pathPoints[i].y - pathPoints[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(len);
    totalLength += len;
  }
  
  if (totalLength < spacing) return;
  
  // Draw arrows along the path
  const numArrows = Math.floor(totalLength / spacing);
  
  for (let i = 0; i < numArrows; i++) {
    // Calculate position along path with animation offset
    let targetDist = ((i + flowOffset) * spacing) % totalLength;
    
    // For drainage, reverse the animation direction
    if (isDrainageOrVent) {
      targetDist = totalLength - targetDist;
    }
    
    // Find which segment this distance falls on
    let accumulatedDist = 0;
    let segmentIndex = 0;
    for (let j = 0; j < segmentLengths.length; j++) {
      if (accumulatedDist + segmentLengths[j] >= targetDist) {
        segmentIndex = j;
        break;
      }
      accumulatedDist += segmentLengths[j];
    }
    
    // Calculate position within segment
    const segmentDist = targetDist - accumulatedDist;
    const segmentLen = segmentLengths[segmentIndex];
    const t = segmentLen > 0 ? segmentDist / segmentLen : 0;
    
    const p1 = pathPoints[segmentIndex];
    const p2 = pathPoints[segmentIndex + 1];
    
    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;
    
    // Calculate direction angle
    let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    
    // Reverse arrow direction for drainage (flows from fixture toward drain)
    if (isDrainageOrVent) {
      angle += Math.PI;
    }
    
    // Draw arrow
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Arrow with glow effect
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.6, -arrowSize * 0.5);
    ctx.lineTo(-arrowSize * 0.3, 0);
    ctx.lineTo(-arrowSize * 0.6, arrowSize * 0.5);
    ctx.closePath();
    ctx.fill();
    
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/**
 * Draw pipe size labels at key points along a route
 */
function drawPipeSizeLabels(
  ctx: CanvasRenderingContext2D,
  route: MEPRoute,
  scale: number,
  color: string
): void {
  const fontSize = 10 / scale;
  const labelPadding = 2 / scale;
  const minSegmentLength = 60; // Only label segments longer than this
  
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Track positions to avoid overlapping labels
  const labelPositions: Array<{ x: number; y: number }> = [];
  const minLabelDistance = 80;
  
  for (const segment of route.segments) {
    const dx = segment.endPoint.x - segment.startPoint.x;
    const dy = segment.endPoint.y - segment.startPoint.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    // Skip short segments
    if (segmentLength < minSegmentLength) continue;
    
    // Calculate midpoint
    const midX = (segment.startPoint.x + segment.endPoint.x) / 2;
    const midY = (segment.startPoint.y + segment.endPoint.y) / 2;
    
    // Check if too close to existing label
    const tooClose = labelPositions.some(pos => {
      const dist = Math.sqrt(Math.pow(pos.x - midX, 2) + Math.pow(pos.y - midY, 2));
      return dist < minLabelDistance;
    });
    
    if (tooClose) continue;
    
    labelPositions.push({ x: midX, y: midY });
    
    // Calculate perpendicular offset for label placement
    const angle = Math.atan2(dy, dx);
    const offsetDist = 12 / scale;
    const offsetX = Math.sin(angle) * offsetDist;
    const offsetY = -Math.cos(angle) * offsetDist;
    
    const labelX = midX + offsetX;
    const labelY = midY + offsetY;
    
    // Format pipe size label
    const sizeText = segment.size < 1 
      ? `${segment.size}"` 
      : `${segment.size}"`;
    
    // Measure text for background
    const textMetrics = ctx.measureText(sizeText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    
    // Draw label background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(
      labelX - textWidth / 2 - labelPadding * 2,
      labelY - textHeight / 2 - labelPadding,
      textWidth + labelPadding * 4,
      textHeight + labelPadding * 2,
      3 / scale
    );
    ctx.fill();
    
    // Draw label border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
    
    // Draw label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sizeText, labelX, labelY);
  }
  
  // Draw pipe size at the start (near source node)
  if (route.segments.length > 0) {
    const firstSeg = route.segments[0];
    const startX = firstSeg.startPoint.x;
    const startY = firstSeg.startPoint.y;
    
    // Check if already labeled nearby
    const tooClose = labelPositions.some(pos => {
      const dist = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
      return dist < minLabelDistance / 2;
    });
    
    if (!tooClose && route.requiredSize) {
      const labelText = `${route.requiredSize}" ${getMaterialAbbrev(firstSeg.material)}`;
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;
      
      // Position label offset from start point
      const dx = firstSeg.endPoint.x - startX;
      const dy = firstSeg.endPoint.y - startY;
      const angle = Math.atan2(dy, dx);
      const offsetX = startX + Math.cos(angle) * 20 / scale;
      const offsetY = startY + Math.sin(angle) * 20 / scale - 15 / scale;
      
      // Draw background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.roundRect(
        offsetX - textWidth / 2 - labelPadding * 2,
        offsetY - textHeight / 2 - labelPadding,
        textWidth + labelPadding * 4,
        textHeight + labelPadding * 2,
        3 / scale
      );
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 / scale;
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = color;
      ctx.fillText(labelText, offsetX, offsetY);
    }
  }
}

/**
 * Get abbreviated material name
 */
function getMaterialAbbrev(material: string): string {
  const abbrevs: Record<string, string> = {
    'PVC': 'PVC',
    'ABS': 'ABS',
    'Copper': 'Cu',
    'PEX': 'PEX',
    'CPVC': 'CPVC',
    'THHN': 'THHN',
    'Cast Iron': 'CI',
    'Galvanized': 'Galv',
  };
  return abbrevs[material] || material.substring(0, 3);
}

// =============================================================================
// COMPONENT
// =============================================================================

export const MEPCanvas: React.FC<MEPCanvasProps> = ({
  walls,
  points,
  roomWidth,
  roomHeight,
  fixtures,
  nodes,
  routes,
  clashes,
  layerVisibility,
  placingTemplate,
  onPlaceFixture,
  selectedFixtureId,
  onSelectFixture,
  selectedNodeId,
  onSelectNode,
  onMoveFixture,
  onRotateFixture,
  onDeleteFixture,
  onMoveNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Transform state
  const [transform, setTransform] = useState<CanvasTransform>({ x: CANVAS_PADDING, y: CANVAS_PADDING, scale: 1 });
  
  // Interaction state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragFixtureId, setDragFixtureId] = useState<string | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  
  // Placement preview
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [nodeSnapResult, setNodeSnapResult] = useState<NodeSnapResult | null>(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  
  // Flow animation state
  const [flowOffset, setFlowOffset] = useState(0);
  const animationRef = useRef<number>(0);

  // ===========================================================================
  // COORDINATE TRANSFORMS
  // ===========================================================================

  const screenToWorld = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    return {
      x: (screenX - rect.left - transform.x) / transform.scale,
      y: (screenY - rect.top - transform.y) / transform.scale,
    };
  }, [transform]);

  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * transform.scale + transform.x,
      y: worldY * transform.scale + transform.y,
    };
  }, [transform]);

  // ===========================================================================
  // KEYBOARD EVENTS
  // ===========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true);
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFixtureId) {
          onDeleteFixture(selectedFixtureId);
        }
        // Note: nodes are infrastructure, typically not deletable
      }
      if (e.key === 'Escape') {
        onSelectFixture(null);
        onSelectNode(null);
      }
      // Rotate selected fixture with R key
      if (e.key === 'r' || e.key === 'R') {
        if (selectedFixtureId) {
          const fixture = fixtures.find(f => f.id === selectedFixtureId);
          if (fixture) {
            onRotateFixture(selectedFixtureId, (fixture.rotation + 90) % 360);
          }
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedFixtureId, fixtures, onDeleteFixture, onSelectFixture, onSelectNode, onRotateFixture]);

  // ===========================================================================
  // MOUSE HANDLERS
  // ===========================================================================

  // Track mouse-down position for pan threshold (5px to distinguish click vs drag)
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const pendingPan = useRef(false);
  const PAN_THRESHOLD = 5;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    
    // Middle mouse or Alt+left = immediate pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      return;
    }
    
    if (e.button !== 0) return;
    
    // Check if clicking on a node first (nodes are larger hit targets)
    for (const node of nodes) {
      if (hitTestNode(worldPos.x, worldPos.y, node, 15)) {
        onSelectNode(node.id);
        onSelectFixture(null);
        setIsDraggingNode(true);
        setDragNodeId(node.id);
        return;
      }
    }
    
    // Check if clicking on a fixture
    for (const fixture of fixtures) {
      const dx = worldPos.x - fixture.position.x;
      const dy = worldPos.y - fixture.position.y;
      const halfW = fixture.dimensions.width / 2;
      const halfD = fixture.dimensions.depth / 2;
      
      // Simple AABB check (ignoring rotation for now)
      if (Math.abs(dx) < halfW && Math.abs(dy) < halfD) {
        onSelectFixture(fixture.id);
        onSelectNode(null);
        setIsDragging(true);
        setDragFixtureId(fixture.id);
        return;
      }
    }
    
    // If placing a fixture
    if (placingTemplate && snapResult) {
      onPlaceFixture({ x: snapResult.ghostCx, y: snapResult.ghostCy }, snapResult.ghostRotation);
      return;
    }
    
    // Clicked on empty space — prepare for potential pan (with threshold)
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    pendingPan.current = true;
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  }, [screenToWorld, transform, fixtures, nodes, placingTemplate, snapResult, onSelectFixture, onSelectNode, onPlaceFixture]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setCursorPos(worldPos);
    
    // Handle pending pan (threshold check)
    if (pendingPan.current && mouseDownPos.current) {
      const dx = e.clientX - mouseDownPos.current.x;
      const dy = e.clientY - mouseDownPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > PAN_THRESHOLD) {
        setIsPanning(true);
        pendingPan.current = false;
      }
    }
    
    // Handle panning
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }
    
    // Handle node dragging with wall snapping
    if (isDraggingNode && dragNodeId) {
      const node = nodes.find(n => n.id === dragNodeId);
      if (node) {
        const snap = calculateNodeSnap(
          worldPos.x,
          worldPos.y,
          node.type,
          walls,
          points,
          node.position.z
        );
        setNodeSnapResult(snap);
        onMoveNode(dragNodeId, snap.position);
      }
      return;
    }
    
    // Handle fixture dragging
    if (isDragging && dragFixtureId) {
      const fixture = fixtures.find(f => f.id === dragFixtureId);
      // Cast to floorPlan FixtureType - MEP types overlap
      const fixtureTypeForSnap = (fixture?.type || 'toilet') as import('@/types/floorPlan').FixtureType;
      const snap = calculateSnapPreview(
        worldPos.x,
        worldPos.y,
        0,
        fixtureTypeForSnap,
        fixture?.dimensions.width || 40,
        fixture?.dimensions.depth || 60,
        walls,
        points,
        shiftHeld
      );
      
      onMoveFixture(dragFixtureId, { x: snap.ghostCx, y: snap.ghostCy });
      return;
    }
    
    // Update hovered node for visual feedback
    let foundHover = false;
    for (const node of nodes) {
      if (hitTestNode(worldPos.x, worldPos.y, node, 15)) {
        setHoveredNodeId(node.id);
        foundHover = true;
        break;
      }
    }
    if (!foundHover) {
      setHoveredNodeId(null);
    }
    
    // Calculate snap preview for placement
    if (placingTemplate) {
      // Cast to floorPlan FixtureType for snap calculation
      const typeForSnap = placingTemplate.type as import('@/types/floorPlan').FixtureType;
      const wallSnap = calculateSnapPreview(
        worldPos.x,
        worldPos.y,
        0,
        typeForSnap,
        placingTemplate.dimensions.width,
        placingTemplate.dimensions.depth,
        walls,
        points,
        shiftHeld
      );
      setSnapResult(wallSnap);
    }
  }, [
    screenToWorld, isPanning, panStart, isDragging, dragFixtureId, isDraggingNode, dragNodeId,
    placingTemplate, walls, points, shiftHeld, fixtures, nodes, onMoveFixture, onMoveNode
  ]);

  const handleMouseUp = useCallback(() => {
    // If we had a pending pan that never exceeded threshold, treat as click-deselect
    if (pendingPan.current && !isPanning) {
      onSelectFixture(null);
      onSelectNode(null);
    }
    pendingPan.current = false;
    mouseDownPos.current = null;
    setIsPanning(false);
    setIsDragging(false);
    setDragFixtureId(null);
    setIsDraggingNode(false);
    setDragNodeId(null);
    setNodeSnapResult(null);
  }, [isPanning, onSelectFixture, onSelectNode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale * delta));
    
    // Zoom towards mouse position
    const scaleChange = newScale / transform.scale;
    setTransform(prev => ({
      x: mouseX - (mouseX - prev.x) * scaleChange,
      y: mouseY - (mouseY - prev.y) * scaleChange,
      scale: newScale,
    }));
  }, [transform.scale]);

  // ===========================================================================
  // CSS COLOR RESOLUTION
  // ===========================================================================

  // Helper to resolve CSS variables to actual color values for Canvas 2D API
  const getComputedColor = useCallback((cssVar: string, alpha?: number): string => {
    const style = getComputedStyle(document.documentElement);
    const value = style.getPropertyValue(cssVar).trim();
    if (!value) return '#000000';
    if (alpha !== undefined) {
      return `hsla(${value}, ${alpha})`;
    }
    return `hsl(${value})`;
  }, []);

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const { width, height } = canvas;
    
    // Resolve CSS colors for canvas use
    const colors = {
      background: getComputedColor('--background'),
      foreground: getComputedColor('--foreground'),
      border: getComputedColor('--border'),
      muted: getComputedColor('--muted'),
      mutedForeground: getComputedColor('--muted-foreground'),
      primary: getComputedColor('--primary'),
      primaryAlpha10: getComputedColor('--primary', 0.1),
      primaryAlpha50: getComputedColor('--primary', 0.5),
      mutedForegroundAlpha50: getComputedColor('--muted-foreground', 0.5),
    };
    
    // Clear
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);
    
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    
    // Draw grid - thin white lines for high-tech look
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5 / transform.scale;
    
    for (let x = 0; x <= roomWidth; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, roomHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= roomHeight; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(roomWidth, y);
      ctx.stroke();
    }
    
    // Draw room boundary
    ctx.strokeStyle = colors.foreground;
    ctx.lineWidth = 2 / transform.scale;
    ctx.strokeRect(0, 0, roomWidth, roomHeight);
    
    // Draw walls with glassmorphism + neon effect
    const neonColor = 'hsl(142, 76%, 45%)';
    const neonGlowOuter = 'hsla(142, 76%, 45%, 0.15)';
    const neonGlowMid = 'hsla(142, 76%, 45%, 0.25)';
    const glassColor = 'hsla(142, 76%, 45%, 0.08)';
    
    for (const wall of walls) {
      const startPt = points.find(p => p.id === wall.startPointId);
      const endPt = points.find(p => p.id === wall.endPointId);
      
      if (startPt && endPt) {
        const dx = endPt.x - startPt.x;
        const dy = endPt.y - startPt.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len > 0) {
          const nx = -dy / len * wall.thickness / 2;
          const ny = dx / len * wall.thickness / 2;
          
          // Outer glow
          ctx.fillStyle = neonGlowOuter;
          ctx.beginPath();
          ctx.moveTo(startPt.x + nx * 2, startPt.y + ny * 2);
          ctx.lineTo(endPt.x + nx * 2, endPt.y + ny * 2);
          ctx.lineTo(endPt.x - nx * 2, endPt.y - ny * 2);
          ctx.lineTo(startPt.x - nx * 2, startPt.y - ny * 2);
          ctx.closePath();
          ctx.fill();
          
          // Glass fill
          ctx.fillStyle = glassColor;
          ctx.beginPath();
          ctx.moveTo(startPt.x + nx, startPt.y + ny);
          ctx.lineTo(endPt.x + nx, endPt.y + ny);
          ctx.lineTo(endPt.x - nx, endPt.y - ny);
          ctx.lineTo(startPt.x - nx, startPt.y - ny);
          ctx.closePath();
          ctx.fill();
          
          // Neon edge
          ctx.strokeStyle = neonColor;
          ctx.lineWidth = 1.5 / transform.scale;
          ctx.beginPath();
          ctx.moveTo(startPt.x, startPt.y);
          ctx.lineTo(endPt.x, endPt.y);
          ctx.stroke();
        }
      }
    }
    
    // Draw infrastructure nodes
    for (const node of nodes) {
      const isSelected = node.id === selectedNodeId;
      const isHovered = node.id === hoveredNodeId;
      const isDragging = node.id === dragNodeId;
      const size = isSelected || isHovered ? 24 : 20;
      
      const baseColor = node.type.includes('water') ? SYSTEM_COLORS['cold-water'] : 
                        node.type.includes('drain') ? SYSTEM_COLORS['drainage'] : 
                        node.type.includes('vent') ? SYSTEM_COLORS['vent'] :
                        SYSTEM_COLORS['power'];
      
      // Draw selection/hover ring
      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? colors.primary : colors.mutedForeground;
        ctx.lineWidth = (isSelected ? 3 : 2) / transform.scale;
        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, size / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw snap indicator when dragging
      if (isDragging && nodeSnapResult?.shouldSnap) {
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([4 / transform.scale, 4 / transform.scale]);
        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, size / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Draw node body
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(node.position.x, node.position.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw outline
      ctx.strokeStyle = isSelected ? 'white' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2 / transform.scale;
      ctx.stroke();
      
      // Draw node icon/label with distinctive symbols
      ctx.fillStyle = 'white';
      ctx.font = `bold ${10 / transform.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Use distinctive icons based on node type
      let icon = 'N';
      let secondaryIcon = '';
      switch (node.type) {
        case 'drain-stack':
          icon = 'DS';
          break;
        case 'vent-stack':
          icon = 'VS';
          break;
        case 'wet-vent-stack':
          icon = 'WV';
          break;
        case 'stack-base':
          icon = 'SB';
          break;
        case 'stack-through-roof':
          icon = 'TR';
          break;
        case 'water-main':
          icon = 'WM';
          break;
        case 'water-heater':
          icon = 'WH';
          break;
        case 'water-manifold':
          icon = 'MF';
          break;
        case 'electrical-panel':
          icon = 'EP';
          break;
        case 'sub-panel':
          icon = 'SP';
          break;
        case 'junction-box':
          icon = 'JB';
          break;
        case 'floor-cleanout':
          icon = 'CO';
          break;
        default:
          icon = node.name.substring(0, 2).toUpperCase();
      }
      ctx.fillText(icon, node.position.x, node.position.y);
      
      // Draw name label below when selected
      if (isSelected) {
        ctx.font = `${9 / transform.scale}px sans-serif`;
        ctx.fillStyle = colors.foreground;
        ctx.fillText(node.name, node.position.x, node.position.y + size / 2 + 12);
      }
    }
    
    // Draw routes (if layer visible) with flow indicators and slope visualization
    for (const route of routes) {
      const layerKey = route.systemType === 'cold-water' ? 'coldWater' :
                       route.systemType === 'hot-water' ? 'hotWater' :
                       route.systemType === 'drainage' ? 'drainage' :
                       route.systemType === 'vent' ? 'vent' : 'electrical';
      
      if (!layerVisibility[layerKey as keyof typeof layerVisibility]) continue;
      
      const color = SYSTEM_COLORS[route.systemType];
      
      // For drainage routes, color-code segments by slope validity
      if (route.systemType === 'drainage') {
        for (const segment of route.segments) {
          const slopeData = calculateSegmentSlope(segment);
          
          // Color based on slope validity: green=good, yellow=minimum, red=insufficient
          if (slopeData.isValid) {
            ctx.strokeStyle = slopeData.slope > 0.3 ? '#22C55E' : '#EAB308'; // green or yellow
          } else {
            ctx.strokeStyle = '#EF4444'; // red
          }
          ctx.lineWidth = Math.max(3, (route.requiredSize || 2)) / transform.scale;
          
          ctx.beginPath();
          ctx.moveTo(segment.startPoint.x, segment.startPoint.y);
          ctx.lineTo(segment.endPoint.x, segment.endPoint.y);
          ctx.stroke();
          
          // Draw slope label at midpoint of horizontal runs
          const dx = segment.endPoint.x - segment.startPoint.x;
          const dy = segment.endPoint.y - segment.startPoint.y;
          const segLen = Math.sqrt(dx * dx + dy * dy);
          
          if (segLen > 60 && segment.orientation !== 'vertical') {
            const midX = (segment.startPoint.x + segment.endPoint.x) / 2;
            const midY = (segment.startPoint.y + segment.endPoint.y) / 2;
            
            ctx.save();
            ctx.font = `${8 / transform.scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            // Background
            const slopeText = slopeData.slope > 0 ? `↘ ${(slopeData.slope * 100 / 12).toFixed(1)}%` : 'FLAT';
            const textWidth = ctx.measureText(slopeText).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(midX - textWidth/2 - 3, midY - 14/transform.scale, textWidth + 6, 12/transform.scale);
            
            ctx.fillStyle = slopeData.isValid ? '#22C55E' : '#EF4444';
            ctx.fillText(slopeText, midX, midY - 4/transform.scale);
            ctx.restore();
          }
        }
      } else {
        // Non-drainage routes - draw normally
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, (route.requiredSize || 2)) / transform.scale;
        
        ctx.beginPath();
        for (let i = 0; i < route.segments.length; i++) {
          const seg = route.segments[i];
          if (i === 0) {
            ctx.moveTo(seg.startPoint.x, seg.startPoint.y);
          }
          ctx.lineTo(seg.endPoint.x, seg.endPoint.y);
        }
        ctx.stroke();
      }
      
      // Draw animated flow indicators
      drawFlowIndicators(ctx, route, flowOffset, transform.scale, color);
      
      // Draw pipe size labels
      drawPipeSizeLabels(ctx, route, transform.scale, color);
      
      // Draw vent connection markers for vent routes
      if (route.systemType === 'vent' && route.segments.length > 0) {
        const startPt = route.segments[0].startPoint;
        ctx.save();
        ctx.translate(startPt.x, startPt.y);
        
        // Draw vent tee symbol
        ctx.strokeStyle = SYSTEM_COLORS['vent'];
        ctx.lineWidth = 2 / transform.scale;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        
        ctx.beginPath();
        ctx.arc(0, 0, 8 / transform.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // V label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${8 / transform.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('V', 0, 0);
        
        ctx.restore();
      }
      
      // Draw cleanouts on drainage routes
      if (route.systemType === 'drainage') {
        const { cleanouts } = placeCleanouts(route, nodes, { metric: false });
        const symbols = getCleanoutSymbols(cleanouts);
        
        for (const symbol of symbols) {
          drawCleanoutSymbol(ctx, symbol, transform.scale);
        }
      }
    }
    
    // Draw P-traps for plumbing fixtures
    for (const fixture of fixtures) {
      // Skip non-plumbing fixtures and toilets (integral traps)
      if (fixture.type === 'toilet' || fixture.type === 'hose-bib') continue;
      
      const drainRoute = routes.find(r => 
        r.destination.type === 'fixture' &&
        r.destination.id === fixture.id &&
        r.systemType === 'drainage'
      );
      
      if (!drainRoute) continue;
      
      // Find the vent route for this fixture to prevent false S-trap detection
      const ventRoute = routes.find(r =>
        r.destination.type === 'fixture' &&
        r.destination.id === fixture.id &&
        r.systemType === 'vent'
      );
      
      const trapInfo = createTrapInfo(fixture, drainRoute, ventRoute);
      
      // Adjust trap position relative to fixture
      ctx.save();
      ctx.translate(fixture.position.x, fixture.position.y + fixture.dimensions.depth / 2 + 20);
      // Scale up trap symbols for better visibility (use 0.6 instead of 1.0)
      drawTrapSymbol(ctx, { ...trapInfo, position: { x: 0, y: 0, z: trapInfo.position.z } }, transform.scale * 0.6, true);
      ctx.restore();
    }
    
    // Draw S-trap warnings
    const sTraps = detectSTraps(fixtures, routes);
    for (const sTrap of sTraps) {
      const fixture = fixtures.find(f => f.id === sTrap.fixtureId);
      if (!fixture) continue;
      
      ctx.save();
      ctx.translate(fixture.position.x, fixture.position.y);
      
      // Red warning triangle background
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      const triSize = 16 / transform.scale;
      ctx.moveTo(0, -fixture.dimensions.depth/2 - 25/transform.scale);
      ctx.lineTo(-triSize, -fixture.dimensions.depth/2 - 25/transform.scale + triSize * 1.5);
      ctx.lineTo(triSize, -fixture.dimensions.depth/2 - 25/transform.scale + triSize * 1.5);
      ctx.closePath();
      ctx.fill();
      
      // Warning text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${10 / transform.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, -fixture.dimensions.depth/2 - 25/transform.scale + triSize * 0.8);
      
      // S-TRAP label
      ctx.fillStyle = '#EF4444';
      ctx.font = `bold ${9 / transform.scale}px sans-serif`;
      ctx.fillText('S-TRAP', 0, -fixture.dimensions.depth/2 - 40/transform.scale);
      
      ctx.restore();
    }
    
    // Draw fixtures (if layer visible)
    if (layerVisibility.fixtures) {
      for (const fixture of fixtures) {
        const isSelected = fixture.id === selectedFixtureId;
        
        ctx.save();
        ctx.translate(fixture.position.x, fixture.position.y);
        ctx.rotate(fixture.rotation * Math.PI / 180);
        
        // Draw clearance zone
        if (isSelected) {
          ctx.fillStyle = colors.primaryAlpha10;
          ctx.fillRect(
            -fixture.dimensions.width / 2 - fixture.clearance.sides,
            -fixture.dimensions.depth / 2 - fixture.clearance.rear,
            fixture.dimensions.width + fixture.clearance.sides * 2,
            fixture.dimensions.depth + fixture.clearance.front + fixture.clearance.rear
          );
        }
        
        // Draw fixture body
        ctx.fillStyle = isSelected ? colors.primary : colors.mutedForeground;
        ctx.fillRect(
          -fixture.dimensions.width / 2,
          -fixture.dimensions.depth / 2,
          fixture.dimensions.width,
          fixture.dimensions.depth
        );
        
        // Draw fixture outline
        ctx.strokeStyle = isSelected ? colors.primary : colors.foreground;
        ctx.lineWidth = (isSelected ? 3 : 1) / transform.scale;
        ctx.strokeRect(
          -fixture.dimensions.width / 2,
          -fixture.dimensions.depth / 2,
          fixture.dimensions.width,
          fixture.dimensions.depth
        );
        
        // Draw connection points
        for (const conn of fixture.connections) {
          const connColor = SYSTEM_COLORS[conn.systemType] || '#888';
          ctx.fillStyle = connColor;
          ctx.beginPath();
          ctx.arc(conn.localPosition.x, conn.localPosition.y, 4 / transform.scale, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw fixture label
        ctx.fillStyle = 'white';
        ctx.font = `bold ${10 / transform.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fixture.name.substring(0, 1).toUpperCase(), 0, 0);
        
        ctx.restore();
      }
    }
    
    // Draw placement preview
    if (placingTemplate && snapResult) {
      ctx.save();
      ctx.translate(snapResult.ghostCx, snapResult.ghostCy);
      ctx.rotate(snapResult.ghostRotation * Math.PI / 180);
      
      // Ghost fixture
      ctx.fillStyle = snapResult.shouldSnap ? 
        colors.primaryAlpha50 : 
        colors.mutedForegroundAlpha50;
      ctx.fillRect(
        -placingTemplate.dimensions.width / 2,
        -placingTemplate.dimensions.depth / 2,
        placingTemplate.dimensions.width,
        placingTemplate.dimensions.depth
      );
      
      // Ghost outline
      ctx.strokeStyle = snapResult.shouldSnap ? colors.primary : colors.mutedForeground;
      ctx.lineWidth = 2 / transform.scale;
      ctx.setLineDash([5 / transform.scale, 5 / transform.scale]);
      ctx.strokeRect(
        -placingTemplate.dimensions.width / 2,
        -placingTemplate.dimensions.depth / 2,
        placingTemplate.dimensions.width,
        placingTemplate.dimensions.depth
      );
      
      // Connection point previews
      for (const conn of placingTemplate.connectionTemplates) {
        const connColor = SYSTEM_COLORS[conn.systemType] || '#888';
        ctx.fillStyle = connColor;
        ctx.beginPath();
        ctx.arc(conn.localPosition.x, conn.localPosition.y, 4 / transform.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
    
    // Draw clash markers
    if (clashes.length > 0) {
      drawClashMarkers(ctx, clashes, transform.scale);
    }
    
    ctx.restore();
    
    // Draw cursor coordinates
    ctx.fillStyle = colors.mutedForeground;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`(${Math.round(cursorPos.x)}, ${Math.round(cursorPos.y)})`, 10, height - 10);
    
    if (placingTemplate) {
      ctx.fillText(`Placing: ${placingTemplate.name} ${shiftHeld ? '(free)' : ''}`, 10, height - 25);
    }
    
    if (clashes.length > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`⚠ ${clashes.length} clash${clashes.length > 1 ? 'es' : ''} detected`, 10, height - 40);
    }
  }, [
    transform, roomWidth, roomHeight, walls, points, nodes, routes, 
    fixtures, clashes, layerVisibility, selectedFixtureId, selectedNodeId, 
    hoveredNodeId, dragNodeId, nodeSnapResult, placingTemplate, 
    snapResult, cursorPos, shiftHeld, flowOffset, getComputedColor
  ]);

  // ===========================================================================
  // FLOW ANIMATION
  // ===========================================================================

  useEffect(() => {
    if (routes.length === 0) return;
    
    const animate = () => {
      setFlowOffset(prev => (prev + FLOW_ANIMATION_SPEED) % 1);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [routes.length]);

  // ===========================================================================
  // RESIZE HANDLING
  // ===========================================================================

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

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  // Determine cursor based on interaction state
  const getCursor = () => {
    if (placingTemplate) return 'crosshair';
    if (isPanning) return 'grabbing';
    if (isDraggingNode) return 'move';
    if (hoveredNodeId) return 'pointer';
    return 'default';
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative bg-background overflow-hidden"
      style={{ cursor: getCursor() }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};
