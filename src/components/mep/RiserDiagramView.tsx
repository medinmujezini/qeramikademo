/**
 * Riser Diagram View
 * 
 * Schematic visualization showing vertical pipe runs, floor elevations,
 * and system connections in a simplified 2D elevation view.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { MEPFixture, MEPRoute, MEPNode, MEPSystemType } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';

interface RiserDiagramViewProps {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  floorHeight?: number; // Height per floor in inches
  numFloors?: number;
}

interface RiserElement {
  id: string;
  name: string;
  type: 'fixture' | 'node' | 'pipe';
  systemType: MEPSystemType;
  elevation: number;
  floor: number;
  x: number; // Horizontal position for layout
  connections: string[]; // Connected element IDs
  size?: number; // Pipe size
}

const FLOOR_HEIGHT = 120; // 10 feet in inches
const CANVAS_PADDING = 60;
const ELEMENT_SPACING = 80;

export function RiserDiagramView({
  fixtures,
  routes,
  nodes,
  floorHeight = FLOOR_HEIGHT,
  numFloors = 2,
}: RiserDiagramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const [selectedSystem, setSelectedSystem] = React.useState<MEPSystemType | 'all'>('all');
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [cursorStyle, setCursorStyle] = React.useState<'grab' | 'grabbing'>('grab');

  // Build riser elements from fixtures, nodes, and routes
  const riserElements = useMemo(() => {
    const elements: RiserElement[] = [];
    let xPosition = CANVAS_PADDING;

    // Add nodes (infrastructure)
    for (const node of nodes) {
      const systemType = getNodeSystemType(node.type);
      if (selectedSystem !== 'all' && systemType !== selectedSystem) continue;

      elements.push({
        id: node.id,
        name: node.name,
        type: 'node',
        systemType,
        elevation: node.position.z,
        floor: Math.floor(node.position.z / floorHeight),
        x: xPosition,
        connections: node.connectedRouteIds,
      });
      xPosition += ELEMENT_SPACING;
    }

    // Add fixtures
    for (const fixture of fixtures) {
      const primarySystem = fixture.connections[0]?.systemType || 'cold-water';
      if (selectedSystem !== 'all' && primarySystem !== selectedSystem) continue;

      // Fixture position is Point2D, use default elevation of 36"
      const fixtureElevation = 36;
      elements.push({
        id: fixture.id,
        name: fixture.name,
        type: 'fixture',
        systemType: primarySystem,
        elevation: fixtureElevation,
        floor: Math.floor(fixtureElevation / floorHeight),
        x: xPosition,
        connections: fixture.connections.map(c => c.id),
      });
      xPosition += ELEMENT_SPACING;
    }

    return elements;
  }, [fixtures, nodes, selectedSystem, floorHeight]);

  // Filter routes by selected system
  const filteredRoutes = useMemo(() => {
    if (selectedSystem === 'all') return routes;
    return routes.filter(r => r.systemType === selectedSystem);
  }, [routes, selectedSystem]);

  // Draw the riser diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw floor lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    for (let floor = 0; floor <= numFloors; floor++) {
      const y = height - CANVAS_PADDING - (floor * floorHeight * zoom);
      ctx.beginPath();
      ctx.moveTo(CANVAS_PADDING, y);
      ctx.lineTo(width - CANVAS_PADDING, y);
      ctx.stroke();

      // Floor label
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Floor ${floor}`, CANVAS_PADDING - 10, y + 4);
    }
    ctx.setLineDash([]);

    // Draw vertical risers (stacks)
    const drawnStacks = new Set<string>();
    for (const route of filteredRoutes) {
      const color = SYSTEM_COLORS[route.systemType];
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, route.requiredSize / 2);

      // Find connected elements
      const sourceNode = nodes.find(n => n.id === route.source.nodeId);
      const destFixture = fixtures.find(f => f.id === route.destination.id);

      if (sourceNode && destFixture) {
        const sourceElement = riserElements.find(e => e.id === sourceNode.id);
        const destElement = riserElements.find(e => e.id === destFixture.id);

        if (sourceElement && destElement) {
          const sourceY = height - CANVAS_PADDING - (sourceElement.elevation * zoom);
          const destY = height - CANVAS_PADDING - (destElement.elevation * zoom);

          // Draw vertical riser
          ctx.beginPath();
          ctx.moveTo(sourceElement.x, sourceY);
          ctx.lineTo(sourceElement.x, destY);
          ctx.stroke();

          // Draw horizontal branch
          ctx.beginPath();
          ctx.moveTo(sourceElement.x, destY);
          ctx.lineTo(destElement.x, destY);
          ctx.stroke();

          // Draw pipe size label
          ctx.fillStyle = color;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${route.requiredSize}"`, (sourceElement.x + destElement.x) / 2, destY - 5);
        }
      }
    }

    // Draw elements (nodes and fixtures)
    for (const element of riserElements) {
      const y = height - CANVAS_PADDING - (element.elevation * zoom);
      const color = SYSTEM_COLORS[element.systemType];

      if (element.type === 'node') {
        // Draw node as rectangle
        ctx.fillStyle = color;
        ctx.fillRect(element.x - 15, y - 10, 30, 20);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(element.x - 15, y - 10, 30, 20);

        // Node icon based on type
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getNodeIcon(element.name), element.x, y);
      } else {
        // Draw fixture as circle
        ctx.beginPath();
        ctx.arc(element.x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fixture symbol
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getFixtureSymbol(element.name), element.x, y);
      }

      // Element label
      ctx.fillStyle = '#ccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(element.name, element.x, y + 25);
    }

    // Draw legend
    ctx.restore();
    drawLegend(ctx, width, height);

  }, [riserElements, filteredRoutes, nodes, fixtures, zoom, pan, numFloors, floorHeight]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'riser-diagram.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Riser Diagram</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedSystem} onValueChange={(v) => setSelectedSystem(v as MEPSystemType | 'all')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Systems</SelectItem>
                <SelectItem value="drainage">Drainage</SelectItem>
                <SelectItem value="vent">Vent</SelectItem>
                <SelectItem value="cold-water">Cold Water</SelectItem>
                <SelectItem value="hot-water">Hot Water</SelectItem>
                <SelectItem value="power">Electrical</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-full rounded border border-border bg-card"
          style={{ minHeight: 300 }}
        />
      </CardContent>
    </Card>
  );
}

function getNodeSystemType(nodeType: string): MEPSystemType {
  switch (nodeType) {
    case 'water-main':
    case 'water-manifold':
      return 'cold-water';
    case 'water-heater':
      return 'hot-water';
    case 'drain-stack':
      return 'drainage';
    case 'vent-stack':
      return 'vent';
    case 'electrical-panel':
    case 'sub-panel':
      return 'power';
    default:
      return 'cold-water';
  }
}

function getNodeIcon(name: string): string {
  if (name.toLowerCase().includes('water') && name.toLowerCase().includes('heater')) return 'WH';
  if (name.toLowerCase().includes('water')) return 'W';
  if (name.toLowerCase().includes('drain')) return 'D';
  if (name.toLowerCase().includes('vent')) return 'V';
  if (name.toLowerCase().includes('electric')) return 'E';
  return '•';
}

function getFixtureSymbol(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('toilet') || lower.includes('wc')) return 'T';
  if (lower.includes('sink') || lower.includes('lav')) return 'S';
  if (lower.includes('shower')) return 'SH';
  if (lower.includes('tub') || lower.includes('bath')) return 'B';
  if (lower.includes('dish')) return 'DW';
  if (lower.includes('wash')) return 'WM';
  if (lower.includes('drain')) return 'FD';
  return '•';
}

function drawLegend(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const legendX = width - 150;
  const legendY = 20;
  const lineHeight = 18;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(legendX - 10, legendY - 10, 140, 110);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(legendX - 10, legendY - 10, 140, 110);

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('Legend', legendX, legendY + 5);

  const systems: Array<{ label: string; type: MEPSystemType }> = [
    { label: 'Cold Water', type: 'cold-water' },
    { label: 'Hot Water', type: 'hot-water' },
    { label: 'Drainage', type: 'drainage' },
    { label: 'Vent', type: 'vent' },
    { label: 'Electrical', type: 'power' },
  ];

  systems.forEach((sys, i) => {
    const y = legendY + 20 + i * lineHeight;
    ctx.fillStyle = SYSTEM_COLORS[sys.type];
    ctx.fillRect(legendX, y, 12, 12);
    ctx.fillStyle = '#ccc';
    ctx.font = '10px sans-serif';
    ctx.fillText(sys.label, legendX + 18, y + 10);
  });
}

export default RiserDiagramView;
