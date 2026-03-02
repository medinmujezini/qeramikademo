import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Recycle, ChevronDown, ChevronUp, ArrowRight, Info } from 'lucide-react';
import { CutOptimizationResult } from '@/utils/tileCalculator';

interface LeftoverReusePanelProps {
  optimization: CutOptimizationResult;
}

interface GroupedReuse {
  sourceWall: string;
  reuses: Array<{
    index: number;
    leftoverSize: string;
    usedForSize: string;
    destinationWall: string;
    isCrossWall: boolean;
    leftoverPiece: {
      width: number;
      height: number;
      sourceDescription?: string;
    };
    usedForCut: {
      width: number;
      height: number;
      wallDescription?: string;
      wallId?: string;
    };
  }>;
}

export const LeftoverReusePanel: React.FC<LeftoverReusePanelProps> = ({ optimization }) => {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW_COUNT = 6;

  const reusedPieces = optimization.reusedPieces;
  const crossWallCount = reusedPieces.filter(r => r.isCrossWall).length;
  const sameWallCount = reusedPieces.length - crossWallCount;

  // Group reuses by source wall for cleaner display
  const groupedReuses = useMemo(() => {
    const groups: Record<string, GroupedReuse> = {};
    
    reusedPieces.forEach((reuse, idx) => {
      const sourceWall = reuse.leftoverPiece.sourceDescription || 'Unknown';
      const destWall = reuse.usedForCut.wallDescription || `Wall ${reuse.usedForCut.wallId?.slice(-4) || '?'}`;
      
      if (!groups[sourceWall]) {
        groups[sourceWall] = { sourceWall, reuses: [] };
      }
      
      groups[sourceWall].reuses.push({
        index: idx,
        leftoverSize: `${reuse.leftoverPiece.width.toFixed(0)}×${reuse.leftoverPiece.height.toFixed(0)}`,
        usedForSize: `${reuse.usedForCut.width.toFixed(0)}×${reuse.usedForCut.height.toFixed(0)}`,
        destinationWall: destWall,
        isCrossWall: reuse.isCrossWall || false,
        leftoverPiece: reuse.leftoverPiece,
        usedForCut: reuse.usedForCut,
      });
    });
    
    return Object.values(groups);
  }, [reusedPieces]);

  // Flattened list for simple display mode
  const flatReuses = useMemo(() => {
    return reusedPieces.map((reuse, idx) => ({
      index: idx,
      sourceWall: reuse.leftoverPiece.sourceDescription || 'Unknown',
      leftoverSize: `${reuse.leftoverPiece.width.toFixed(0)}×${reuse.leftoverPiece.height.toFixed(0)}`,
      usedForSize: `${reuse.usedForCut.width.toFixed(0)}×${reuse.usedForCut.height.toFixed(0)}`,
      destinationWall: reuse.usedForCut.wallDescription || `Wall ${reuse.usedForCut.wallId?.slice(-4) || '?'}`,
      isCrossWall: reuse.isCrossWall || false,
      leftoverPiece: reuse.leftoverPiece,
      usedForCut: reuse.usedForCut,
    }));
  }, [reusedPieces]);

  const displayedReuses = showAll ? flatReuses : flatReuses.slice(0, INITIAL_SHOW_COUNT);
  const hasMore = flatReuses.length > INITIAL_SHOW_COUNT;

  if (reusedPieces.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-muted/50 rounded-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Recycle className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">
            Leftover Reuse
          </span>
          <Badge variant="secondary" className="text-xs">
            {reusedPieces.length} pieces
          </Badge>
        </div>
        
        {crossWallCount > 0 && (
          <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
            ↔ {crossWallCount} cross-wall
          </Badge>
        )}
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {sameWallCount} same-wall
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          {crossWallCount} cross-wall
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr,auto,1fr,auto] gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-2 pb-1 border-b border-border/50">
        <span>From</span>
        <span></span>
        <span>Used For</span>
        <span className="text-right">Info</span>
      </div>

      {/* Reuse rows */}
      <div className="space-y-1">
        {displayedReuses.map((reuse) => (
          <Popover key={reuse.index}>
            <PopoverTrigger asChild>
              <div 
                className={`grid grid-cols-[1fr,auto,1fr,auto] gap-2 items-center px-2 py-2 rounded-md cursor-pointer transition-colors
                  ${reuse.isCrossWall 
                    ? 'bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800' 
                    : 'bg-background hover:bg-accent/50 border border-border/50'
                  }`}
              >
                {/* Source */}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{reuse.sourceWall}</p>
                  <p className="text-[11px] text-muted-foreground">{reuse.leftoverSize}cm</p>
                </div>
                
                {/* Arrow */}
                <div className="flex items-center px-1">
                  <ArrowRight className={`h-3.5 w-3.5 ${reuse.isCrossWall ? 'text-purple-500' : 'text-muted-foreground'}`} />
                  {reuse.isCrossWall && <span className="text-purple-500 text-[10px] ml-0.5">↔</span>}
                </div>
                
                {/* Destination */}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{reuse.destinationWall}</p>
                  <p className="text-[11px] text-muted-foreground">{reuse.usedForSize}cm</p>
                </div>
                
                {/* Info icon */}
                <div className="flex justify-end">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </PopoverTrigger>
            
            <PopoverContent className="w-64 p-3" side="left" align="start">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Recycle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Reuse Details</span>
                  {reuse.isCrossWall && (
                    <Badge variant="outline" className="text-[10px] bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      Cross-wall ↔
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="text-xs text-muted-foreground mb-1">Leftover Source</p>
                    <p className="font-medium">{reuse.sourceWall}</p>
                    <p className="text-xs text-muted-foreground">
                      Cut piece: {reuse.leftoverSize}cm
                    </p>
                  </div>
                  
                  <div className="flex justify-center">
                    <ArrowRight className="h-4 w-4 text-green-500" />
                  </div>
                  
                  <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xs text-muted-foreground mb-1">Reused For</p>
                    <p className="font-medium">{reuse.destinationWall}</p>
                    <p className="text-xs text-muted-foreground">
                      Cut needed: {reuse.usedForSize}cm
                    </p>
                  </div>
                </div>
                
                <div className="pt-2 border-t text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓ Saves 1 tile by reusing leftover
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ))}
      </div>

      {/* Show more/less button */}
      {hasMore && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full h-8 text-xs"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Show All {flatReuses.length} Reuses
            </>
          )}
        </Button>
      )}

      {/* Legend */}
      {crossWallCount > 0 && (
        <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
          <span className="text-purple-500 font-medium">↔ Cross-wall:</span> Leftover from one wall reused on a different wall
        </p>
      )}
    </div>
  );
};
