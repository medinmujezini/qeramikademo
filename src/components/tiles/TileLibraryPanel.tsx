/**
 * Tile Library Panel
 * 
 * Displays available tile templates from the database for selection.
 * Includes search, filtering by material, and preview capabilities.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, Grid3X3, Square, Hexagon, Circle, 
  Loader2, DollarSign
} from 'lucide-react';
import { useTilesByMaterial, type TileTemplate } from '@/hooks/useTemplatesFromDB';
import type { Tile } from '@/types/floorPlan';

// Map DB template to legacy Tile format for compatibility
function templateToTile(template: TileTemplate): Tile {
  return {
    id: template.id,
    name: template.name,
    width: template.dimensions.width,
    height: template.dimensions.height,
    color: template.defaultColor,
    material: template.material as Tile['material'],
    pricePerUnit: template.pricePerUnit,
    isFlexible: template.isFlexible,
    minCurveRadius: template.minCurveRadius,
  };
}

interface TileItemProps {
  tile: TileTemplate;
  isSelected: boolean;
  onSelect: () => void;
}

const TileItem: React.FC<TileItemProps> = ({ tile, isSelected, onSelect }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <Button
      variant={isSelected ? 'default' : 'outline'}
      className="w-full justify-start h-auto py-2 px-2"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 w-full">
        {/* Thumbnail or color swatch */}
        <div 
          className="w-8 h-8 rounded border shrink-0 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: tile.thumbnailUrl && !imageError ? undefined : tile.defaultColor }}
        >
          {tile.thumbnailUrl && !imageError ? (
            <img 
              src={tile.thumbnailUrl} 
              alt={tile.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <Square className="h-4 w-4 opacity-30" />
          )}
        </div>
        
        <div className="text-left flex-1 min-w-0">
          <div className="font-medium truncate text-xs">{tile.name}</div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            {tile.dimensions.width}×{tile.dimensions.height}cm
            {tile.pricePerUnit > 0 && (
              <>
                <span>•</span>
                <DollarSign className="h-2.5 w-2.5" />
                {tile.pricePerUnit.toFixed(2)}
              </>
            )}
          </div>
        </div>
        
        {tile.isFlexible && (
          <Badge variant="secondary" className="text-[8px] px-1">
            Flex
          </Badge>
        )}
      </div>
    </Button>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-2 p-1">
    {[1, 2, 3, 4, 5].map(i => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
);

interface TileLibraryPanelProps {
  selectedTileId?: string | null;
  onTileSelect: (tile: Tile) => void;
  showHeader?: boolean;
  maxHeight?: string;
}

export const TileLibraryPanel: React.FC<TileLibraryPanelProps> = ({
  selectedTileId,
  onTileSelect,
  showHeader = true,
  maxHeight = '300px',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMaterial, setActiveMaterial] = useState<string>('all');
  
  const { byMaterial, isLoading, templates } = useTilesByMaterial();
  
  // Get unique materials
  const materials = useMemo(() => {
    const mats = Object.keys(byMaterial);
    return ['all', ...mats];
  }, [byMaterial]);
  
  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates || [];
    
    // Filter by material
    if (activeMaterial !== 'all') {
      result = result.filter(t => t.material === activeMaterial);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.material.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [templates, activeMaterial, searchQuery]);
  
  const handleSelect = (template: TileTemplate) => {
    onTileSelect(templateToTile(template));
  };

  return (
    <Card className="h-full flex flex-col">
      {showHeader && (
        <CardHeader className="py-2 px-3 shrink-0">
          <CardTitle className="text-xs flex items-center gap-2">
            <Grid3X3 className="h-3 w-3" />
            Tile Library
          </CardTitle>
        </CardHeader>
      )}
      
      <CardContent className="p-2 flex-1 flex flex-col min-h-0">
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search tiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
        
        {/* Material tabs */}
        {materials.length > 2 && (
          <div className="flex gap-1 mb-2 flex-wrap">
            {materials.slice(0, 5).map(mat => (
              <Button
                key={mat}
                variant={activeMaterial === mat ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setActiveMaterial(mat)}
              >
                {mat === 'all' ? 'All' : mat.charAt(0).toUpperCase() + mat.slice(1)}
              </Button>
            ))}
          </div>
        )}
        
        {/* Tile list */}
        <ScrollArea className="flex-1" style={{ maxHeight }}>
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              {templates?.length === 0 
                ? 'No tiles configured. Add tiles in admin panel.'
                : 'No tiles match your search'
              }
            </div>
          ) : (
            <div className="space-y-1.5 p-0.5">
              {filteredTemplates.map(tile => (
                <TileItem
                  key={tile.id}
                  tile={tile}
                  isSelected={selectedTileId === tile.id}
                  onSelect={() => handleSelect(tile)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Stats */}
        {!isLoading && templates && templates.length > 0 && (
          <div className="pt-2 border-t mt-2 text-[10px] text-muted-foreground text-center">
            {filteredTemplates.length} of {templates.length} tiles
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TileLibraryPanel;
