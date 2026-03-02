import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Download, 
  Scissors, 
  TrendingDown, 
  Package, 
  Layers,
  CircleDot,
  TrendingUp,
  Droplets,
  Wrench
} from 'lucide-react';
import { LeftoverReusePanel } from './LeftoverReusePanel';
import { LeftoverFlowDiagram } from './LeftoverFlowDiagram';
import { Wall, Point } from '@/types/floorPlan';
import { 
  ProjectCalculationResult, 
  CutOptimizationResult 
} from '@/utils/tileCalculator';

interface WallBreakdownItem {
  wallId: string;
  wallName: string;
  area: number;
  fullTiles: number;
  cutTiles: number;
  isCurved: boolean;
  isSloped: boolean;
  wastageFactor: number;
  assignedTile: string | null;
}

interface MaterialsResult {
  groutKg: number;
  adhesiveKg: number;
  siliconeMl: number;
}

interface TileCalculationsPanelProps {
  projectCalculation: ProjectCalculationResult | null;
  wallBreakdown: WallBreakdownItem[];
  materials: MaterialsResult | null;
  totalCost: number;
  onExportPDF: () => void;
  isExportingPDF: boolean;
  curvedWallCount: number;
  slopedWallCount: number;
  walls: Wall[];
}

export function TileCalculationsPanel({
  projectCalculation,
  wallBreakdown,
  materials,
  totalCost,
  onExportPDF,
  isExportingPDF,
  curvedWallCount,
  slopedWallCount,
  walls,
}: TileCalculationsPanelProps) {
  const optimization = projectCalculation?.optimization;
  const hasSavings = optimization && optimization.tilesSaved > 0;

  // Calculate totals from wall breakdown
  const totals = React.useMemo(() => {
    return wallBreakdown.reduce(
      (acc, wall) => ({
        totalArea: acc.totalArea + wall.area,
        totalFullTiles: acc.totalFullTiles + wall.fullTiles,
        totalCutTiles: acc.totalCutTiles + wall.cutTiles,
      }),
      { totalArea: 0, totalFullTiles: 0, totalCutTiles: 0 }
    );
  }, [wallBreakdown]);

  const totalTiles = totals.totalFullTiles + totals.totalCutTiles;
  const cutPercentage = totalTiles > 0 
    ? ((totals.totalCutTiles / totalTiles) * 100).toFixed(1) 
    : '0';
  
  // Use correct property names from CutOptimizationResult
  const optimizedCount = optimization?.optimizedTilesNeeded ?? totalTiles;
  const standardCount = optimization?.standardTilesNeeded ?? totalTiles;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Project Summary */}
        <Card className="glass-card border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Project Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">
                  {optimizedCount}
                </div>
                <div className="text-xs text-muted-foreground">Tiles Needed</div>
              </div>
              <div className="bg-background/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {totals.totalCutTiles}
                </div>
                <div className="text-xs text-muted-foreground">Tiles to Cut</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background/20 rounded p-2">
                <div className="text-sm font-semibold">{totals.totalFullTiles}</div>
                <div className="text-[10px] text-muted-foreground">Full Tiles</div>
              </div>
              <div className="bg-background/20 rounded p-2">
                <div className="text-sm font-semibold">{cutPercentage}%</div>
                <div className="text-[10px] text-muted-foreground">Cut Ratio</div>
              </div>
              <div className="bg-background/20 rounded p-2">
                <div className="text-sm font-semibold">{totals.totalArea.toFixed(1)}m²</div>
                <div className="text-[10px] text-muted-foreground">Total Area</div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated Cost</span>
              <span className="text-lg font-bold text-green-400">
                ${totalCost.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cut Optimization Results */}
        {optimization && (
          <Card className={`glass-card border-white/10 ${hasSavings ? 'ring-1 ring-green-500/30' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Scissors className="h-4 w-4 text-primary" />
                Cut Optimization
                {hasSavings && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-[10px]">
                    Savings Available!
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase">Standard</span>
                  </div>
                  <div className="text-lg font-semibold">{standardCount}</div>
                </div>
                <div className="bg-background/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3 w-3 text-green-400" />
                    <span className="text-[10px] text-muted-foreground uppercase">Optimized</span>
                  </div>
                  <div className="text-lg font-semibold text-green-400">{optimizedCount}</div>
                </div>
              </div>

              {hasSavings && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-400">
                        {optimization.tilesSaved} tiles saved
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Through leftover piece reuse
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        ${optimization.costSaved.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">saved</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leftover Reuse Details */}
              {optimization.reusedPieces && optimization.reusedPieces.length > 0 && (
                <LeftoverReusePanel optimization={optimization} />
              )}
            </CardContent>
          </Card>
        )}

        {/* Leftover Flow Diagram */}
        {optimization && walls.length > 0 && (
          <LeftoverFlowDiagram 
            optimization={optimization} 
            walls={walls}
          />
        )}

        {/* Materials Needed */}
        {materials && (
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                Materials Needed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-background/30 rounded-lg p-3 text-center">
                  <Droplets className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                  <div className="text-sm font-semibold">{materials.groutKg.toFixed(1)} kg</div>
                  <div className="text-[10px] text-muted-foreground">Grout</div>
                </div>
                <div className="bg-background/30 rounded-lg p-3 text-center">
                  <Layers className="h-4 w-4 mx-auto mb-1 text-amber-400" />
                  <div className="text-sm font-semibold">{materials.adhesiveKg.toFixed(1)} kg</div>
                  <div className="text-[10px] text-muted-foreground">Adhesive</div>
                </div>
                <div className="bg-background/30 rounded-lg p-3 text-center">
                  <Package className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                  <div className="text-sm font-semibold">{Math.ceil(materials.siliconeMl / 300)}</div>
                  <div className="text-[10px] text-muted-foreground">Silicone Tubes</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wall Breakdown Table */}
        {wallBreakdown.length > 0 && (
          <Card className="glass-card border-white/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Wall Breakdown
                </CardTitle>
                <div className="flex items-center gap-2 text-[10px]">
                  {curvedWallCount > 0 && (
                    <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-400">
                      <CircleDot className="h-2.5 w-2.5 mr-1" />
                      {curvedWallCount} Curved
                    </Badge>
                  )}
                  {slopedWallCount > 0 && (
                    <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-400">
                      {slopedWallCount} Sloped
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[200px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-[10px] h-8">Wall</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Area</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Full</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Cut</TableHead>
                      <TableHead className="text-[10px] h-8 text-right">Waste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallBreakdown.map((wall, index) => (
                      <TableRow key={wall.wallId} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-xs py-2">
                          <div className="flex items-center gap-1">
                            {wall.wallName}
                            {wall.isCurved && (
                              <CircleDot className="h-2.5 w-2.5 text-blue-400" />
                            )}
                            {wall.isSloped && (
                              <TrendingUp className="h-2.5 w-2.5 text-orange-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right text-muted-foreground">
                          {wall.area.toFixed(2)}m²
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right">
                          {wall.fullTiles}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right text-orange-400">
                          {wall.cutTiles}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right text-muted-foreground">
                          {((wall.wastageFactor - 1) * 100).toFixed(0)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Button */}
        <Button
          onClick={onExportPDF}
          disabled={isExportingPDF || wallBreakdown.length === 0}
          className="w-full btn-tech"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExportingPDF ? 'Generating PDF...' : 'Export Cut List (PDF)'}
        </Button>
      </div>
    </ScrollArea>
  );
}
