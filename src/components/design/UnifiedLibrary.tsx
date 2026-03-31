/**
 * Unified Library - Combined Furniture and Fixtures Library
 * 
 * A single searchable library for placing both furniture and fixtures in 3D.
 * Now fetches templates from the database with fallback to hardcoded constants.
 */

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Sofa, Bath, Bed, UtensilsCrossed, 
  Briefcase, Package, Droplets, Zap, GripVertical,
  Loader2, Sparkles, Lightbulb
} from 'lucide-react';
import { useFurnitureContext } from '@/contexts/FurnitureContext';
import { useMEPContext } from '@/contexts/MEPContext';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { useFurnitureByCategory, useFixturesByCategory } from '@/hooks/useTemplatesFromDB';
import { toast } from 'sonner';
import type { FurnitureTemplate, FurnitureCategory } from '@/data/furnitureLibrary';
import type { FixtureCategory } from '@/types/mep';
import type { FixtureTemplate } from '@/data/fixtureLibrary';

// Category icons for furniture
const FURNITURE_CATEGORY_ICONS: Record<FurnitureCategory, React.ReactNode> = {
  living: <Sofa className="h-4 w-4" />,
  bedroom: <Bed className="h-4 w-4" />,
  dining: <UtensilsCrossed className="h-4 w-4" />,
  office: <Briefcase className="h-4 w-4" />,
  storage: <Package className="h-4 w-4" />,
  decor: <Sparkles className="h-4 w-4" />,
  lighting: <Lightbulb className="h-4 w-4" />,
};

// Category icons for fixtures
const FIXTURE_CATEGORY_ICONS: Record<FixtureCategory, React.ReactNode> = {
  bathroom: <Bath className="h-4 w-4" />,
  kitchen: <UtensilsCrossed className="h-4 w-4" />,
  laundry: <Droplets className="h-4 w-4" />,
  utility: <Zap className="h-4 w-4" />,
};

interface LibraryItemProps {
  name: string;
  dimensions: { width: number; depth: number; height: number };
  category: string;
  isFixture?: boolean;
  thumbnailUrl?: string;
  icon?: string;
  onClick: () => void;
}

// Dynamic icon component
const DynamicIcon: React.FC<{ name?: string; className?: string }> = ({ name, className }) => {
  // Fallback icons based on common names
  const iconMap: Record<string, React.ReactNode> = {
    'sofa': <Sofa className={className} />,
    'bed-single': <Bed className={className} />,
    'bed-double': <Bed className={className} />,
    'armchair': <Sofa className={className} />,
    'table': <UtensilsCrossed className={className} />,
    'tv': <Package className={className} />,
    'library': <Package className={className} />,
    'lamp': <Zap className={className} />,
    'lightbulb': <Lightbulb className={className} />,
    'rug': <Sparkles className={className} />,
    'archive': <Package className={className} />,
    'shirt': <Package className={className} />,
    'monitor': <Briefcase className={className} />,
    'footprints': <Package className={className} />,
    'droplet': <Droplets className={className} />,
    'bath': <Bath className={className} />,
    'default': <Package className={className} />,
  };
  
  return <>{iconMap[name || 'default'] || iconMap['default']}</>;
};

interface LibraryItemPropsExtended extends LibraryItemProps {
  onDragStart?: (e: React.DragEvent) => void;
}

const LibraryItem: React.FC<LibraryItemPropsExtended> = ({ 
  name, 
  dimensions, 
  category,
  isFixture,
  thumbnailUrl,
  icon,
  onClick,
  onDragStart 
}) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <button
      className="w-full p-3 text-left rounded-none border border-primary/10 bg-card luxury-hover-glow transition-all group cursor-grab active:cursor-grabbing"
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail or Icon */}
        <div className="w-12 h-12 rounded-none bg-muted border border-primary/10 flex items-center justify-center overflow-hidden shrink-0 transition-border-color duration-400 group-hover:border-primary/30">
          {thumbnailUrl && !imageError ? (
            <img 
              src={thumbnailUrl} 
              alt={name}
              className="w-full h-full object-cover pointer-events-none"
              onError={() => setImageError(true)}
            />
          ) : (
            <DynamicIcon name={icon} className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-display font-medium text-sm truncate" title={name}>{name}</p>
          <p className="text-xs text-muted-foreground">
            {dimensions.width}×{dimensions.depth}×{dimensions.height} cm
          </p>
          {isFixture && (
            <Badge variant="outline" className="mt-1 text-xs gap-1">
              <Droplets className="h-2.5 w-2.5" />
              Plumbing
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-3 p-3">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    ))}
  </div>
);

export const UnifiedLibrary: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'furniture' | 'fixtures'>('furniture');
  
  const { addFurnitureWithCollisionCheck, furniture } = useFurnitureContext();
  const { addFixture } = useMEPContext();
  const { floorPlan } = useFloorPlanContext();

  // Fetch templates from database
  const { byCategory: furnitureByCategory, isLoading: furnitureLoading } = useFurnitureByCategory();
  const { byCategory: fixturesByCategory, isLoading: fixturesLoading } = useFixturesByCategory();

  // Calculate center of floor plan for initial placement
  const getPlacementPosition = useMemo(() => {
    if (floorPlan.points.length === 0) {
      return { x: 200, y: 200 };
    }
    const xs = floorPlan.points.map(p => p.x);
    const ys = floorPlan.points.map(p => p.y);
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
  }, [floorPlan.points]);

  // Filter furniture by search
  const filteredFurniture = useMemo(() => {
    if (!searchQuery.trim()) return furnitureByCategory;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<FurnitureCategory, FurnitureTemplate[]> = {
      living: [],
      bedroom: [],
      dining: [],
      office: [],
      storage: [],
      decor: [],
      lighting: [],
    };

    Object.entries(furnitureByCategory).forEach(([cat, items]) => {
      filtered[cat as FurnitureCategory] = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      );
    });
    
    return filtered;
  }, [searchQuery, furnitureByCategory]);

  // Filter fixtures by search
  const filteredFixtures = useMemo(() => {
    if (!searchQuery.trim()) return fixturesByCategory;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<FixtureCategory, FixtureTemplate[]> = {
      bathroom: [],
      kitchen: [],
      laundry: [],
      utility: [],
    };
    
    Object.entries(fixturesByCategory).forEach(([cat, items]) => {
      filtered[cat as FixtureCategory] = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      );
    });
    
    return filtered;
  }, [searchQuery, fixturesByCategory]);

  // Handle adding furniture with collision-aware placement
  const handleAddFurniture = (template: FurnitureTemplate) => {
    // Small random offset as starting point, collision check will find valid spot
    const offset = { 
      x: (Math.random() - 0.5) * 50, 
      y: (Math.random() - 0.5) * 50 
    };
    const position = {
      x: getPlacementPosition.x + offset.x,
      y: getPlacementPosition.y + offset.y,
    };
    
    // Use collision-aware placement with feedback
    const result = addFurnitureWithCollisionCheck(
      template, 
      position,
      floorPlan.walls || [],
      floorPlan.points || []
    );
    
    if (!result.success) {
      toast.error('No space available to place this item', {
        duration: 2000,
        position: 'bottom-center',
      });
    } else if (result.wasAdjusted) {
      toast.info('Item placed at nearest available position', {
        duration: 1500,
        position: 'bottom-center',
      });
    }
  };

  // Handle drag start for furniture
  const handleFurnitureDragStart = (e: React.DragEvent, template: FurnitureTemplate) => {
    e.dataTransfer.setData('furniture-template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle adding fixture
  const handleAddFixture = (template: FixtureTemplate) => {
    const offset = { 
      x: (Math.random() - 0.5) * 100, 
      y: (Math.random() - 0.5) * 100 
    };
    addFixture(template, {
      x: getPlacementPosition.x + offset.x,
      y: getPlacementPosition.y + offset.y,
    });
  };
  
  // Handle drag start for fixture
  const handleFixtureDragStart = (e: React.DragEvent, template: FixtureTemplate) => {
    e.dataTransfer.setData('fixture-template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="h-full flex flex-col bg-card/50 w-full box-border overflow-hidden">
      {/* Header + Search */}
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-primary/70">Item Library</h3>
        <div className="w-full h-px bg-primary/15 -mt-1" />
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 w-full rounded-none border-primary/15 bg-card luxury-search"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'furniture' | 'fixtures')} className="flex-1 flex flex-col min-h-0 w-full">
        <TabsList className="mx-3 mb-1 w-[calc(100%-1.5rem)] rounded-none">
          <TabsTrigger value="furniture" className="flex-1 gap-1 rounded-none relative data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 data-[state=active]:after:w-full data-[state=inactive]:after:w-0">
            <Sofa className="h-3.5 w-3.5" />
            Furniture
          </TabsTrigger>
          <TabsTrigger value="fixtures" className="flex-1 gap-1 rounded-none relative data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 data-[state=active]:after:w-full data-[state=inactive]:after:w-0">
            <Bath className="h-3.5 w-3.5" />
            Fixtures
          </TabsTrigger>
        </TabsList>

        {/* Furniture content */}
        <TabsContent value="furniture" className="flex-1 m-0">
          <ScrollArea className="h-full">
            {furnitureLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="px-3 py-2 space-y-2">
                {(Object.entries(filteredFurniture) as [FurnitureCategory, FurnitureTemplate[]][]).map(([category, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground border-l-[3px] border-primary/40 pl-2">
                        {FURNITURE_CATEGORY_ICONS[category]}
                        <span>{category}</span>
                        <span className="text-[10px] opacity-60">({items.length})</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((item, index) => (
                          <LibraryItem
                            key={`${item.type}-${index}`}
                            name={item.name}
                            dimensions={item.dimensions}
                            category={category}
                            thumbnailUrl={item.thumbnailUrl || item.model3D?.thumbnail}
                            icon={item.icon}
                            onClick={() => handleAddFurniture(item)}
                            onDragStart={(e) => handleFurnitureDragStart(e, item)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {Object.values(filteredFurniture).every(arr => arr.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No furniture found
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Fixtures content */}
        <TabsContent value="fixtures" className="flex-1 m-0">
          <ScrollArea className="h-full">
            {fixturesLoading ? (
              <LoadingSkeleton />
            ) : (
              <div className="px-3 py-2 space-y-2">
                {(Object.entries(filteredFixtures) as [FixtureCategory, FixtureTemplate[]][]).map(([category, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground border-l-[3px] border-primary/40 pl-2">
                        {FIXTURE_CATEGORY_ICONS[category]}
                        <span>{category}</span>
                        <span className="text-[10px] opacity-60">({items.length})</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((item, index) => (
                          <LibraryItem
                            key={`${item.type}-${index}`}
                            name={item.name}
                            dimensions={item.dimensions}
                            category={category}
                            isFixture={true}
                            icon={item.icon}
                            onClick={() => handleAddFixture(item)}
                            onDragStart={(e) => handleFixtureDragStart(e, item)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {Object.values(filteredFixtures).every(arr => arr.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No fixtures found
                  </p>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-primary/10 text-[10px] uppercase tracking-widest text-muted-foreground text-center shrink-0">
        <div className="w-12 h-px bg-primary/25 mx-auto mb-1" />
        Click or drag to add
      </div>
    </div>
  );
};
