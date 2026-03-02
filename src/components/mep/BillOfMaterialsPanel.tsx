/**
 * Bill of Materials Panel
 * 
 * Displays calculated material quantities, costs, and allows export.
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Package,
  Wrench,
  CircleDollarSign,
  Ruler
} from 'lucide-react';
import type { MEPRoute, MEPFixture, MEPNode } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';
import { 
  generateBillOfMaterials, 
  downloadBOMAsCSV,
  type BOMSummary,
  type MaterialItem 
} from '@/utils/mepBillOfMaterials';

interface BillOfMaterialsPanelProps {
  routes: MEPRoute[];
  fixtures: MEPFixture[];
  nodes: MEPNode[];
}

export function BillOfMaterialsPanel({
  routes,
  fixtures,
  nodes,
}: BillOfMaterialsPanelProps) {
  const bom = useMemo(() => 
    generateBillOfMaterials(routes, fixtures, nodes),
    [routes, fixtures, nodes]
  );

  const handleExportCSV = () => {
    downloadBOMAsCSV(bom);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const categoryColors: Record<string, string> = {
    pipe: 'bg-blue-500/20 text-blue-400',
    fitting: 'bg-purple-500/20 text-purple-400',
    fixture: 'bg-green-500/20 text-green-400',
    accessory: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Bill of Materials
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden p-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard
            icon={<Ruler className="h-4 w-4" />}
            label="Total Pipe"
            value={`${bom.totalPipeLength.toFixed(1)} ft`}
          />
          <SummaryCard
            icon={<Wrench className="h-4 w-4" />}
            label="Fittings"
            value={bom.totalFittings.toString()}
          />
          <SummaryCard
            icon={<Package className="h-4 w-4" />}
            label="Fixtures"
            value={bom.totalFixtures.toString()}
          />
          <SummaryCard
            icon={<CircleDollarSign className="h-4 w-4" />}
            label="Est. Total"
            value={formatCurrency(bom.grandTotal)}
            highlight
          />
        </div>

        {/* Items Table */}
        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>System</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{item.name}</div>
                      {item.size > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {item.size}" {item.material}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={categoryColors[item.category]}>
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span 
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: SYSTEM_COLORS[item.systemType] }}
                    />
                    {formatSystemName(item.systemType)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.totalCost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Cost Summary */}
        <div className="border rounded-md p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Materials Subtotal</span>
            <span>{formatCurrency(bom.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated Labor</span>
            <span>{formatCurrency(bom.laborEstimate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Contingency (15%)</span>
            <span>{formatCurrency(bom.contingency)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Grand Total</span>
            <span className="text-primary">{formatCurrency(bom.grandTotal)}</span>
          </div>
        </div>

        {/* System Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          {Object.entries(bom.bySystem)
            .filter(([_, data]) => data.pipeLength > 0 || data.fittings > 0)
            .map(([system, data]) => (
              <div 
                key={system} 
                className="flex items-center gap-2 p-2 rounded border"
              >
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: SYSTEM_COLORS[system as keyof typeof SYSTEM_COLORS] }}
                />
                <div className="flex-1">
                  <div className="font-medium">{formatSystemName(system as any)}</div>
                  <div className="text-muted-foreground">
                    {data.pipeLength.toFixed(0)}ft • {data.fittings} fittings
                  </div>
                </div>
                <div className="text-right font-medium">
                  {formatCurrency(data.cost)}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({ 
  icon, 
  label, 
  value, 
  highlight = false 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'bg-primary/10 border-primary/30' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function formatSystemName(systemType: string): string {
  const names: Record<string, string> = {
    'cold-water': 'Cold Water',
    'hot-water': 'Hot Water',
    'drainage': 'Drainage',
    'vent': 'Vent',
    'power': 'Power',
    'dedicated': 'Dedicated',
    'lighting': 'Lighting',
  };
  return names[systemType] || systemType;
}

export default BillOfMaterialsPanel;
