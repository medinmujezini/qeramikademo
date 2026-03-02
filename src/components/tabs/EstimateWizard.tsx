/**
 * Estimate Wizard - Smart Category-Based Cost Estimation
 * 
 * A step-by-step wizard that guides users through cost estimation
 * with smart detection of missing data and category breakdowns.
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Building2, Sofa, Grid3X3, Droplets, Calculator,
  ArrowLeft, ArrowRight, Download, Printer, CheckCircle,
  AlertTriangle, Info, FileDown
} from 'lucide-react';
import { useMEPContext } from '@/contexts/MEPContext';
import { useFurnitureContext } from '@/contexts/FurnitureContext';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { generateBillOfMaterials, downloadBOMAsCSV, type BOMSummary } from '@/utils/mepBillOfMaterials';
import { FURNITURE_TEMPLATES } from '@/data/furnitureLibrary';

// =============================================================================
// TYPES
// =============================================================================

type EstimateCategory = 'building' | 'furniture' | 'tiles' | 'plumbing' | 'total';

interface CategoryConfig {
  id: EstimateCategory;
  name: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'building',
    name: 'Building Materials',
    icon: <Building2 className="h-6 w-6" />,
    description: 'Walls, floors, doors, windows',
    color: 'text-slate-600',
  },
  {
    id: 'furniture',
    name: 'Furniture',
    icon: <Sofa className="h-6 w-6" />,
    description: 'Sofas, beds, tables, chairs',
    color: 'text-amber-600',
  },
  {
    id: 'tiles',
    name: 'Tiles',
    icon: <Grid3X3 className="h-6 w-6" />,
    description: 'Wall and floor tiles',
    color: 'text-emerald-600',
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: <Droplets className="h-6 w-6" />,
    description: 'Pipes, fixtures, fittings',
    color: 'text-blue-600',
  },
  {
    id: 'total',
    name: 'Total Estimate',
    icon: <Calculator className="h-6 w-6" />,
    description: 'Complete project cost',
    color: 'text-primary',
  },
];

// Rough furniture prices
const FURNITURE_PRICES: Record<string, number> = {
  'sofa-2seat': 800,
  'sofa-3seat': 1200,
  'armchair': 450,
  'coffee-table': 250,
  'tv-stand': 300,
  'bookshelf': 200,
  'bed-single': 400,
  'bed-double': 600,
  'bed-queen': 800,
  'bed-king': 1000,
  'nightstand': 150,
  'dresser': 400,
  'wardrobe': 700,
  'dining-table-4': 500,
  'dining-table-6': 750,
  'dining-chair': 120,
  'desk': 350,
  'office-chair': 250,
  'filing-cabinet': 180,
  'storage-cabinet': 220,
  'shoe-rack': 100,
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface CategoryCardProps {
  config: CategoryConfig;
  isSelected: boolean;
  quickValue: string | null;
  status: 'ready' | 'partial' | 'empty';
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  config,
  isSelected,
  quickValue,
  status,
  onClick,
}) => {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{config.name}</h3>
              {status === 'ready' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {status === 'partial' && (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{config.description}</p>
            {quickValue && (
              <p className="text-lg font-bold mt-1">{quickValue}</p>
            )}
            {status === 'empty' && (
              <Badge variant="outline" className="mt-1 text-xs">
                No data
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface MissingDataPromptProps {
  title: string;
  description: string;
  linkTo: string;
  linkText: string;
  onQuickEstimate?: () => void;
}

const MissingDataPrompt = React.forwardRef<HTMLDivElement, MissingDataPromptProps>(
  ({ title, description, linkTo, linkText, onQuickEstimate }, ref) => {
    return (
      <Card ref={ref} className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                {title}
              </h3>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
                {description}
              </p>
              <div className="flex gap-2 mt-4">
                <Button asChild>
                  <Link to={linkTo}>
                    {linkText}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                {onQuickEstimate && (
                  <Button variant="outline" onClick={onQuickEstimate}>
                    Quick Estimate
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
MissingDataPrompt.displayName = 'MissingDataPrompt';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const EstimateWizard: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<EstimateCategory | null>(null);
  
  const { fixtures, routes, nodes } = useMEPContext();
  const { furniture } = useFurnitureContext();
  const { floorPlan } = useFloorPlanContext();

  // Calculate estimates
  const plumbingBOM = useMemo(() => {
    return generateBillOfMaterials(routes, fixtures, nodes);
  }, [routes, fixtures, nodes]);

  const furnitureEstimate = useMemo(() => {
    let total = 0;
    const items = furniture.map(f => {
      const price = FURNITURE_PRICES[f.type] || 200;
      total += price;
      return { ...f, price };
    });
    return { items, total };
  }, [furniture]);

  const tilesEstimate = useMemo(() => {
    // Rough tile estimate based on number of sections
    const sectionCount = floorPlan.tileSections.length;
    const avgAreaPerSection = 50; // sq ft estimate
    const totalArea = sectionCount * avgAreaPerSection;
    const totalCost = totalArea * 10; // $10/sqft estimate
    
    return { totalArea, totalCost };
  }, [floorPlan.tileSections]);

  const buildingEstimate = useMemo(() => {
    const wallCount = floorPlan.walls.length;
    const doorCount = floorPlan.doors.length;
    const windowCount = floorPlan.windows.length;
    
    // Very rough estimates
    const wallCost = wallCount * 500;
    const doorCost = doorCount * 350;
    const windowCost = windowCount * 450;
    
    return {
      walls: { count: wallCount, cost: wallCost },
      doors: { count: doorCount, cost: doorCost },
      windows: { count: windowCount, cost: windowCost },
      total: wallCost + doorCost + windowCost,
    };
  }, [floorPlan.walls, floorPlan.doors, floorPlan.windows]);

  // Get status for each category
  const getStatus = (category: EstimateCategory): 'ready' | 'partial' | 'empty' => {
    switch (category) {
      case 'building':
        return floorPlan.walls.length > 0 ? 'ready' : 'empty';
      case 'furniture':
        return furniture.length > 0 ? 'ready' : 'empty';
      case 'tiles':
        return floorPlan.tileSections.length > 0 ? 'ready' : 'empty';
      case 'plumbing':
        if (routes.length > 0) return 'ready';
        if (fixtures.length > 0) return 'partial';
        return 'empty';
      case 'total':
        return 'ready';
    }
  };

  // Get quick value for each category
  const getQuickValue = (category: EstimateCategory): string | null => {
    const formatCurrency = (n: number) => `$${n.toLocaleString()}`;
    switch (category) {
      case 'building':
        return buildingEstimate.total > 0 ? formatCurrency(buildingEstimate.total) : null;
      case 'furniture':
        return furnitureEstimate.total > 0 ? formatCurrency(furnitureEstimate.total) : null;
      case 'tiles':
        return tilesEstimate.totalCost > 0 ? formatCurrency(tilesEstimate.totalCost) : null;
      case 'plumbing':
        return plumbingBOM.grandTotal > 0 ? formatCurrency(plumbingBOM.grandTotal) : null;
      case 'total':
        const total = buildingEstimate.total + furnitureEstimate.total + 
                      tilesEstimate.totalCost + plumbingBOM.grandTotal;
        return formatCurrency(total);
    }
  };

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  const handleExportCSV = () => {
    downloadBOMAsCSV(plumbingBOM, 'project-estimate.csv');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  // Render category selection
  if (!selectedCategory) {
    return (
      <div className="h-full p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">Project Estimate</h1>
            <p className="text-muted-foreground">
              Select a category to see detailed cost breakdown
            </p>
          </div>

          {/* Category cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => (
              <CategoryCard
                key={category.id}
                config={category}
                isSelected={false}
                quickValue={getQuickValue(category.id)}
                status={getStatus(category.id)}
                onClick={() => setSelectedCategory(category.id)}
              />
            ))}
          </div>

          {/* Quick summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quick Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Walls</p>
                  <p className="text-lg font-semibold">{floorPlan.walls.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Furniture</p>
                  <p className="text-lg font-semibold">{furniture.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fixtures</p>
                  <p className="text-lg font-semibold">{fixtures.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plumbing Routes</p>
                  <p className="text-lg font-semibold">{routes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render category detail
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex-1">
          <h2 className="font-semibold">
            {CATEGORIES.find(c => c.id === selectedCategory)?.name}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* Content based on category */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Building Materials */}
          {selectedCategory === 'building' && (
            <>
              {floorPlan.walls.length === 0 ? (
                <MissingDataPrompt
                  title="No Floor Plan Created"
                  description="Create a floor plan first to estimate building materials cost."
                  linkTo="/?tab=floor-plan"
                  linkText="Create Floor Plan"
                />
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Building Materials Estimate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead className="text-right">Est. Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>Walls (labor + materials)</TableCell>
                            <TableCell>{buildingEstimate.walls.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(buildingEstimate.walls.cost)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Doors (installed)</TableCell>
                            <TableCell>{buildingEstimate.doors.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(buildingEstimate.doors.cost)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>Windows (installed)</TableCell>
                            <TableCell>{buildingEstimate.windows.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(buildingEstimate.windows.cost)}</TableCell>
                          </TableRow>
                          <TableRow className="font-bold">
                            <TableCell>Total</TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right">{formatCurrency(buildingEstimate.total)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {/* Furniture */}
          {selectedCategory === 'furniture' && (
            <>
              {furniture.length === 0 ? (
                <MissingDataPrompt
                  title="No Furniture Added"
                  description="Add furniture to your design to see cost estimates."
                  linkTo="/?tab=design"
                  linkText="Add Furniture"
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Furniture Cost Estimate</CardTitle>
                    <CardDescription>{furniture.length} items</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Est. Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {furnitureEstimate.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="capitalize">{item.category}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">{formatCurrency(furnitureEstimate.total)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Tiles */}
          {selectedCategory === 'tiles' && (
            <>
              {floorPlan.tileSections.length === 0 ? (
                <MissingDataPrompt
                  title="No Tiles Configured"
                  description="Add tiles to walls in the Tiles tab to see cost estimates."
                  linkTo="/?tab=tiles"
                  linkText="Configure Tiles"
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Tile Cost Estimate</CardTitle>
                    <CardDescription>{floorPlan.tileSections.length} tile sections</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Area</p>
                          <p className="text-2xl font-bold">~{tilesEstimate.totalArea} sq ft</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Estimated Cost</p>
                          <p className="text-2xl font-bold">{formatCurrency(tilesEstimate.totalCost)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        * Based on average tile cost of $10/sq ft. Actual cost varies by tile type.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Plumbing */}
          {selectedCategory === 'plumbing' && (
            <>
              {routes.length === 0 && fixtures.length === 0 ? (
                <MissingDataPrompt
                  title="No Plumbing Configured"
                  description="Add fixtures and plumbing routes to estimate plumbing costs."
                  linkTo="/?tab=design"
                  linkText="Add Fixtures"
                />
              ) : routes.length === 0 ? (
                <MissingDataPrompt
                  title="Plumbing Routes Needed"
                  description={`You have ${fixtures.length} fixture(s) but no plumbing routes. Connect them to get accurate estimates.`}
                  linkTo="/?tab=plumbing"
                  linkText="Set Up Plumbing"
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Plumbing Cost Estimate</CardTitle>
                    <CardDescription>
                      {fixtures.length} fixtures, {routes.length} routes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Pipe</p>
                          <p className="text-xl font-bold">{plumbingBOM.totalPipeLength} ft</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Fittings</p>
                          <p className="text-xl font-bold">{plumbingBOM.totalFittings}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Fixtures</p>
                          <p className="text-xl font-bold">{plumbingBOM.totalFixtures}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Grand Total</p>
                          <p className="text-xl font-bold">{formatCurrency(plumbingBOM.grandTotal)}</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Materials Subtotal</span>
                          <span>{formatCurrency(plumbingBOM.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Labor Estimate</span>
                          <span>{formatCurrency(plumbingBOM.laborEstimate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Contingency (15%)</span>
                          <span>{formatCurrency(plumbingBOM.contingency)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Grand Total</span>
                          <span>{formatCurrency(plumbingBOM.grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Total */}
          {selectedCategory === 'total' && (
            <Card>
              <CardHeader>
                <CardTitle>Total Project Estimate</CardTitle>
                <CardDescription>Combined costs from all categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Building Materials
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatus('building') === 'ready' ? 'default' : 'secondary'}>
                            {getStatus('building')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(buildingEstimate.total)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="flex items-center gap-2">
                          <Sofa className="h-4 w-4" />
                          Furniture
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatus('furniture') === 'ready' ? 'default' : 'secondary'}>
                            {getStatus('furniture')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(furnitureEstimate.total)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="flex items-center gap-2">
                          <Grid3X3 className="h-4 w-4" />
                          Tiles
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatus('tiles') === 'ready' ? 'default' : 'secondary'}>
                            {getStatus('tiles')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(tilesEstimate.totalCost)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="flex items-center gap-2">
                          <Droplets className="h-4 w-4" />
                          Plumbing
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatus('plumbing') === 'ready' ? 'default' : 'secondary'}>
                            {getStatus('plumbing')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(plumbingBOM.grandTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <Separator />

                  <div className="flex justify-between text-xl font-bold">
                    <span>Grand Total</span>
                    <span>
                      {formatCurrency(
                        buildingEstimate.total + 
                        furnitureEstimate.total + 
                        tilesEstimate.totalCost + 
                        plumbingBOM.grandTotal
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    * These are rough estimates. Actual costs may vary based on location, materials, and labor rates.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
