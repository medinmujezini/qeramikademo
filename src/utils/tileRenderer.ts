// Tile rendering utilities for 2D canvas visualization

import type { Tile, Wall, Point, WallTileSection } from '@/types/floorPlan';
import { calculateTileLayout } from './tileCalculator';

// ---- Async bitmap cache for PBR albedo textures ----
type CacheEntry = { status: 'loading' | 'ready' | 'error'; bitmap?: ImageBitmap };
const bitmapCache = new Map<string, CacheEntry>();

export function requestBitmap(url: string, onReady: () => void): CacheEntry {
  const existing = bitmapCache.get(url);
  if (existing) return existing;
  const entry: CacheEntry = { status: 'loading' };
  bitmapCache.set(url, entry);
  fetch(url, { mode: 'cors' })
    .then(r => r.blob())
    .then(b => createImageBitmap(b))
    .then(bitmap => {
      entry.status = 'ready';
      entry.bitmap = bitmap;
      onReady();
    })
    .catch(() => { entry.status = 'error'; });
  return entry;
}

export interface TileRenderOptions {
  showGrout: boolean;
  groutColor: string;
  groutWidth: number;
  showCutMarks: boolean;
  cutMarkColor: string;
  highlightCuts: boolean;
}

const DEFAULT_OPTIONS: TileRenderOptions = {
  showGrout: true,
  groutColor: '#9ca3af',
  groutWidth: 2,
  showCutMarks: true,
  cutMarkColor: '#f59e0b',
  highlightCuts: true
};

// Render a single wall with tiles in 2D (as a rectangle representation)
export function renderWallTiles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  wallWidth: number,
  wallHeight: number,
  tile: Tile,
  scale: number = 1,
  options: Partial<TileRenderOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Get tile layout
  const layout = calculateTileLayout(wallWidth, wallHeight, tile);
  
  // Scale factors
  const scaleX = scale;
  const scaleY = scale;
  
  // Draw background (grout color)
  if (opts.showGrout) {
    ctx.fillStyle = opts.groutColor;
    ctx.fillRect(x, y, wallWidth * scaleX, wallHeight * scaleY);
  }
  
  // Draw each tile
  for (const pos of layout.tilePositions) {
    const tileX = x + pos.x * scaleX;
    const tileY = y + pos.y * scaleY;
    const tileW = (pos.isCut && pos.cutWidth ? pos.cutWidth : tile.width) * scaleX;
    const tileH = (pos.isCut && pos.cutHeight ? pos.cutHeight : tile.height) * scaleY;
    
    // Grout gap
    const groutGap = opts.showGrout ? opts.groutWidth / 2 : 0;
    
    // Draw tile fill
    ctx.fillStyle = tile.color;
    ctx.fillRect(
      tileX + groutGap,
      tileY + groutGap,
      tileW - groutGap * 2,
      tileH - groutGap * 2
    );
    
    // Highlight cut tiles
    if (pos.isCut && opts.highlightCuts) {
      ctx.strokeStyle = opts.cutMarkColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(
        tileX + groutGap,
        tileY + groutGap,
        tileW - groutGap * 2,
        tileH - groutGap * 2
      );
      ctx.setLineDash([]);
      
      // Draw cut mark (diagonal line)
      if (opts.showCutMarks) {
        ctx.beginPath();
        ctx.moveTo(tileX + groutGap, tileY + groutGap);
        ctx.lineTo(tileX + tileW - groutGap, tileY + tileH - groutGap);
        ctx.stroke();
      }
    }
  }
}

// Render a wall segment on the 2D canvas (top-down view with tile pattern)
export function renderWallWithTilePattern(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  wallThickness: number,
  tile: Tile,
  wallHeight: number,
  scale: number = 1
): void {
  const wallLength = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const angle = Math.atan2(endY - startY, endX - startX);
  
  ctx.save();
  ctx.translate(startX * scale, startY * scale);
  ctx.rotate(angle);
  
  // Draw wall background
  ctx.fillStyle = tile.color;
  ctx.fillRect(0, -wallThickness * scale / 2, wallLength * scale, wallThickness * scale);
  
  // Draw tile grid lines on wall (simplified top-down view)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  
  const tileWidth = tile.width;
  for (let x = tileWidth; x < wallLength; x += tileWidth) {
    ctx.beginPath();
    ctx.moveTo(x * scale, -wallThickness * scale / 2);
    ctx.lineTo(x * scale, wallThickness * scale / 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

// Create a tile pattern as an image for use in 3D textures
export function createTilePatternCanvas(
  tile: Tile,
  wallWidth: number,
  wallHeight: number,
  jointWidth: number = 3,
  scale: number = 0.5 // Reduce resolution for performance
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(wallWidth * scale, 2048);
  canvas.height = Math.min(wallHeight * scale, 2048);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  // Calculate actual scale based on canvas size limits
  const actualScaleX = canvas.width / wallWidth;
  const actualScaleY = canvas.height / wallHeight;
  
  // Background (grout color)
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw tiles
  const layout = calculateTileLayout(wallWidth, wallHeight, tile);
  
  for (const pos of layout.tilePositions) {
    const tileX = pos.x * actualScaleX;
    const tileY = pos.y * actualScaleY;
    const tileW = (pos.isCut && pos.cutWidth ? pos.cutWidth : tile.width) * actualScaleX;
    const tileH = (pos.isCut && pos.cutHeight ? pos.cutHeight : tile.height) * actualScaleY;
    
    const groutGap = (jointWidth / 2) * Math.min(actualScaleX, actualScaleY);
    
    ctx.fillStyle = tile.color;
    ctx.fillRect(
      tileX + groutGap,
      tileY + groutGap,
      Math.max(0, tileW - groutGap * 2),
      Math.max(0, tileH - groutGap * 2)
    );
  }
  
  return canvas;
}

// Get wall dimensions for tile calculation
export function getWallDimensions(
  wall: Wall,
  points: Point[]
): { length: number; height: number } {
  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  
  if (!start || !end) {
    return { length: 0, height: wall.height };
  }
  
  const length = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  return { length, height: wall.height };
}