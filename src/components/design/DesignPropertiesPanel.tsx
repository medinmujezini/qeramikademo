/**
 * Design Properties Panel
 * 
 * Shows properties of the selected furniture item with actions.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RotateCw, Trash2, Move, Palette, Info,
  Armchair, Box, Droplets, ArrowRight
} from 'lucide-react';
import { useMEPContext } from '@/contexts/MEPContext';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import { Link } from 'react-router-dom';

interface DesignPropertiesPanelProps {
  selectedFurniture: FurnitureItem | null;
  onRotate: () => void;
  onDelete: () => void;
}

export const DesignPropertiesPanel: React.FC<DesignPropertiesPanelProps> = ({
  selectedFurniture,
  onRotate,
  onDelete,
}) => {
  const { fixtures, routes } = useMEPContext();
  
  // Count fixtures that need plumbing (have connections but no routes)
  const fixturesNeedingPlumbing = fixtures.filter(f => 
    f.connections.some(c => c.isRequired)
  ).length;
  
  const hasPlumbingRoutes = routes.length > 0;

  if (!selectedFurniture) {
    return (
      <div className="h-full flex flex-col border-l border-primary/10 bg-card/50 shadow-[inset_0_0_40px_hsl(38_60%_68%/0.03)]">
        <div className="p-4 border-b border-primary/15">
              <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-primary/70">Properties</h3>
              <div className="w-8 h-px bg-primary/25 mt-1" />
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* No selection state */}
            <div className="text-center py-8">
              <Box className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Select an item to view its properties
              </p>
            </div>

            <Separator />

            {/* Room summary */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-primary/60 border-l-[3px] border-primary/35 pl-2">Scene Summary</h4>
              
              <Card className="luxury-hover-glow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Armchair className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Furniture</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">0 items</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="luxury-hover-glow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-primary/70" />
                      <span className="text-sm">Fixtures</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">{fixtures.length} items</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Plumbing status */}
            {fixtures.length > 0 && !hasPlumbingRoutes && (
              <>
                <Separator />
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Plumbing needed
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {fixturesNeedingPlumbing} fixture(s) need plumbing connections
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 w-full text-xs"
                          asChild
                        >
                          <Link to="/?tab=plumbing">
                            Set up Plumbing
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l border-primary/10 bg-card/50 shadow-[inset_0_0_40px_hsl(38_60%_68%/0.03)]">
      <div className="p-4 border-b border-primary/15">
        <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-primary/70">Properties</h3>
        <div className="w-8 h-px bg-primary/25 mt-1" />
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Selected item info */}
          <Card className="luxury-hover-glow">
            <div className="h-[2px] bg-primary/40" />
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Armchair className="h-4 w-4" />
                {selectedFurniture.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Category</span>
                  <p className="font-medium capitalize">{selectedFurniture.category}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rotation</span>
                  <p className="font-medium">{Math.round(selectedFurniture.rotation)}°</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <span className="text-sm text-muted-foreground">Dimensions</span>
                <p className="text-sm font-display font-medium tracking-wide">
                  {selectedFurniture.dimensions.width} × {selectedFurniture.dimensions.depth} × {selectedFurniture.dimensions.height} cm
                </p>
              </div>
              
              <div>
                <span className="text-sm text-muted-foreground">Position</span>
                <p className="text-sm font-display font-medium">
                  X: {Math.round(selectedFurniture.position.x)} cm, Y: {Math.round(selectedFurniture.position.y)} cm
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color</span>
                <div 
                  className="w-5 h-5 rounded-none border border-primary/20"
                  style={{ backgroundColor: selectedFurniture.color }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-primary/60 border-l-[3px] border-primary/35 pl-2">Actions</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <Button variant="luxury" size="sm" onClick={onRotate}>
                <RotateCw className="h-4 w-4 mr-1" />
                Rotate 45°
              </Button>
              <Button variant="luxury" size="sm" disabled>
                <Palette className="h-4 w-4 mr-1" />
                Color
              </Button>
            </div>
            
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>

          <Separator />

          {/* Tips */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-primary/60 border-l-[3px] border-primary/35 pl-2">Tips</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="text-primary/40">•</span> Drag to move in 3D view</p>
              <p><span className="text-primary/40">•</span> Red glow = collision detected</p>
              <p><span className="text-primary/40">•</span> Items snap to 10cm grid</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
