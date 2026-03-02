/**
 * Type Mappers
 * 
 * Centralized functions for converting between database rows and frontend types.
 * Handles snake_case → camelCase conversion and JSON parsing.
 */

import type { Database } from '@/integrations/supabase/types';
import type { FurnitureTemplate, FurnitureCategory, FurnitureType } from '@/data/furnitureLibrary';
import type { FixtureTemplate } from '@/data/fixtureLibrary';
import type { FixtureType, FixtureCategory, Dimensions } from '@/types/mep';
import type { Tile, ColumnShape, WallMaterial } from '@/types/floorPlan';

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

type FurnitureRow = Database['public']['Tables']['furniture_templates']['Row'];
type FixtureRow = Database['public']['Tables']['fixture_templates']['Row'];
type TileRow = Database['public']['Tables']['tile_templates']['Row'];
type ColumnRow = Database['public']['Tables']['column_templates']['Row'];
type GroutRow = Database['public']['Tables']['grout_colors']['Row'];

// =============================================================================
// DIMENSION PARSING
// =============================================================================

/**
 * Parse dimensions JSON from database
 */
export function parseDimensions(json: unknown): Dimensions {
  const dims = json as { width?: number; depth?: number; height?: number } | null;
  return {
    width: dims?.width ?? 50,
    depth: dims?.depth ?? 50,
    height: dims?.height ?? 50,
  };
}

/**
 * Parse clearance JSON from database
 */
export function parseClearance(json: unknown): { front: number; sides: number; rear: number } {
  const clearance = json as { front?: number; sides?: number; rear?: number } | null;
  return {
    front: clearance?.front ?? 53,
    sides: clearance?.sides ?? 38,
    rear: clearance?.rear ?? 0,
  };
}

/**
 * Parse connection templates JSON from database
 */
export function parseConnectionTemplates(json: unknown): FixtureTemplate['connectionTemplates'] {
  if (!json || !Array.isArray(json)) return [];
  
  return json.map((ct: unknown) => {
    const conn = ct as {
      systemType?: string;
      localPosition?: { x?: number; y?: number; z?: number };
      isRequired?: boolean;
    };
    
    return {
      systemType: (conn.systemType || 'cold-water') as 'cold-water' | 'hot-water' | 'drainage' | 'vent' | 'power',
      localPosition: {
        x: conn.localPosition?.x ?? 0,
        y: conn.localPosition?.y ?? 0,
        z: conn.localPosition?.z ?? 0,
      },
      isRequired: conn.isRequired ?? true,
    };
  });
}

// =============================================================================
// FURNITURE MAPPING
// =============================================================================

/**
 * Map database furniture row to FurnitureTemplate
 */
export function mapDBFurniture(row: FurnitureRow): FurnitureTemplate {
  return {
    type: row.type as FurnitureType,
    category: row.category as FurnitureCategory,
    name: row.name,
    dimensions: parseDimensions(row.dimensions_json),
    color: row.default_color,
    icon: row.icon || undefined,
    thumbnailUrl: row.thumbnail_url || undefined,
    model3D: row.model_url ? { url: row.model_url } : undefined,
  };
}

/**
 * Map multiple furniture rows
 */
export function mapDBFurnitureList(rows: FurnitureRow[]): FurnitureTemplate[] {
  return rows.filter(r => r.is_active).map(mapDBFurniture);
}

// =============================================================================
// FIXTURE MAPPING
// =============================================================================

/**
 * Map database fixture row to FixtureTemplate
 */
export function mapDBFixture(row: FixtureRow): FixtureTemplate {
  return {
    type: row.type as FixtureType,
    category: row.category as FixtureCategory,
    name: row.name,
    dimensions: parseDimensions(row.dimensions_json),
    clearance: parseClearance(row.clearance_json),
    requiresWall: row.requires_wall,
    wallOffset: row.wall_offset,
    trapHeight: row.trap_height ?? 0,
    supplyHeight: row.supply_height ?? 0,
    wattage: row.wattage ?? 0,
    connectionTemplates: parseConnectionTemplates(row.connection_templates_json),
    icon: row.icon || undefined,
  };
}

/**
 * Map multiple fixture rows
 */
export function mapDBFixtureList(rows: FixtureRow[]): FixtureTemplate[] {
  return rows.filter(r => r.is_active).map(mapDBFixture);
}

// =============================================================================
// TILE MAPPING
// =============================================================================

/**
 * Map database tile row to Tile type
 */
export function mapDBTile(row: TileRow): Tile {
  const dims = parseDimensions(row.dimensions_json);
  
  return {
    id: row.id,
    name: row.name,
    width: dims.width,
    height: dims.height,  // For tiles, height means the 2D height (depth)
    pricePerUnit: row.price_per_unit,
    material: row.material,
    color: row.default_color,
    minCurveRadius: row.min_curve_radius ?? undefined,
    isFlexible: row.is_flexible,
  };
}

/**
 * Map multiple tile rows
 */
export function mapDBTileList(rows: TileRow[]): Tile[] {
  return rows.filter(r => r.is_active).map(mapDBTile);
}

// =============================================================================
// COLUMN MAPPING
// =============================================================================

export interface ColumnTemplate {
  id: string;
  name: string;
  shape: ColumnShape;
  defaultDimensions: {
    width: number;
    depth: number;
    height: number;
    armWidth?: number;
    armLength?: number;
  };
  defaultMaterial: WallMaterial;
  isStructural: boolean;
}

/**
 * Map database column row to ColumnTemplate
 */
export function mapDBColumn(row: ColumnRow): ColumnTemplate {
  const dims = row.default_dimensions_json as {
    width?: number;
    depth?: number;
    height?: number;
    armWidth?: number;
    armLength?: number;
  } | null;
  
  return {
    id: row.id,
    name: row.name,
    shape: row.shape as ColumnShape,
    defaultDimensions: {
      width: dims?.width ?? 30,
      depth: dims?.depth ?? 30,
      height: dims?.height ?? 280,
      armWidth: dims?.armWidth,
      armLength: dims?.armLength,
    },
    defaultMaterial: row.default_material as WallMaterial,
    isStructural: row.is_structural,
  };
}

/**
 * Map multiple column rows
 */
export function mapDBColumnList(rows: ColumnRow[]): ColumnTemplate[] {
  return rows.filter(r => r.is_active).map(mapDBColumn);
}

// =============================================================================
// GROUT COLOR MAPPING
// =============================================================================

export interface GroutColor {
  id: string;
  name: string;
  hexColor: string;
}

/**
 * Map database grout color row
 */
export function mapDBGroutColor(row: GroutRow): GroutColor {
  return {
    id: row.id,
    name: row.name,
    hexColor: row.hex_color,
  };
}

/**
 * Map multiple grout color rows
 */
export function mapDBGroutColorList(rows: GroutRow[]): GroutColor[] {
  return rows.filter(r => r.is_active).map(mapDBGroutColor);
}

// =============================================================================
// GENERIC HELPERS
// =============================================================================

/**
 * Convert snake_case string to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 */
export function mapKeysToCamel<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const key of Object.keys(obj)) {
    result[snakeToCamel(key)] = obj[key];
  }
  
  return result;
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function mapKeysToSnake<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const key of Object.keys(obj)) {
    result[camelToSnake(key)] = obj[key];
  }
  
  return result;
}
