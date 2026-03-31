/**
 * Templates from Database Hook
 * 
 * Fetches furniture and fixture templates from Supabase,
 * with fallback to hardcoded constants for offline/error cases.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FurnitureTemplate, FurnitureCategory, FurnitureType } from '@/data/furnitureLibrary';
import type { FixtureCategory } from '@/types/mep';
import type { FixtureTemplate } from '@/data/fixtureLibrary';
import { FURNITURE_TEMPLATES } from '@/data/furnitureLibrary';
import { FIXTURE_TEMPLATES } from '@/data/fixtureLibrary';
import type { Json } from '@/integrations/supabase/types';

// =============================================================================
// FURNITURE TEMPLATES
// =============================================================================

interface DBFurnitureRow {
  id: string;
  type: string;
  category: string;
  name: string;
  dimensions_json: Json;
  default_color: string;
  icon: string;
  model_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
}

function mapDBToFurnitureTemplate(db: DBFurnitureRow): FurnitureTemplate {
  const dims = db.dimensions_json as { width: number; depth: number; height: number };
  return {
    type: db.type as FurnitureType,
    category: db.category as FurnitureCategory,
    name: db.name,
    dimensions: dims,
    color: db.default_color,
    icon: db.icon,
    thumbnailUrl: db.thumbnail_url || undefined,
    model3D: db.model_url ? { url: db.model_url, thumbnail: db.thumbnail_url || undefined } : undefined,
  };
}

export function useFurnitureTemplates() {
  return useQuery({
    queryKey: ['furniture-templates'],
    queryFn: async (): Promise<FurnitureTemplate[]> => {
      const { data, error } = await supabase
        .from('furniture_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('Failed to fetch furniture templates from DB, using fallback:', error);
        return FURNITURE_TEMPLATES;
      }

      if (!data || data.length === 0) {
        // No data in DB yet, use hardcoded
        return FURNITURE_TEMPLATES;
      }

      return data.map(mapDBToFurnitureTemplate);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useFurnitureByCategory() {
  const { data: templates, isLoading, error } = useFurnitureTemplates();

  const byCategory: Record<FurnitureCategory, FurnitureTemplate[]> = {
    living: [],
    bedroom: [],
    dining: [],
    office: [],
    storage: [],
    decor: [],
    lighting: [],
  };

  if (templates) {
    templates.forEach(t => {
      if (byCategory[t.category]) {
        byCategory[t.category].push(t);
      }
    });
  }

  return { byCategory, isLoading, error };
}

// =============================================================================
// FIXTURE TEMPLATES
// =============================================================================

interface DBFixtureRow {
  id: string;
  type: string;
  category: string;
  name: string;
  dimensions_json: Json;
  clearance_json: Json;
  connection_templates_json: Json;
  requires_wall: boolean;
  wall_offset: number;
  trap_height: number | null;
  supply_height: number | null;
  dfu_value: number;
  gpm_cold: number;
  gpm_hot: number;
  wattage: number | null;
  icon: string;
  model_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
}

function mapDBToFixtureTemplate(db: DBFixtureRow): FixtureTemplate {
  const dims = db.dimensions_json as { width: number; depth: number; height: number };
  const clearance = db.clearance_json as { front: number; sides: number; rear: number };
  const connectionTemplates = (db.connection_templates_json || []) as Array<{
    systemType: 'cold-water' | 'hot-water' | 'drainage' | 'vent' | 'power';
    localPosition: { x: number; y: number; z: number };
    isRequired: boolean;
  }>;

  return {
    type: db.type as any,
    category: db.category as FixtureCategory,
    name: db.name,
    dimensions: dims,
    clearance: clearance,
    connectionTemplates: connectionTemplates,
    requiresWall: db.requires_wall,
    wallOffset: db.wall_offset,
    trapHeight: db.trap_height || 0,
    supplyHeight: db.supply_height || 0,
    wattage: db.wattage || 0,
    icon: db.icon,
  };
}

export function useFixtureTemplates() {
  return useQuery({
    queryKey: ['fixture-templates'],
    queryFn: async (): Promise<FixtureTemplate[]> => {
      const { data, error } = await supabase
        .from('fixture_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('Failed to fetch fixture templates from DB, using fallback:', error);
        return FIXTURE_TEMPLATES;
      }

      if (!data || data.length === 0) {
        return FIXTURE_TEMPLATES;
      }

      return data.map(mapDBToFixtureTemplate);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useFixturesByCategory() {
  const { data: templates, isLoading, error } = useFixtureTemplates();

  const byCategory: Record<FixtureCategory, FixtureTemplate[]> = {
    bathroom: [],
    kitchen: [],
    laundry: [],
    utility: [],
  };

  if (templates) {
    templates.forEach(t => {
      if (byCategory[t.category]) {
        byCategory[t.category].push(t);
      }
    });
  }

  return { byCategory, isLoading, error };
}

// =============================================================================
// GROUT COLORS
// =============================================================================

export interface GroutColor {
  id: string;
  name: string;
  hexColor: string;
}

export function useGroutColors() {
  return useQuery({
    queryKey: ['grout-colors'],
    queryFn: async (): Promise<GroutColor[]> => {
      const { data, error } = await supabase
        .from('grout_colors')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('Failed to fetch grout colors:', error);
        return [];
      }

      return (data || []).map(g => ({
        id: g.id,
        name: g.name,
        hexColor: g.hex_color,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// COLUMN TEMPLATES
// =============================================================================

export interface ColumnTemplate {
  id: string;
  name: string;
  shape: 'rectangle' | 'circle' | 'l-shape';
  dimensions: { width: number; depth: number; height: number };
  material: string;
  isStructural: boolean;
}

export function useColumnTemplates() {
  return useQuery({
    queryKey: ['column-templates'],
    queryFn: async (): Promise<ColumnTemplate[]> => {
      const { data, error } = await supabase
        .from('column_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('Failed to fetch column templates:', error);
        return [];
      }

      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        shape: c.shape as ColumnTemplate['shape'],
        dimensions: c.default_dimensions_json as { width: number; depth: number; height: number },
        material: c.default_material,
        isStructural: c.is_structural,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// TILE TEMPLATES
// =============================================================================

export interface TileTemplate {
  id: string;
  name: string;
  dimensions: { width: number; height: number };
  material: string;
  defaultColor: string;
  pricePerUnit: number;
  isFlexible: boolean;
  minCurveRadius?: number;
  thumbnailUrl?: string;
  materialId?: string;
  textureScaleCm?: number;
}

export function useTileTemplates() {
  return useQuery({
    queryKey: ['tile-templates'],
    queryFn: async (): Promise<TileTemplate[]> => {
      const { data, error } = await supabase
        .from('tile_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.warn('Failed to fetch tile templates:', error);
        return [];
      }

      return (data || []).map(t => {
        const dims = t.dimensions_json as { width: number; height: number };
        return {
          id: t.id,
          name: t.name,
          dimensions: dims,
          material: t.material,
          defaultColor: t.default_color,
          pricePerUnit: Number(t.price_per_unit),
          isFlexible: t.is_flexible,
          minCurveRadius: t.min_curve_radius || undefined,
          thumbnailUrl: t.thumbnail_url || undefined,
          materialId: (t as any).material_id || undefined,
          textureScaleCm: (t as any).texture_scale_cm ? Number((t as any).texture_scale_cm) : undefined,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTilesByMaterial() {
  const { data: templates, isLoading, error } = useTileTemplates();

  const byMaterial: Record<string, TileTemplate[]> = {};

  if (templates) {
    templates.forEach(t => {
      if (!byMaterial[t.material]) {
        byMaterial[t.material] = [];
      }
      byMaterial[t.material].push(t);
    });
  }

  return { byMaterial, isLoading, error, templates };
}
