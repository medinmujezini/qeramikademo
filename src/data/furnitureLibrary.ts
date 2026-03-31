/**
 * Furniture Library
 * 
 * Furniture items for room layout (non-MEP, decorative/functional).
 */

import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export type FurnitureCategory = 'living' | 'bedroom' | 'dining' | 'office' | 'storage' | 'decor' | 'lighting';

export type FurnitureType =
  // Living
  | 'sofa-2seat'
  | 'sofa-3seat'
  | 'armchair'
  | 'coffee-table'
  | 'tv-stand'
  | 'bookshelf'
  // Bedroom
  | 'bed-single'
  | 'bed-double'
  | 'bed-queen'
  | 'bed-king'
  | 'nightstand'
  | 'dresser'
  | 'wardrobe'
  // Dining
  | 'dining-table-4'
  | 'dining-table-6'
  | 'dining-chair'
  // Office
  | 'desk'
  | 'office-chair'
  | 'filing-cabinet'
  // Storage
  | 'storage-cabinet'
  | 'shoe-rack'
  // Decor
  | 'rug-small'
  | 'rug-medium'
  | 'rug-large'
  | 'rug-runner'
  // Lighting
  | 'ceiling-light-round'
  | 'ceiling-light-square'
  | 'chandelier'
  | 'pendant-light';

export interface FurnitureModel3D {
  url: string;           // Path to GLB file
  thumbnail?: string;    // Preview image
  scale?: number;        // Model scale factor (default 1)
  yOffset?: number;      // Vertical offset from floor
}

export interface FurnitureLODModels {
  high: string;    // Full detail (< 5m distance)
  medium?: string; // Reduced (5-15m)
  low?: string;    // Minimal (> 15m)
}

export interface FurnitureTemplate {
  type: FurnitureType;
  category: FurnitureCategory;
  name: string;
  dimensions: {
    width: number;   // cm
    depth: number;   // cm
    height: number;  // cm
  };
  color: string;     // Default render color
  icon?: string;     // Lucide icon name
  thumbnailUrl?: string;           // Preview image URL
  model3D?: FurnitureModel3D;      // 3D model reference
  lodModels?: FurnitureLODModels;  // LOD variants for performance
  price?: number;                  // Price in cents
  currency?: string;               // Currency code (e.g., 'USD', 'EUR')
}

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  category: FurnitureCategory;
  name: string;
  position: { x: number; y: number };
  rotation: number;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  color: string;
  modelUrl?: string;      // URL to GLB/GLTF model
  thumbnailUrl?: string;  // Preview image URL
  price?: number;         // Price in cents
  currency?: string;      // Currency code (e.g., 'USD', 'EUR')
}

// =============================================================================
// FURNITURE TEMPLATES
// =============================================================================

const SOFA_2SEAT: FurnitureTemplate = {
  type: 'sofa-2seat',
  category: 'living',
  name: '2-Seat Sofa',
  dimensions: { width: 150, depth: 85, height: 80 },
  color: '#6B7280',
  icon: 'sofa',
};

const SOFA_3SEAT: FurnitureTemplate = {
  type: 'sofa-3seat',
  category: 'living',
  name: '3-Seat Sofa',
  dimensions: { width: 220, depth: 90, height: 80 },
  color: '#6B7280',
  icon: 'sofa',
};

const ARMCHAIR: FurnitureTemplate = {
  type: 'armchair',
  category: 'living',
  name: 'Armchair',
  dimensions: { width: 80, depth: 85, height: 90 },
  color: '#9CA3AF',
  icon: 'armchair',
};

const COFFEE_TABLE: FurnitureTemplate = {
  type: 'coffee-table',
  category: 'living',
  name: 'Coffee Table',
  dimensions: { width: 120, depth: 60, height: 45 },
  color: '#78716C',
  icon: 'table',
};

const TV_STAND: FurnitureTemplate = {
  type: 'tv-stand',
  category: 'living',
  name: 'TV Stand',
  dimensions: { width: 150, depth: 45, height: 50 },
  color: '#44403C',
  icon: 'tv',
};

const BOOKSHELF: FurnitureTemplate = {
  type: 'bookshelf',
  category: 'living',
  name: 'Bookshelf',
  dimensions: { width: 80, depth: 30, height: 180 },
  color: '#78716C',
  icon: 'library',
};

// Bedroom
const BED_SINGLE: FurnitureTemplate = {
  type: 'bed-single',
  category: 'bedroom',
  name: 'Single Bed',
  dimensions: { width: 100, depth: 200, height: 50 },
  color: '#D6D3D1',
  icon: 'bed-single',
};

const BED_DOUBLE: FurnitureTemplate = {
  type: 'bed-double',
  category: 'bedroom',
  name: 'Double Bed',
  dimensions: { width: 140, depth: 200, height: 50 },
  color: '#D6D3D1',
  icon: 'bed-double',
};

const BED_QUEEN: FurnitureTemplate = {
  type: 'bed-queen',
  category: 'bedroom',
  name: 'Queen Bed',
  dimensions: { width: 160, depth: 200, height: 50 },
  color: '#D6D3D1',
  icon: 'bed-double',
};

const BED_KING: FurnitureTemplate = {
  type: 'bed-king',
  category: 'bedroom',
  name: 'King Bed',
  dimensions: { width: 190, depth: 200, height: 50 },
  color: '#D6D3D1',
  icon: 'bed-double',
};

const NIGHTSTAND: FurnitureTemplate = {
  type: 'nightstand',
  category: 'bedroom',
  name: 'Nightstand',
  dimensions: { width: 50, depth: 40, height: 55 },
  color: '#A8A29E',
  icon: 'lamp',
};

const DRESSER: FurnitureTemplate = {
  type: 'dresser',
  category: 'bedroom',
  name: 'Dresser',
  dimensions: { width: 120, depth: 50, height: 80 },
  color: '#78716C',
  icon: 'archive',
};

const WARDROBE: FurnitureTemplate = {
  type: 'wardrobe',
  category: 'bedroom',
  name: 'Wardrobe',
  dimensions: { width: 150, depth: 60, height: 200 },
  color: '#57534E',
  icon: 'shirt',
};

// Dining
const DINING_TABLE_4: FurnitureTemplate = {
  type: 'dining-table-4',
  category: 'dining',
  name: 'Dining Table (4 seats)',
  dimensions: { width: 120, depth: 80, height: 75 },
  color: '#78716C',
  icon: 'table',
};

const DINING_TABLE_6: FurnitureTemplate = {
  type: 'dining-table-6',
  category: 'dining',
  name: 'Dining Table (6 seats)',
  dimensions: { width: 180, depth: 90, height: 75 },
  color: '#78716C',
  icon: 'table',
};

const DINING_CHAIR: FurnitureTemplate = {
  type: 'dining-chair',
  category: 'dining',
  name: 'Dining Chair',
  dimensions: { width: 45, depth: 50, height: 90 },
  color: '#A8A29E',
  icon: 'armchair',
};

// Office
const DESK: FurnitureTemplate = {
  type: 'desk',
  category: 'office',
  name: 'Desk',
  dimensions: { width: 140, depth: 70, height: 75 },
  color: '#A8A29E',
  icon: 'monitor',
};

const OFFICE_CHAIR: FurnitureTemplate = {
  type: 'office-chair',
  category: 'office',
  name: 'Office Chair',
  dimensions: { width: 60, depth: 60, height: 100 },
  color: '#374151',
  icon: 'armchair',
};

const FILING_CABINET: FurnitureTemplate = {
  type: 'filing-cabinet',
  category: 'office',
  name: 'Filing Cabinet',
  dimensions: { width: 45, depth: 60, height: 100 },
  color: '#6B7280',
  icon: 'archive',
};

// Storage
const STORAGE_CABINET: FurnitureTemplate = {
  type: 'storage-cabinet',
  category: 'storage',
  name: 'Storage Cabinet',
  dimensions: { width: 80, depth: 45, height: 120 },
  color: '#57534E',
  icon: 'archive',
};

const SHOE_RACK: FurnitureTemplate = {
  type: 'shoe-rack',
  category: 'storage',
  name: 'Shoe Rack',
  dimensions: { width: 80, depth: 30, height: 80 },
  color: '#78716C',
  icon: 'footprints',
};

// Decor
const RUG_SMALL: FurnitureTemplate = {
  type: 'rug-small',
  category: 'decor',
  name: 'Small Rug',
  dimensions: { width: 120, depth: 80, height: 1 },
  color: '#8B7355',
  icon: 'rug',
};

const RUG_MEDIUM: FurnitureTemplate = {
  type: 'rug-medium',
  category: 'decor',
  name: 'Medium Rug',
  dimensions: { width: 200, depth: 140, height: 1 },
  color: '#A0522D',
  icon: 'rug',
};

const RUG_LARGE: FurnitureTemplate = {
  type: 'rug-large',
  category: 'decor',
  name: 'Large Area Rug',
  dimensions: { width: 300, depth: 200, height: 1 },
  color: '#6B4226',
  icon: 'rug',
};

const RUG_RUNNER: FurnitureTemplate = {
  type: 'rug-runner',
  category: 'decor',
  name: 'Runner Rug',
  dimensions: { width: 240, depth: 70, height: 1 },
  color: '#8B6914',
  icon: 'rug',
};

// Lighting
const CEILING_LIGHT_ROUND: FurnitureTemplate = {
  type: 'ceiling-light-round',
  category: 'lighting',
  name: 'Round Ceiling Light',
  dimensions: { width: 40, depth: 40, height: 12 },
  color: '#FFF8DC',
  icon: 'lightbulb',
};

const CEILING_LIGHT_SQUARE: FurnitureTemplate = {
  type: 'ceiling-light-square',
  category: 'lighting',
  name: 'Square Ceiling Light',
  dimensions: { width: 50, depth: 50, height: 10 },
  color: '#FFFACD',
  icon: 'lightbulb',
};

const CHANDELIER: FurnitureTemplate = {
  type: 'chandelier',
  category: 'lighting',
  name: 'Chandelier',
  dimensions: { width: 60, depth: 60, height: 50 },
  color: '#FFD700',
  icon: 'lightbulb',
};

const PENDANT_LIGHT: FurnitureTemplate = {
  type: 'pendant-light',
  category: 'lighting',
  name: 'Pendant Light',
  dimensions: { width: 30, depth: 30, height: 25 },
  color: '#F5DEB3',
  icon: 'lightbulb',
};

// =============================================================================
// EXPORTS
// =============================================================================

export const FURNITURE_TEMPLATES: FurnitureTemplate[] = [
  // Living
  SOFA_2SEAT,
  SOFA_3SEAT,
  ARMCHAIR,
  COFFEE_TABLE,
  TV_STAND,
  BOOKSHELF,
  // Bedroom
  BED_SINGLE,
  BED_DOUBLE,
  BED_QUEEN,
  BED_KING,
  NIGHTSTAND,
  DRESSER,
  WARDROBE,
  // Dining
  DINING_TABLE_4,
  DINING_TABLE_6,
  DINING_CHAIR,
  // Office
  DESK,
  OFFICE_CHAIR,
  FILING_CABINET,
  // Storage
  STORAGE_CABINET,
  SHOE_RACK,
  // Decor
  RUG_SMALL,
  RUG_MEDIUM,
  RUG_LARGE,
  RUG_RUNNER,
  // Lighting
  CEILING_LIGHT_ROUND,
  CEILING_LIGHT_SQUARE,
  CHANDELIER,
  PENDANT_LIGHT,
];

export function getFurnitureByCategory(): Record<FurnitureCategory, FurnitureTemplate[]> {
  return {
    living: FURNITURE_TEMPLATES.filter(f => f.category === 'living'),
    bedroom: FURNITURE_TEMPLATES.filter(f => f.category === 'bedroom'),
    dining: FURNITURE_TEMPLATES.filter(f => f.category === 'dining'),
    office: FURNITURE_TEMPLATES.filter(f => f.category === 'office'),
    storage: FURNITURE_TEMPLATES.filter(f => f.category === 'storage'),
    decor: FURNITURE_TEMPLATES.filter(f => f.category === 'decor'),
    lighting: FURNITURE_TEMPLATES.filter(f => f.category === 'lighting'),
  };
}

export function getFurnitureTemplate(type: FurnitureType): FurnitureTemplate | undefined {
  return FURNITURE_TEMPLATES.find(f => f.type === type);
}

export function createFurnitureFromTemplate(
  template: FurnitureTemplate,
  position: { x: number; y: number },
  rotation: number = 0
): FurnitureItem {
  return {
    id: uuidv4(),
    type: template.type,
    category: template.category,
    name: template.name,
    position,
    rotation,
    dimensions: { ...template.dimensions },
    color: template.color,
    modelUrl: template.model3D?.url,      // Pass through model URL
    thumbnailUrl: template.thumbnailUrl,  // Pass through thumbnail URL
    price: template.price,                // Pass through price
    currency: template.currency,          // Pass through currency
  };
}
