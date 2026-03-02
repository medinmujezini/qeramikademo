// Advanced Tile Calculator with Cut Tile Identification and Pattern Support
// Supports curved walls, sloped walls, and advanced cut optimization

import type { Tile, Wall, Point, WallTileSection, CutTile, TileCalculation, TilePattern } from '@/types/floorPlan';
import { isWallCurved, isWallSloped, getWallSlopeAngle } from '@/types/floorPlan';
import { arcLength, calculateArcInfo } from './arcUtils';

export interface WallDimension {
  wallId: string;
  length: number; // cm (for curved walls: arc length)
  height: number; // cm
  area: number; // m²
  // Enhanced info for curved/sloped walls
  isCurved: boolean;
  curveRadius?: number;
  chordLength?: number; // Straight-line distance for curved walls
  isSlopedHeight: boolean;
  startHeight?: number;
  endHeight?: number;
  slopeAngle?: number;
  // Wastage factors
  curveWastageFactor: number; // 1.0 = no extra wastage
  slopeWastageFactor: number;
}

export function calculateWallDimensions(
  walls: Wall[],
  points: Point[]
): WallDimension[] {
  return walls.map(wall => {
    const start = points.find(p => p.id === wall.startPointId);
    const end = points.find(p => p.id === wall.endPointId);
    if (!start || !end) {
      return { 
        wallId: wall.id, 
        length: 0, 
        height: wall.height, 
        area: 0,
        isCurved: false,
        isSlopedHeight: false,
        curveWastageFactor: 1.0,
        slopeWastageFactor: 1.0
      };
    }
    
    const chordLength = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    const isCurved = isWallCurved(wall);
    const isSlopedHeight = isWallSloped(wall);
    
    // For curved walls, use arc length
    let length = chordLength;
    let curveRadius: number | undefined;
    let curveWastageFactor = 1.0;
    
    if (isCurved && wall.bulge) {
      length = arcLength(start, end, wall.bulge);
      const arcInfo = calculateArcInfo(start, end, wall.bulge);
      if (arcInfo) {
        curveRadius = arcInfo.radius;
        // Wastage increases with tighter curves (smaller radius)
        // Formula: 15% base + 10% for every 50cm reduction below 200cm radius
        if (curveRadius < 200) {
          curveWastageFactor = 1.15 + (200 - curveRadius) / 500;
        } else {
          curveWastageFactor = 1.10; // 10% extra for any curved wall
        }
      }
    }
    
    // For sloped walls, use average height for area calculation
    const startH = wall.startHeight ?? wall.height;
    const endH = wall.endHeight ?? wall.height;
    const avgHeight = (startH + endH) / 2;
    const slopeAngle = isSlopedHeight ? getWallSlopeAngle(wall, length) : 0;
    
    // Slope wastage factor based on angle
    let slopeWastageFactor = 1.0;
    if (isSlopedHeight) {
      // Angled cuts increase wastage: 5% per 5 degrees of slope
      slopeWastageFactor = 1.0 + (slopeAngle / 100);
    }
    
    const area = (length * avgHeight) / 10000; // Convert cm² to m²
    
    return { 
      wallId: wall.id, 
      length, 
      height: avgHeight, 
      area,
      isCurved,
      curveRadius,
      chordLength: isCurved ? chordLength : undefined,
      isSlopedHeight,
      startHeight: isSlopedHeight ? startH : undefined,
      endHeight: isSlopedHeight ? endH : undefined,
      slopeAngle: isSlopedHeight ? slopeAngle : undefined,
      curveWastageFactor,
      slopeWastageFactor
    };
  });
}

export interface TilePosition {
  x: number;
  y: number;
  isCut: boolean;
  cutWidth?: number;
  cutHeight?: number;
  rotation?: number; // For herringbone/diagonal patterns (degrees)
  cutAngle?: number; // For angled cuts on sloped walls (degrees)
  cutType?: 'none' | 'straight' | 'angled' | 'triangular';
  isCurvedWall?: boolean;
  isSlopedCut?: boolean;
  vertices?: { x: number; y: number }[]; // Polygon vertices for angled cuts
  // Builder-friendly edge measurements for angled cuts
  leftEdgeHeight?: number;  // Height of tile at left edge after cutting (cm)
  rightEdgeHeight?: number; // Height of tile at right edge after cutting (cm)
}

export interface TileLayoutResult {
  fullTiles: number;
  cutTiles: CutTile[];
  tilePositions: TilePosition[];
  // Additional info for curved/sloped walls
  curvedWallInfo?: {
    facetCount: number;
    recommendedTileSize: number;
    wastagePercent: number;
  };
  slopedWallInfo?: {
    slopeAngle: number;
    angledCutCount: number;
    trianglePieces: number;
    straightCutCount: number;
  };
}

// Main function that routes to pattern-specific implementations
// For sloped walls, pass startHeight and endHeight to enable angled cuts
export function calculateTileLayout(
  wallLength: number, // cm
  wallHeight: number, // cm (for non-sloped, or max height for sloped)
  tile: Tile,
  startX: number = 0, // Offset from wall start (cm)
  startY: number = 0, // Offset from floor (cm)
  jointWidth: number = 3, // Joint width in mm
  pattern: TilePattern = 'grid',
  slopeInfo?: { startHeight: number; endHeight: number } // Optional slope info
): TileLayoutResult {
  // Check if this is a sloped wall
  const isSloped = slopeInfo && Math.abs(slopeInfo.startHeight - slopeInfo.endHeight) > 0.5;
  
  if (isSloped && pattern === 'grid') {
    return calculateSlopedGridLayout(
      wallLength, 
      slopeInfo!.startHeight, 
      slopeInfo!.endHeight, 
      tile, 
      startX, 
      startY, 
      jointWidth
    );
  }
  
  switch (pattern) {
    case 'staggered':
      return calculateStaggeredLayout(wallLength, wallHeight, tile, startX, startY, jointWidth);
    case 'herringbone':
      return calculateHerringboneLayout(wallLength, wallHeight, tile, startX, startY, jointWidth);
    case 'diagonal':
      return calculateDiagonalLayout(wallLength, wallHeight, tile, startX, startY, jointWidth);
    case 'grid':
    default:
      return calculateGridLayout(wallLength, wallHeight, tile, startX, startY, jointWidth);
  }
}

// Sloped wall tile layout - calculates angled cuts where tiles intersect the slope line
function calculateSlopedGridLayout(
  wallLength: number,
  startHeight: number,
  endHeight: number,
  tile: Tile,
  startX: number,
  startY: number,
  jointWidth: number
): TileLayoutResult {
  const tilePositions: TilePosition[] = [];
  const cutTilesMap: Map<string, CutTile> = new Map();
  let fullTiles = 0;
  let angledCutCount = 0;
  let straightCutCount = 0;
  let trianglePieces = 0;
  
  const tileWidth = tile.width;
  const tileHeight = tile.height;
  const jointCm = jointWidth / 10;
  const tilePitchX = tileWidth + jointCm;
  const tilePitchY = tileHeight + jointCm;
  
  // Slope line: height at any x = startHeight + (endHeight - startHeight) * (x / wallLength)
  const heightAtX = (x: number): number => {
    return startHeight + (endHeight - startHeight) * (x / wallLength);
  };
  
  const maxHeight = Math.max(startHeight, endHeight);
  const minHeight = Math.min(startHeight, endHeight);
  const slopeAngle = Math.atan2(Math.abs(endHeight - startHeight), wallLength) * (180 / Math.PI);
  
  // Calculate grid coverage
  const tilesHorizontal = Math.ceil((wallLength + jointCm) / tilePitchX);
  const tilesVertical = Math.ceil((maxHeight + jointCm) / tilePitchY);
  
  for (let row = 0; row < tilesVertical; row++) {
    const tileBottom = startY + row * tilePitchY;
    const tileTop = tileBottom + tileHeight;
    
    for (let col = 0; col < tilesHorizontal; col++) {
      const tileLeft = startX + col * tilePitchX;
      const tileRight = tileLeft + tileWidth;
      
      // Skip if completely outside wall width
      if (tileLeft >= wallLength) continue;
      
      // Get slope heights at tile edges
      const slopeAtLeft = heightAtX(Math.max(0, tileLeft));
      const slopeAtRight = heightAtX(Math.min(wallLength, tileRight));
      const minSlopeInTile = Math.min(slopeAtLeft, slopeAtRight);
      const maxSlopeInTile = Math.max(slopeAtLeft, slopeAtRight);
      
      // Check tile position relative to slope
      const tileCompletelyBelowSlope = tileTop <= minSlopeInTile;
      const tileCompletelyAboveSlope = tileBottom >= maxSlopeInTile;
      const tileIntersectsSlope = !tileCompletelyBelowSlope && !tileCompletelyAboveSlope;
      
      // Skip tiles completely above the slope
      if (tileCompletelyAboveSlope) continue;
      
      // Calculate actual tile bounds (clipped to wall dimensions)
      const actualLeft = Math.max(0, tileLeft);
      const actualRight = Math.min(wallLength, tileRight);
      const actualWidth = actualRight - actualLeft;
      
      // Skip if no visible width
      if (actualWidth <= 0.1) continue;
      
      // Width cut from wall edges
      const isWidthCut = actualWidth < tileWidth - 0.01;
      
      if (tileCompletelyBelowSlope) {
        // Full tile (may still be cut on edges)
        const isHeightCut = tileTop > minHeight && (maxHeight - tileTop) < tileHeight;
        const actualHeight = Math.min(tileHeight, maxHeight - tileBottom);
        const isCut = isWidthCut || isHeightCut || actualHeight < tileHeight - 0.01;
        
        if (isCut && actualHeight > 0.1) {
          const cutKey = `${actualWidth.toFixed(1)}x${actualHeight.toFixed(1)}`;
          const existing = cutTilesMap.get(cutKey);
          if (existing) {
            existing.count++;
          } else {
            cutTilesMap.set(cutKey, {
              originalTileId: tile.id,
              cutWidth: actualWidth,
              cutHeight: actualHeight,
              count: 1,
              cutType: 'straight'
            });
          }
          straightCutCount++;
          
          tilePositions.push({
            x: actualLeft,
            y: tileBottom,
            isCut: true,
            cutWidth: actualWidth,
            cutHeight: actualHeight,
            cutType: 'straight',
            isSlopedCut: false
          });
        } else if (actualHeight > 0.1) {
          fullTiles++;
          tilePositions.push({ 
            x: actualLeft, 
            y: tileBottom, 
            isCut: false,
            cutType: 'none'
          });
        }
      } else if (tileIntersectsSlope) {
        // Tile intersects the slope line - calculate angled cut
        const intersections: { x: number; y: number }[] = [];
        
        // Check left edge intersection
        if (tileBottom < slopeAtLeft && slopeAtLeft < tileTop) {
          intersections.push({ x: actualLeft, y: slopeAtLeft });
        }
        
        // Check right edge intersection  
        const slopeAtActualRight = heightAtX(actualRight);
        if (tileBottom < slopeAtActualRight && slopeAtActualRight < tileTop) {
          intersections.push({ x: actualRight, y: slopeAtActualRight });
        }
        
        // Check top edge intersection
        if (slopeAtLeft >= tileTop || slopeAtActualRight >= tileTop) {
          // Find x where slope = tileTop
          const xAtTileTop = (tileTop - startHeight) / ((endHeight - startHeight) / wallLength);
          if (xAtTileTop > actualLeft && xAtTileTop < actualRight) {
            intersections.push({ x: xAtTileTop, y: tileTop });
          }
        }
        
        // Check bottom edge intersection
        if (slopeAtLeft <= tileBottom || slopeAtActualRight <= tileBottom) {
          const xAtTileBottom = (tileBottom - startHeight) / ((endHeight - startHeight) / wallLength);
          if (xAtTileBottom > actualLeft && xAtTileBottom < actualRight) {
            intersections.push({ x: xAtTileBottom, y: tileBottom });
          }
        }
        
        // Build the visible polygon vertices (below the slope)
        const vertices: { x: number; y: number }[] = [];
        
        // Bottom-left corner (always included if below slope)
        if (tileBottom < slopeAtLeft) {
          vertices.push({ x: actualLeft, y: tileBottom });
        }
        
        // Bottom-right corner
        if (tileBottom < slopeAtActualRight) {
          vertices.push({ x: actualRight, y: tileBottom });
        }
        
        // Right edge intersection or right slope point
        if (slopeAtActualRight >= tileBottom && slopeAtActualRight <= tileTop) {
          vertices.push({ x: actualRight, y: slopeAtActualRight });
        } else if (slopeAtActualRight > tileTop) {
          vertices.push({ x: actualRight, y: tileTop });
        }
        
        // Left edge intersection or left slope point  
        if (slopeAtLeft >= tileBottom && slopeAtLeft <= tileTop) {
          vertices.push({ x: actualLeft, y: slopeAtLeft });
        } else if (slopeAtLeft > tileTop) {
          vertices.push({ x: actualLeft, y: tileTop });
        }
        
        // Calculate approximate cut dimensions
        const minY = Math.min(...vertices.map(v => v.y));
        const maxY = Math.max(...vertices.map(v => v.y));
        const cutHeight = maxY - minY;
        
        // Determine cut type based on shape
        const isTriangle = vertices.length === 3;
        const hasAngledEdge = intersections.length >= 2;
        const cutType = isTriangle ? 'triangular' : (hasAngledEdge ? 'angled' : 'straight');
        
        // Calculate builder-friendly left and right edge heights
        // These are the visible heights at each edge of the cut tile
        let leftEdgeHeight = 0;
        let rightEdgeHeight = 0;
        
        // Find the actual height at left edge (from bottom to where slope cuts it)
        const leftEdgeBottom = tileBottom;
        const leftEdgeTop = Math.min(slopeAtLeft, tileTop);
        leftEdgeHeight = Math.max(0, leftEdgeTop - leftEdgeBottom);
        
        // Find the actual height at right edge
        const rightEdgeBottom = tileBottom;
        const rightEdgeTop = Math.min(slopeAtActualRight, tileTop);
        rightEdgeHeight = Math.max(0, rightEdgeTop - rightEdgeBottom);
        
        if (cutHeight > 0.1 && actualWidth > 0.1) {
          // Calculate the cut angle (angle of the slope line)
          const cutAngle = slopeAngle;
          
          const cutKey = `${actualWidth.toFixed(1)}x${cutHeight.toFixed(1)}@${cutAngle.toFixed(0)}`;
          const existing = cutTilesMap.get(cutKey);
          if (existing) {
            existing.count++;
          } else {
            cutTilesMap.set(cutKey, {
              originalTileId: tile.id,
              cutWidth: actualWidth,
              cutHeight: cutHeight,
              count: 1,
              cutAngle,
              cutType: cutType as 'straight' | 'angled' | 'triangular',
              vertices: vertices.map(v => ({ x: v.x - actualLeft, y: v.y - tileBottom })),
              leftEdgeHeight,
              rightEdgeHeight
            });
          }
          
          if (isTriangle) trianglePieces++;
          else angledCutCount++;
          
          tilePositions.push({
            x: actualLeft,
            y: tileBottom,
            isCut: true,
            cutWidth: actualWidth,
            cutHeight: cutHeight,
            cutAngle,
            cutType,
            isSlopedCut: true,
            vertices: vertices.map(v => ({ x: v.x - actualLeft, y: v.y - tileBottom })),
            leftEdgeHeight,
            rightEdgeHeight
          });
        }
      }
    }
  }
  
  return {
    fullTiles,
    cutTiles: Array.from(cutTilesMap.values()),
    tilePositions,
    slopedWallInfo: {
      slopeAngle,
      angledCutCount,
      trianglePieces,
      straightCutCount
    }
  };
}

// Grid pattern (original implementation)
function calculateGridLayout(
  wallLength: number,
  wallHeight: number,
  tile: Tile,
  startX: number,
  startY: number,
  jointWidth: number
): TileLayoutResult {
  const tilePositions: TilePosition[] = [];
  const cutTilesMap: Map<string, CutTile> = new Map();
  let fullTiles = 0;
  
  const tileWidth = tile.width;
  const tileHeight = tile.height;
  
  // Convert joint width from mm to cm
  const jointCm = jointWidth / 10;
  
  // Calculate tile pitch (tile + joint)
  const tilePitchX = tileWidth + jointCm;
  const tilePitchY = tileHeight + jointCm;
  
  // Calculate number of tiles needed (accounting for joints)
  const tilesHorizontal = Math.ceil((wallLength + jointCm) / tilePitchX);
  const tilesVertical = Math.ceil((wallHeight + jointCm) / tilePitchY);
  
  for (let row = 0; row < tilesVertical; row++) {
    const y = startY + row * tilePitchY;
    const remainingHeight = wallHeight - y;
    
    if (remainingHeight <= 0) continue;
    
    const actualTileHeight = Math.min(tileHeight, remainingHeight);
    const isHeightCut = actualTileHeight < tileHeight - 0.01;
    
    for (let col = 0; col < tilesHorizontal; col++) {
      const x = startX + col * tilePitchX;
      const remainingWidth = wallLength - x;
      
      if (remainingWidth <= 0) continue;
      
      const actualTileWidth = Math.min(tileWidth, remainingWidth);
      const isWidthCut = actualTileWidth < tileWidth - 0.01;
      
      const isCut = isWidthCut || isHeightCut;
      
      if (isCut) {
        const cutKey = `${actualTileWidth.toFixed(1)}x${actualTileHeight.toFixed(1)}`;
        const existing = cutTilesMap.get(cutKey);
        if (existing) {
          existing.count++;
        } else {
          cutTilesMap.set(cutKey, {
            originalTileId: tile.id,
            cutWidth: actualTileWidth,
            cutHeight: actualTileHeight,
            count: 1
          });
        }
        
        tilePositions.push({
          x, y, isCut,
          cutWidth: actualTileWidth,
          cutHeight: actualTileHeight
        });
      } else {
        fullTiles++;
        tilePositions.push({ x, y, isCut: false });
      }
    }
  }
  
  return {
    fullTiles,
    cutTiles: Array.from(cutTilesMap.values()),
    tilePositions
  };
}

// Staggered/Brick pattern - alternating rows offset by 50%
function calculateStaggeredLayout(
  wallLength: number,
  wallHeight: number,
  tile: Tile,
  startX: number,
  startY: number,
  jointWidth: number
): TileLayoutResult {
  const tilePositions: TilePosition[] = [];
  const cutTilesMap: Map<string, CutTile> = new Map();
  let fullTiles = 0;
  
  const tileWidth = tile.width;
  const tileHeight = tile.height;
  const jointCm = jointWidth / 10;
  const tilePitchX = tileWidth + jointCm;
  const tilePitchY = tileHeight + jointCm;
  
  const tilesVertical = Math.ceil((wallHeight + jointCm) / tilePitchY);
  
  for (let row = 0; row < tilesVertical; row++) {
    const y = startY + row * tilePitchY;
    const remainingHeight = wallHeight - y;
    
    if (remainingHeight <= 0) continue;
    
    const actualTileHeight = Math.min(tileHeight, remainingHeight);
    const isHeightCut = actualTileHeight < tileHeight - 0.01;
    
    // Offset every other row by 50%
    const rowOffset = (row % 2 === 1) ? tilePitchX / 2 : 0;
    
    // Calculate tiles needed for this row (may need extra tile due to offset)
    const effectiveStartX = startX - rowOffset;
    const tilesHorizontal = Math.ceil((wallLength + jointCm + rowOffset) / tilePitchX) + 1;
    
    for (let col = 0; col < tilesHorizontal; col++) {
      let x = effectiveStartX + col * tilePitchX;
      
      // Calculate visible portion of this tile
      const tileLeft = Math.max(0, x);
      const tileRight = Math.min(wallLength, x + tileWidth);
      
      if (tileRight <= 0 || tileLeft >= wallLength) continue;
      
      const visibleWidth = tileRight - tileLeft;
      const isCutLeft = x < 0;
      const isCutRight = x + tileWidth > wallLength;
      const isWidthCut = isCutLeft || isCutRight || visibleWidth < tileWidth - 0.01;
      
      const isCut = isWidthCut || isHeightCut;
      const actualX = Math.max(0, x);
      const actualWidth = visibleWidth;
      
      if (isCut) {
        const cutKey = `${actualWidth.toFixed(1)}x${actualTileHeight.toFixed(1)}`;
        const existing = cutTilesMap.get(cutKey);
        if (existing) {
          existing.count++;
        } else {
          cutTilesMap.set(cutKey, {
            originalTileId: tile.id,
            cutWidth: actualWidth,
            cutHeight: actualTileHeight,
            count: 1
          });
        }
        
        tilePositions.push({
          x: actualX, y, isCut,
          cutWidth: actualWidth,
          cutHeight: actualTileHeight
        });
      } else {
        fullTiles++;
        tilePositions.push({ x: actualX, y, isCut: false });
      }
    }
  }
  
  return {
    fullTiles,
    cutTiles: Array.from(cutTilesMap.values()),
    tilePositions
  };
}

// Herringbone pattern - classic V-shaped interlocking pattern
function calculateHerringboneLayout(
  wallLength: number,
  wallHeight: number,
  tile: Tile,
  startX: number,
  startY: number,
  jointWidth: number
): TileLayoutResult {
  const tilePositions: TilePosition[] = [];
  const cutTilesMap: Map<string, CutTile> = new Map();
  let fullTiles = 0;
  
  // For herringbone, we use the tile's dimensions
  const longSide = Math.max(tile.width, tile.height);
  const shortSide = Math.min(tile.width, tile.height);
  const jointCm = jointWidth / 10;
  
  // Herringbone unit - one horizontal + one vertical tile forms a step
  // The pattern steps diagonally creating V shapes
  const stepWidth = longSide + jointCm;
  const stepHeight = shortSide + jointCm;
  
  // Calculate coverage needed
  const stepsX = Math.ceil((wallLength + longSide) / shortSide) + 2;
  const stepsY = Math.ceil((wallHeight + longSide) / shortSide) + 2;
  
  for (let row = -2; row < stepsY; row++) {
    for (let col = -2; col < stepsX; col++) {
      // Diagonal offset creates the herringbone pattern
      const diagOffset = (row % 2 === 0) ? 0 : longSide + jointCm;
      
      // First tile in pair - horizontal orientation (width = longSide, height = shortSide)
      const tile1X = startX + col * (longSide + shortSide + jointCm * 2) + diagOffset;
      const tile1Y = startY + row * stepHeight;
      const tile1W = longSide;
      const tile1H = shortSide;
      
      // Second tile in pair - vertical orientation (width = shortSide, height = longSide)
      const tile2X = tile1X + longSide + jointCm;
      const tile2Y = tile1Y - (longSide - shortSide);
      const tile2W = shortSide;
      const tile2H = longSide;
      
      // Process first tile (horizontal)
      if (tile1X < wallLength && tile1X + tile1W > 0 && tile1Y < wallHeight && tile1Y + tile1H > 0) {
        const clipX = Math.max(0, tile1X);
        const clipY = Math.max(0, tile1Y);
        const clipRight = Math.min(wallLength, tile1X + tile1W);
        const clipBottom = Math.min(wallHeight, tile1Y + tile1H);
        const clipW = clipRight - clipX;
        const clipH = clipBottom - clipY;
        
        if (clipW > 0.5 && clipH > 0.5) {
          const isCut = clipW < tile1W - 0.5 || clipH < tile1H - 0.5 || tile1X < 0 || tile1Y < 0;
          
          if (isCut) {
            const cutKey = `${clipW.toFixed(1)}x${clipH.toFixed(1)}`;
            const existing = cutTilesMap.get(cutKey);
            if (existing) existing.count++;
            else cutTilesMap.set(cutKey, { originalTileId: tile.id, cutWidth: clipW, cutHeight: clipH, count: 1 });
            tilePositions.push({ x: clipX, y: clipY, isCut: true, cutWidth: clipW, cutHeight: clipH, rotation: 0 });
          } else {
            fullTiles++;
            tilePositions.push({ x: clipX, y: clipY, isCut: false, cutWidth: tile1W, cutHeight: tile1H, rotation: 0 });
          }
        }
      }
      
      // Process second tile (vertical)
      if (tile2X < wallLength && tile2X + tile2W > 0 && tile2Y < wallHeight && tile2Y + tile2H > 0) {
        const clipX = Math.max(0, tile2X);
        const clipY = Math.max(0, tile2Y);
        const clipRight = Math.min(wallLength, tile2X + tile2W);
        const clipBottom = Math.min(wallHeight, tile2Y + tile2H);
        const clipW = clipRight - clipX;
        const clipH = clipBottom - clipY;
        
        if (clipW > 0.5 && clipH > 0.5) {
          const isCut = clipW < tile2W - 0.5 || clipH < tile2H - 0.5 || tile2X < 0 || tile2Y < 0;
          
          if (isCut) {
            const cutKey = `${clipW.toFixed(1)}x${clipH.toFixed(1)}`;
            const existing = cutTilesMap.get(cutKey);
            if (existing) existing.count++;
            else cutTilesMap.set(cutKey, { originalTileId: tile.id, cutWidth: clipW, cutHeight: clipH, count: 1 });
            tilePositions.push({ x: clipX, y: clipY, isCut: true, cutWidth: clipW, cutHeight: clipH, rotation: 90 });
          } else {
            fullTiles++;
            tilePositions.push({ x: clipX, y: clipY, isCut: false, cutWidth: tile2W, cutHeight: tile2H, rotation: 90 });
          }
        }
      }
    }
  }
  
  return {
    fullTiles,
    cutTiles: Array.from(cutTilesMap.values()),
    tilePositions
  };
}

// Diagonal pattern - tiles arranged in a diamond/diagonal grid (45° rotated pattern)
function calculateDiagonalLayout(
  wallLength: number,
  wallHeight: number,
  tile: Tile,
  startX: number,
  startY: number,
  jointWidth: number
): TileLayoutResult {
  const tilePositions: TilePosition[] = [];
  const cutTilesMap: Map<string, CutTile> = new Map();
  let fullTiles = 0;
  
  const tileWidth = tile.width;
  const tileHeight = tile.height;
  const jointCm = jointWidth / 10;
  
  // For diagonal layout, we calculate the effective diagonal span
  // A tile at 45° has its corners along horizontal/vertical axes
  const diagWidth = (tileWidth + tileHeight) / Math.SQRT2;
  const diagHeight = (tileWidth + tileHeight) / Math.SQRT2;
  
  // Pitch between tile centers (accounting for joints)
  const pitchX = (tileWidth / Math.SQRT2) + jointCm;
  const pitchY = (tileHeight / Math.SQRT2) + jointCm;
  
  // Extended grid coverage for edge tiles
  const tilesX = Math.ceil((wallLength + diagWidth) / pitchX) + 2;
  const tilesY = Math.ceil((wallHeight + diagHeight) / pitchY) + 2;
  
  for (let row = -2; row < tilesY; row++) {
    for (let col = -2; col < tilesX; col++) {
      // Offset every other row for diamond pattern
      const rowOffset = (row % 2 === 0) ? 0 : pitchX / 2;
      
      // Position is at the center of the diamond, then we calculate bounds
      const centerX = startX + col * pitchX + rowOffset;
      const centerY = startY + row * pitchY;
      
      // The diamond occupies from center ± half diagonal
      const halfDiagW = tileWidth / Math.SQRT2 / 2;
      const halfDiagH = tileHeight / Math.SQRT2 / 2;
      
      const left = centerX - halfDiagW;
      const right = centerX + halfDiagW;
      const top = centerY - halfDiagH;
      const bottom = centerY + halfDiagH;
      
      // Skip if completely outside
      if (right < 0 || left > wallLength || bottom < 0 || top > wallHeight) continue;
      
      // Calculate visible bounds for the rotated tile
      const visLeft = Math.max(0, left);
      const visRight = Math.min(wallLength, right);
      const visTop = Math.max(0, top);
      const visBottom = Math.min(wallHeight, bottom);
      
      const visWidth = visRight - visLeft;
      const visHeight = visBottom - visTop;
      
      if (visWidth <= 0.5 || visHeight <= 0.5) continue;
      
      // Check if it's cut (any edge is clipped)
      const isCut = left < 0 || right > wallLength || top < 0 || bottom > wallHeight;
      
      // For diagonal tiles, we store the position and actual tile dimensions
      // The rendering will handle the rotation
      if (isCut) {
        // Store the clipped dimensions (this is an approximation for rotated tiles)
        const cutW = Math.min(tileWidth, visWidth * Math.SQRT2);
        const cutH = Math.min(tileHeight, visHeight * Math.SQRT2);
        const cutKey = `${cutW.toFixed(1)}x${cutH.toFixed(1)}`;
        const existing = cutTilesMap.get(cutKey);
        if (existing) existing.count++;
        else cutTilesMap.set(cutKey, { originalTileId: tile.id, cutWidth: cutW, cutHeight: cutH, count: 1 });
        tilePositions.push({ 
          x: centerX, 
          y: centerY, 
          isCut: true, 
          cutWidth: cutW, 
          cutHeight: cutH, 
          rotation: 45 
        });
      } else {
        fullTiles++;
        tilePositions.push({ 
          x: centerX, 
          y: centerY, 
          isCut: false, 
          cutWidth: tileWidth, 
          cutHeight: tileHeight, 
          rotation: 45 
        });
      }
    }
  }
  
  return {
    fullTiles,
    cutTiles: Array.from(cutTilesMap.values()),
    tilePositions
  };
}

export function calculateMaterials(
  totalArea: number, // m²
  totalPerimeter: number, // m (for silicone)
  tile: Tile,
  jointWidth: number = 3 // mm
): {
  groutKg: number;
  adhesiveKg: number;
  siliconeMl: number;
} {
  // Grout calculation based on tile dimensions and joint width
  const L = tile.width / 10;
  const W = tile.height / 10;
  const tileThickness = 0.8;
  const groutDensity = 1.6;
  const groutPerSqm = ((L + W) * tileThickness * (jointWidth / 10) * groutDensity) / (L * W);
  const groutKg = totalArea * groutPerSqm * 1.1;
  
  // Adhesive calculation based on tile size
  const tileArea = (tile.width * tile.height) / 10000;
  let adhesivePerSqm = 3;
  if (tileArea > 0.16) adhesivePerSqm = 4;
  if (tileArea > 0.36) adhesivePerSqm = 5;
  const adhesiveKg = totalArea * adhesivePerSqm * 1.1;
  
  // Silicone for corners and edges
  const siliconeMl = totalPerimeter * 50;
  
  return { groutKg, adhesiveKg, siliconeMl };
}

export function calculateFullTileEstimate(
  walls: Wall[],
  points: Point[],
  tile: Tile,
  wasteFactor: number = 1.1,
  jointWidth: number = 3
): TileCalculation {
  const dimensions = calculateWallDimensions(walls, points);
  let totalFullTiles = 0;
  let allCutTiles: CutTile[] = [];
  
  for (const dim of dimensions) {
    const layout = calculateTileLayout(dim.length, dim.height, tile, 0, 0, jointWidth, 'grid');
    totalFullTiles += layout.fullTiles;
    allCutTiles = [...allCutTiles, ...layout.cutTiles];
  }
  
  // Merge cut tiles with same dimensions
  const cutTilesMap: Map<string, CutTile> = new Map();
  for (const cut of allCutTiles) {
    const key = `${cut.cutWidth.toFixed(1)}x${cut.cutHeight.toFixed(1)}`;
    const existing = cutTilesMap.get(key);
    if (existing) {
      existing.count += cut.count;
    } else {
      cutTilesMap.set(key, { ...cut });
    }
  }
  
  const totalArea = dimensions.reduce((sum, d) => sum + d.area, 0);
  const totalPerimeter = dimensions.reduce((sum, d) => sum + (d.length * 2 + d.height * 2) / 100, 0);
  const materials = calculateMaterials(totalArea, totalPerimeter, tile);
  
  const cutTilesArray = Array.from(cutTilesMap.values());
  const totalCutCount = cutTilesArray.reduce((sum, c) => sum + c.count, 0);
  
  return {
    totalTiles: Math.ceil((totalFullTiles + totalCutCount) * wasteFactor),
    fullTiles: totalFullTiles,
    cutTiles: cutTilesArray,
    groutAmount: materials.groutKg,
    adhesiveAmount: materials.adhesiveKg,
    siliconeAmount: materials.siliconeMl
  };
}

// ==================== Wall Section Calculations ====================

export interface WallCalculationResult {
  wallId: string;
  fullTiles: number;
  cutTiles: CutTile[];
  totalTileCount: number;
  area: number;
  sections: {
    tileId: string;
    tileName: string;
    fullTiles: number;
    cutCount: number;
    area: number;
  }[];
  materials: {
    groutKg: number;
    adhesiveKg: number;
    siliconeMl: number;
  };
  estimatedCost: number;
}

export function calculateWallFromSections(
  wall: Wall,
  points: Point[],
  sections: WallTileSection[],
  tiles: Tile[],
  defaultJointWidth: number = 3
): WallCalculationResult | null {
  if (!sections || sections.length === 0) return null;

  const start = points.find(p => p.id === wall.startPointId);
  const end = points.find(p => p.id === wall.endPointId);
  if (!start || !end) return null;

  const wallLength = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  const wallHeight = wall.height;
  const wallArea = (wallLength * wallHeight) / 10000;

  let totalFullTiles = 0;
  const allCutTiles: CutTile[] = [];
  const sectionResults: WallCalculationResult['sections'] = [];
  let totalCost = 0;

  for (const section of sections) {
    const tile = tiles.find(t => t.id === section.tileId);
    if (!tile) continue;

    // startHeight and endHeight are in cm, NOT percentages
    // startPosition and endPosition are normalized 0-1 along wall length
    const sectionWidth = (section.endPosition - section.startPosition) * wallLength;
    const sectionHeight = section.endHeight - section.startHeight;

    if (sectionHeight <= 0 || sectionWidth <= 0) continue;

    // Get tile dimensions based on orientation
    const tileW = section.orientation === 'horizontal' ? tile.width : tile.height;
    const tileH = section.orientation === 'horizontal' ? tile.height : tile.width;

    const layout = calculateTileLayout(
      sectionWidth,
      sectionHeight,
      { ...tile, width: tileW, height: tileH },
      section.offsetX || 0,
      section.offsetY || 0,
      defaultJointWidth,
      section.pattern || 'grid'
    );

    totalFullTiles += layout.fullTiles;
    allCutTiles.push(...layout.cutTiles);

    const cutCount = layout.cutTiles.reduce((sum, c) => sum + c.count, 0);
    const sectionArea = (sectionWidth * sectionHeight) / 10000;
    const sectionTileCount = layout.fullTiles + cutCount;

    sectionResults.push({
      tileId: tile.id,
      tileName: tile.name,
      fullTiles: layout.fullTiles,
      cutCount,
      area: sectionArea
    });

    totalCost += sectionTileCount * tile.pricePerUnit;
  }

  // Merge cut tiles with same dimensions
  const cutTilesMap: Map<string, CutTile> = new Map();
  for (const cut of allCutTiles) {
    const key = `${cut.cutWidth.toFixed(1)}x${cut.cutHeight.toFixed(1)}`;
    const existing = cutTilesMap.get(key);
    if (existing) {
      existing.count += cut.count;
    } else {
      cutTilesMap.set(key, { ...cut });
    }
  }

  const cutTilesArray = Array.from(cutTilesMap.values());
  const totalCutCount = cutTilesArray.reduce((sum, c) => sum + c.count, 0);

  // Calculate materials using weighted average of tiles
  let totalMaterialArea = 0;
  let totalGrout = 0;
  let totalAdhesive = 0;
  let totalSilicone = 0;

  for (const section of sections) {
    const tile = tiles.find(t => t.id === section.tileId);
    if (!tile) continue;
    
    const sectionWidth = (section.endPosition - section.startPosition) * wallLength;
    const sectionHeight = section.endHeight - section.startHeight;
    const sectionArea = (sectionWidth * sectionHeight) / 10000;
    const sectionPerimeter = (sectionWidth * 2 + sectionHeight * 2) / 100;
    
    const mats = calculateMaterials(sectionArea, sectionPerimeter, tile, defaultJointWidth);
    totalGrout += mats.groutKg;
    totalAdhesive += mats.adhesiveKg;
    totalSilicone += mats.siliconeMl;
    totalMaterialArea += sectionArea;
  }

  return {
    wallId: wall.id,
    fullTiles: totalFullTiles,
    cutTiles: cutTilesArray,
    totalTileCount: totalFullTiles + totalCutCount,
    area: wallArea,
    sections: sectionResults,
    materials: {
      groutKg: totalGrout,
      adhesiveKg: totalAdhesive,
      siliconeMl: totalSilicone
    },
    estimatedCost: totalCost
  };
}

// ==================== Project Calculations ====================

export interface ProjectCalculationResult {
  walls: WallCalculationResult[];
  totals: {
    fullTiles: number;
    cutTiles: number;
    totalTiles: number;
    area: number;
    estimatedCost: number;
    groutKg: number;
    adhesiveKg: number;
    siliconeMl: number;
  };
  tilesBreakdown: {
    tileId: string;
    tileName: string;
    count: number;
    cost: number;
  }[];
  optimization?: CutOptimizationResult;
}

export function calculateProjectFromSections(
  walls: Wall[],
  points: Point[],
  sections: WallTileSection[],
  tiles: Tile[]
): ProjectCalculationResult {
  const wallResults: WallCalculationResult[] = [];
  const tileCountMap: Map<string, { name: string; count: number; cost: number }> = new Map();

  for (const wall of walls) {
    const wallSections = sections.filter(s => s.wallId === wall.id);
    const result = calculateWallFromSections(wall, points, wallSections, tiles);
    if (result) {
      wallResults.push(result);

      for (const section of result.sections) {
        const tile = tiles.find(t => t.id === section.tileId);
        if (tile) {
          const existing = tileCountMap.get(section.tileId);
          const count = section.fullTiles + section.cutCount;
          if (existing) {
            existing.count += count;
            existing.cost += count * tile.pricePerUnit;
          } else {
            tileCountMap.set(section.tileId, {
              name: section.tileName,
              count,
              cost: count * tile.pricePerUnit
            });
          }
        }
      }
    }
  }

  const totals = wallResults.reduce(
    (acc, w) => ({
      fullTiles: acc.fullTiles + w.fullTiles,
      cutTiles: acc.cutTiles + w.cutTiles.reduce((sum, c) => sum + c.count, 0),
      totalTiles: acc.totalTiles + w.totalTileCount,
      area: acc.area + w.area,
      estimatedCost: acc.estimatedCost + w.estimatedCost,
      groutKg: acc.groutKg + w.materials.groutKg,
      adhesiveKg: acc.adhesiveKg + w.materials.adhesiveKg,
      siliconeMl: acc.siliconeMl + w.materials.siliconeMl
    }),
    {
      fullTiles: 0,
      cutTiles: 0,
      totalTiles: 0,
      area: 0,
      estimatedCost: 0,
      groutKg: 0,
      adhesiveKg: 0,
      siliconeMl: 0
    }
  );

  const tilesBreakdown = Array.from(tileCountMap.entries()).map(([tileId, data]) => ({
    tileId,
    tileName: data.name,
    count: data.count,
    cost: data.cost
  }));

  // Run cut optimization
  const optimization = optimizeCutTileReuse(wallResults, tiles);

  return {
    walls: wallResults,
    totals,
    tilesBreakdown,
    optimization
  };
}

// ==================== Smart Cut Tile Reuse System ====================

interface CutPiece {
  tileId: string;
  tileName: string;
  width: number;
  height: number;
  sourceWallId: string;
  sourceDescription: string;
}

interface CutRequirement {
  tileId: string;
  width: number;
  height: number;
  wallId: string;
  index: number;
}

export interface CutOptimizationResult {
  // Standard calculation: each cut = 1 tile purchased
  standardTilesNeeded: number;
  standardCost: number;
  
  // Optimized calculation: reuse leftover pieces
  optimizedTilesNeeded: number;
  optimizedCost: number;
  
  // Savings
  tilesSaved: number;
  costSaved: number;
  
  // Old API compatibility
  tilesNeeded: number;
  tilesWithoutOptimization: number;
  
  // Details
  reusedPieces: {
    leftoverPiece: CutPiece;
    usedForCut: { width: number; height: number; wallId: string; wallDescription?: string };
    isCrossWall?: boolean;
  }[];
  wastePieces: CutPiece[];
  
  // Per-tile breakdown for display
  byTileType: {
    tileId: string;
    tileName: string;
    tilePrice: number;
    standardCount: number;
    optimizedCount: number;
    saved: number;
  }[];
}

export function optimizeCutTileReuse(
  wallResults: WallCalculationResult[],
  tiles: Tile[]
): CutOptimizationResult {
  // Collect all cut requirements grouped by tile type
  const cutsByTile: Map<string, { requirements: CutRequirement[]; tile: Tile }> = new Map();
  
  let globalIdx = 0;
  for (const wallResult of wallResults) {
    for (const cutTile of wallResult.cutTiles) {
      const tile = tiles.find(t => t.id === cutTile.originalTileId);
      if (!tile) continue;
      
      const existing = cutsByTile.get(tile.id) || { requirements: [], tile };
      
      for (let i = 0; i < cutTile.count; i++) {
        existing.requirements.push({
          tileId: tile.id,
          width: cutTile.cutWidth,
          height: cutTile.cutHeight,
          wallId: wallResult.wallId,
          index: globalIdx++
        });
      }
      
      cutsByTile.set(tile.id, existing);
    }
  }
  
  const reusedPieces: CutOptimizationResult['reusedPieces'] = [];
  const wastePieces: CutPiece[] = [];
  const byTileType: CutOptimizationResult['byTileType'] = [];
  
  let totalStandardTiles = 0;
  let totalStandardCost = 0;
  let totalOptimizedTiles = 0;
  let totalOptimizedCost = 0;
  
  // Process each tile type
  for (const [tileId, { requirements, tile }] of cutsByTile) {
    const standardCount = requirements.length;
    totalStandardTiles += standardCount;
    totalStandardCost += standardCount * tile.pricePerUnit;
    
    // Optimization: try to fit multiple cuts from the same tile
    // Key insight: when you make a cut, the leftover piece might satisfy another cut requirement
    
    // Track which requirements are satisfied
    const satisfiedRequirements = new Set<number>();
    
    // First pass: identify all possible leftover pieces from each cut
    interface TileCutPlan {
      primaryCutIdx: number;
      primaryCut: CutRequirement;
      leftoverWidth: number;
      leftoverHeight: number;
      secondaryCutIdx?: number;
      secondaryCut?: CutRequirement;
    }
    
    const cutPlans: TileCutPlan[] = [];
    
    // Sort requirements by area (largest first) - we want to prioritize fitting smaller cuts into leftovers
    const sortedReqs = [...requirements].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    for (const req of sortedReqs) {
      if (satisfiedRequirements.has(req.index)) continue;
      
      // Calculate leftover from this cut
      const leftoverWidth = tile.width - req.width;
      const leftoverHeight = tile.height - req.height;
      
      // Try to find another cut that fits in the leftover
      let bestSecondary: CutRequirement | null = null;
      let bestFitScore = 0;
      
      for (const potentialSecondary of sortedReqs) {
        if (potentialSecondary.index === req.index) continue;
        if (satisfiedRequirements.has(potentialSecondary.index)) continue;
        
        // Check if this cut can fit in leftover
        // Option 1: Cut horizontally (leftover is on the right side)
        const fitsHorizontally = leftoverWidth >= potentialSecondary.width - 0.5 && 
                                  req.height >= potentialSecondary.height - 0.5;
        
        // Option 2: Cut vertically (leftover is on top/bottom)
        const fitsVertically = req.width >= potentialSecondary.width - 0.5 && 
                               leftoverHeight >= potentialSecondary.height - 0.5;
        
        // Option 3: Rotated fits
        const fitsHorizontallyRotated = leftoverWidth >= potentialSecondary.height - 0.5 && 
                                         req.height >= potentialSecondary.width - 0.5;
        const fitsVerticallyRotated = req.width >= potentialSecondary.height - 0.5 && 
                                       leftoverHeight >= potentialSecondary.width - 0.5;
        
        if (fitsHorizontally || fitsVertically || fitsHorizontallyRotated || fitsVerticallyRotated) {
          const fitScore = potentialSecondary.width * potentialSecondary.height;
          if (fitScore > bestFitScore) {
            bestFitScore = fitScore;
            bestSecondary = potentialSecondary;
          }
        }
      }
      
      satisfiedRequirements.add(req.index);
      
      if (bestSecondary) {
        satisfiedRequirements.add(bestSecondary.index);
        cutPlans.push({
          primaryCutIdx: req.index,
          primaryCut: req,
          leftoverWidth,
          leftoverHeight,
          secondaryCutIdx: bestSecondary.index,
          secondaryCut: bestSecondary
        });
        
        const isCrossWall = req.wallId !== bestSecondary.wallId;
        reusedPieces.push({
          leftoverPiece: {
            tileId: tile.id,
            tileName: tile.name,
            width: leftoverWidth > 0 ? leftoverWidth : req.width,
            height: leftoverHeight > 0 ? leftoverHeight : req.height,
            sourceWallId: req.wallId,
            sourceDescription: `Wall ${req.wallId.slice(-4)}`
          },
          usedForCut: {
            width: bestSecondary.width,
            height: bestSecondary.height,
            wallId: bestSecondary.wallId,
            wallDescription: `Wall ${bestSecondary.wallId.slice(-4)}`
          },
          isCrossWall
        });
      } else {
        cutPlans.push({
          primaryCutIdx: req.index,
          primaryCut: req,
          leftoverWidth,
          leftoverHeight
        });
        
        // Track meaningful waste
        if (leftoverWidth > tile.width * 0.15 || leftoverHeight > tile.height * 0.15) {
          wastePieces.push({
            tileId: tile.id,
            tileName: tile.name,
            width: Math.max(leftoverWidth, 1),
            height: Math.max(leftoverHeight, req.height),
            sourceWallId: req.wallId,
            sourceDescription: `Wall ${req.wallId.slice(-4)}`
          });
        }
      }
    }
    
    // Optimized count = number of cut plans (each plan uses 1 tile for 1-2 cuts)
    const optimizedCount = cutPlans.length;
    totalOptimizedTiles += optimizedCount;
    totalOptimizedCost += optimizedCount * tile.pricePerUnit;
    
    byTileType.push({
      tileId: tile.id,
      tileName: tile.name,
      tilePrice: tile.pricePerUnit,
      standardCount,
      optimizedCount,
      saved: standardCount - optimizedCount
    });
  }
  
  return {
    standardTilesNeeded: totalStandardTiles,
    standardCost: totalStandardCost,
    optimizedTilesNeeded: totalOptimizedTiles,
    optimizedCost: totalOptimizedCost,
    tilesSaved: totalStandardTiles - totalOptimizedTiles,
    costSaved: totalStandardCost - totalOptimizedCost,
    
    // API compatibility
    tilesNeeded: totalOptimizedTiles,
    tilesWithoutOptimization: totalStandardTiles,
    
    reusedPieces,
    wastePieces: wastePieces.slice(0, 10),
    byTileType
  };
}
