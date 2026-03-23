/**
 * Riser Diagram View
 * 
 * High-quality schematic visualization showing vertical pipe runs, floor elevations,
 * and system connections in a simplified 2D elevation view.
 */

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import type { MEPFixture, MEPRoute, MEPNode, MEPSystemType } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';

interface RiserDiagramViewProps {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  floorHeight?: number;
  numFloors?: number;
  selectedSystem?: MEPSystemType | 'all';
}

interface RiserElement {
  id: string;
  name: string;
  type: 'fixture' | 'node';
  systemType: MEPSystemType;
  elevation: number;
  floor: number;
  x: number;
  connections: string[];
  size?: number;
}

const FLOOR_HEIGHT = 120;
const CANVAS_PADDING = 80;
const ELEMENT_SPACING = 100;

// ─── Helper functions ────────────────────────────────────────────────────────

function getNodeSystemType(nodeType: string): MEPSystemType {
  switch (nodeType) {
    case 'water-main': case 'water-manifold': return 'cold-water';
    case 'water-heater': return 'hot-water';
    case 'drain-stack': return 'drainage';
    case 'vent-stack': return 'vent';
    case 'electrical-panel': case 'sub-panel': return 'power';
    default: return 'cold-water';
  }
}

function getNodeIcon(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('water') && l.includes('heater')) return 'WH';
  if (l.includes('water')) return 'W';
  if (l.includes('drain')) return 'D';
  if (l.includes('vent')) return 'V';
  if (l.includes('electric')) return 'E';
  return '•';
}

function getFixtureSymbol(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('toilet') || l.includes('wc')) return 'T';
  if (l.includes('sink') || l.includes('lav')) return 'S';
  if (l.includes('shower')) return 'SH';
  if (l.includes('tub') || l.includes('bath')) return 'B';
  if (l.includes('dish')) return 'DW';
  if (l.includes('wash')) return 'WM';
  if (l.includes('drain')) return 'FD';
  return '•';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Legend drawing ──────────────────────────────────────────────────────────

const LEGEND_SYSTEMS: Array<{ label: string; type: MEPSystemType }> = [
  { label: 'Cold Water', type: 'cold-water' },
  { label: 'Hot Water', type: 'hot-water' },
  { label: 'Drainage', type: 'drainage' },
  { label: 'Vent', type: 'vent' },
  { label: 'Electrical', type: 'power' },
];

function drawLegend(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  const padding = 14;
  const lineHeight = 22;
  const headerHeight = 24;
  const colorBoxSize = 14;
  const textGap = 10;

  // Measure max label width
  ctx.font = '12px "Inter", system-ui, sans-serif';
  let maxLabelW = 0;
  for (const sys of LEGEND_SYSTEMS) {
    const w = ctx.measureText(sys.label).width;
    if (w > maxLabelW) maxLabelW = w;
  }

  const boxW = padding * 2 + colorBoxSize + textGap + maxLabelW + 4;
  const boxH = padding * 2 + headerHeight + LEGEND_SYSTEMS.length * lineHeight;
  const boxX = width - boxW - 16;
  const boxY = 16;

  // Background
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fillStyle = 'rgba(15, 15, 30, 0.85)';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Border
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Header
  ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Legend', boxX + padding, boxY + padding);

  // Items
  ctx.font = '12px "Inter", system-ui, sans-serif';
  LEGEND_SYSTEMS.forEach((sys, i) => {
    const itemY = boxY + padding + headerHeight + i * lineHeight;

    // Color swatch with rounded corners
    roundRect(ctx, boxX + padding, itemY, colorBoxSize, colorBoxSize, 3);
    ctx.fillStyle = SYSTEM_COLORS[sys.type];
    ctx.fill();

    // Label
    ctx.fillStyle = '#d0d0d0';
    ctx.textBaseline = 'middle';
    ctx.fillText(sys.label, boxX + padding + colorBoxSize + textGap, itemY + colorBoxSize / 2);
  });
}

// ─── Main component ─────────────────────────────────────────────────────────

export function RiserDiagramView({
  fixtures,
  routes,
  nodes,
  floorHeight = FLOOR_HEIGHT,
  numFloors = 2,
  selectedSystem = 'all',
}: RiserDiagramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [cursorStyle, setCursorStyle] = React.useState<'grab' | 'grabbing'>('grab');
  const [canvasSize, setCanvasSize] = React.useState({ w: 800, h: 500 });

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ w: Math.round(width), h: Math.round(height) });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Build riser elements
  const riserElements = useMemo(() => {
    const elements: RiserElement[] = [];
    let xPosition = CANVAS_PADDING + 40;

    for (const node of nodes) {
      const systemType = getNodeSystemType(node.type);
      if (selectedSystem !== 'all' && systemType !== selectedSystem) continue;
      elements.push({
        id: node.id, name: node.name, type: 'node', systemType,
        elevation: node.position.z,
        floor: Math.floor(node.position.z / floorHeight),
        x: xPosition, connections: node.connectedRouteIds,
      });
      xPosition += ELEMENT_SPACING;
    }

    for (const fixture of fixtures) {
      const primarySystem = fixture.connections[0]?.systemType || 'cold-water';
      if (selectedSystem !== 'all' && primarySystem !== selectedSystem) continue;
      const fixtureElevation = 36;
      elements.push({
        id: fixture.id, name: fixture.name, type: 'fixture', systemType: primarySystem,
        elevation: fixtureElevation,
        floor: Math.floor(fixtureElevation / floorHeight),
        x: xPosition, connections: fixture.connections.map(c => c.id),
      });
      xPosition += ELEMENT_SPACING;
    }
    return elements;
  }, [fixtures, nodes, selectedSystem, floorHeight]);

  const filteredRoutes = useMemo(() => {
    if (selectedSystem === 'all') return routes;
    return routes.filter(r => r.systemType === selectedSystem);
  }, [routes, selectedSystem]);

  // ── Draw ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvasSize.w;
    const h = canvasSize.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#12122a');
    bgGrad.addColorStop(1, '#1a1a35');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // ── Floor lines ──────────────────────────────────────────────────────
    for (let floor = 0; floor <= numFloors; floor++) {
      const y = h - CANVAS_PADDING - (floor * floorHeight * zoom);

      // Dashed line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_PADDING, y);
      ctx.lineTo(w - CANVAS_PADDING, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floor label with subtle bg
      const floorLabel = `Floor ${floor}`;
      ctx.font = 'bold 13px "Inter", system-ui, sans-serif';
      const labelW = ctx.measureText(floorLabel).width;

      roundRect(ctx, 12, y - 12, labelW + 16, 24, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(floorLabel, 20, y);
    }

    // ── Routes (pipes) ───────────────────────────────────────────────────
    for (const route of filteredRoutes) {
      const color = SYSTEM_COLORS[route.systemType];
      const sourceNode = nodes.find(n => n.id === route.source.nodeId);
      const destFixture = fixtures.find(f => f.id === route.destination.id);

      if (sourceNode && destFixture) {
        const sourceEl = riserElements.find(e => e.id === sourceNode.id);
        const destEl = riserElements.find(e => e.id === destFixture.id);

        if (sourceEl && destEl) {
          const sourceY = h - CANVAS_PADDING - (sourceEl.elevation * zoom);
          const destY = h - CANVAS_PADDING - (destEl.elevation * zoom);
          const pipeWidth = Math.max(2.5, route.requiredSize / 1.5);

          // Glow effect
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.strokeStyle = color;
          ctx.lineWidth = pipeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Vertical riser
          ctx.beginPath();
          ctx.moveTo(sourceEl.x, sourceY);
          ctx.lineTo(sourceEl.x, destY);
          ctx.stroke();

          // Horizontal branch
          ctx.beginPath();
          ctx.moveTo(sourceEl.x, destY);
          ctx.lineTo(destEl.x, destY);
          ctx.stroke();

          // Elbow dot
          ctx.beginPath();
          ctx.arc(sourceEl.x, destY, pipeWidth + 1, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.restore();

          // Pipe size label
          const midX = (sourceEl.x + destEl.x) / 2;
          const labelText = `${route.requiredSize}"`;
          ctx.font = 'bold 10px "Inter", system-ui, sans-serif';
          const tw = ctx.measureText(labelText).width;

          roundRect(ctx, midX - tw / 2 - 5, destY - 18, tw + 10, 16, 4);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 0.5;
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, midX, destY - 10);
        }
      }
    }

    // ── Elements (nodes & fixtures) ──────────────────────────────────────
    for (const element of riserElements) {
      const y = h - CANVAS_PADDING - (element.elevation * zoom);
      const color = SYSTEM_COLORS[element.systemType];

      if (element.type === 'node') {
        // Rounded rectangle node
        const nw = 36;
        const nh = 24;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        roundRect(ctx, element.x - nw / 2, y - nh / 2, nw, nh, 6);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Icon
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getNodeIcon(element.name), element.x, y);
      } else {
        // Fixture circle
        const radius = 16;
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(element.x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Symbol
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Inter", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getFixtureSymbol(element.name), element.x, y);
      }

      // Label below element
      ctx.font = '11px "Inter", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(element.name, element.x, y + 22);
    }

    ctx.restore();

    // Legend (drawn outside transform)
    drawLegend(ctx, w, h, dpr);

  }, [riserElements, filteredRoutes, nodes, fixtures, zoom, pan, numFloors, floorHeight, canvasSize]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    setCursorStyle('grabbing');
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    setCursorStyle('grab');
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.3, Math.min(z * delta, 4)));
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}

export default RiserDiagramView;
