/**
 * WalkthroughOverlay — UI overlay shown during Unreal walkthrough mode.
 * Shows exit button, render button, and a minimap of the room.
 */

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { X, Camera, Map } from 'lucide-react';
import type { FloorPlan, Point, Wall } from '@/types/floorPlan';
import type { SpawnPoint } from './SpawnPointMarker';

interface WalkthroughOverlayProps {
  floorPlan: FloorPlan;
  spawn: SpawnPoint;
  onExit: () => void;
  onRender?: () => void;
  visible: boolean;
}

const MINIMAP_SIZE = 160;
const MINIMAP_PADDING = 12;

export const WalkthroughOverlay: React.FC<WalkthroughOverlayProps> = ({
  floorPlan,
  spawn,
  onExit,
  onRender,
  visible,
}) => {
  // Compute minimap SVG paths
  const minimapData = useMemo(() => {
    const points = floorPlan.points;
    if (points.length === 0) return null;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;

    const drawSize = MINIMAP_SIZE - MINIMAP_PADDING * 2;
    const scale = Math.min(drawSize / w, drawSize / h);
    const offsetX = (MINIMAP_SIZE - w * scale) / 2;
    const offsetY = (MINIMAP_SIZE - h * scale) / 2;

    const toSvg = (x: number, y: number) => ({
      sx: (x - minX) * scale + offsetX,
      sy: (y - minY) * scale + offsetY,
    });

    // Wall lines
    const wallLines = floorPlan.walls.map(wall => {
      const start = points.find(p => p.id === wall.startPointId);
      const end = points.find(p => p.id === wall.endPointId);
      if (!start || !end) return null;
      const s = toSvg(start.x, start.y);
      const e = toSvg(end.x, end.y);
      return { x1: s.sx, y1: s.sy, x2: e.sx, y2: e.sy };
    }).filter(Boolean);

    // Spawn position
    const spawnSvg = toSvg(spawn.position.x, spawn.position.y);
    const spawnAngle = -(spawn.rotation * Math.PI) / 180;

    return { wallLines, spawnSvg, spawnAngle };
  }, [floorPlan, spawn]);

  if (!visible) return null;

  return (
    <>
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        {onRender && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 bg-card/80 backdrop-blur-sm border border-border/50"
            onClick={onRender}
          >
            <Camera className="h-3.5 w-3.5" />
            Render
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 bg-card/80 backdrop-blur-sm border border-border/50"
          onClick={onExit}
        >
          <X className="h-3.5 w-3.5" />
          Exit (Esc)
        </Button>
      </div>

      {/* Bottom-left minimap */}
      {minimapData && (
        <div className="absolute bottom-4 left-4 z-50">
          <div className="bg-card/70 backdrop-blur-md border border-border/40 rounded-lg overflow-hidden shadow-xl">
            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/30">
              <Map className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">Floor Plan</span>
            </div>
            <svg
              width={MINIMAP_SIZE}
              height={MINIMAP_SIZE}
              className="block"
            >
              {/* Background */}
              <rect
                x={0}
                y={0}
                width={MINIMAP_SIZE}
                height={MINIMAP_SIZE}
                fill="hsl(var(--background))"
                opacity={0.5}
              />

              {/* Walls */}
              {minimapData.wallLines.map((line, i) => (
                line && (
                  <line
                    key={i}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    strokeLinecap="round"
                    opacity={0.6}
                  />
                )
              ))}

              {/* Spawn point */}
              <circle
                cx={minimapData.spawnSvg.sx}
                cy={minimapData.spawnSvg.sy}
                r={5}
                fill="#06b6d4"
                stroke="#22d3ee"
                strokeWidth={1.5}
              />

              {/* Direction indicator */}
              <line
                x1={minimapData.spawnSvg.sx}
                y1={minimapData.spawnSvg.sy}
                x2={minimapData.spawnSvg.sx + Math.sin(-minimapData.spawnAngle) * 12}
                y2={minimapData.spawnSvg.sy - Math.cos(-minimapData.spawnAngle) * 12}
                stroke="#22d3ee"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      )}
    </>
  );
};

export default WalkthroughOverlay;
