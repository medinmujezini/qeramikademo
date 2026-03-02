/**
 * Installation Guide Panel
 * 
 * Displays comprehensive installation instructions for the plumbing system.
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  BookOpen,
  FileDown,
  ShoppingCart,
  AlertTriangle,
  Clock,
  Euro,
  Package,
  X,
  Printer,
} from 'lucide-react';
import type { MEPFixture, MEPNode, MEPRoute } from '@/types/mep';
import { generateInstallationGuide, type InstallationGuide, type CommonMistake } from '@/utils/installationGuideGenerator';
import { InstallationStepCard } from './InstallationStepCard';

// =============================================================================
// COMMON MISTAKES SECTION
// =============================================================================

interface CommonMistakeCardProps {
  mistake: CommonMistake;
}

const CommonMistakeCard: React.FC<CommonMistakeCardProps> = ({ mistake }) => (
  <div className="p-3 rounded-lg border bg-card">
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-sm">{mistake.mistake}</p>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>Impact:</strong> {mistake.impact}
        </p>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          <strong>Prevention:</strong> {mistake.prevention}
        </p>
        {mistake.codeRef && (
          <Badge variant="outline" className="text-xs mt-2">
            {mistake.codeRef}
          </Badge>
        )}
      </div>
    </div>
  </div>
);

// =============================================================================
// MATERIALS SUMMARY
// =============================================================================

interface MaterialsSummaryProps {
  guide: InstallationGuide;
}

const MaterialsSummary: React.FC<MaterialsSummaryProps> = ({ guide }) => {
  const [showPremium, setShowPremium] = useState(false);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Complete Materials List</h3>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={!showPremium ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setShowPremium(false)}
          >
            Budget
          </Button>
          <Button
            size="sm"
            variant={showPremium ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setShowPremium(true)}
          >
            Premium
          </Button>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left font-medium">Item</th>
              <th className="p-2 text-center font-medium">Qty</th>
              <th className="p-2 text-right font-medium">Unit Price</th>
              <th className="p-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {guide.materialsSummary.map((mat) => {
              const option = showPremium ? mat.durableOption : mat.cheapestOption;
              return (
                <tr key={mat.id} className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{mat.name}</div>
                    <div className="text-xs text-muted-foreground">{mat.specification}</div>
                    <div className="text-xs text-muted-foreground">{option.brand} • {option.supplier}</div>
                  </td>
                  <td className="p-2 text-center">{mat.quantity} {mat.unit}</td>
                  <td className="p-2 text-right">€{option.price.toFixed(2)}</td>
                  <td className="p-2 text-right font-medium">
                    €{(option.price * mat.quantity).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted font-semibold">
            <tr>
              <td colSpan={3} className="p-2 text-right">Total:</td>
              <td className="p-2 text-right">
                €{(showPremium ? guide.totalCostPremium : guide.totalCostBudget).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Prices are estimates from European suppliers</span>
        <span>+10% contingency recommended</span>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN PANEL
// =============================================================================

interface InstallationGuidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  fixtures: MEPFixture[];
  nodes: MEPNode[];
  routes: MEPRoute[];
  projectName?: string;
  onAskAboutStep?: (stepId: string) => void;
}

export const InstallationGuidePanel: React.FC<InstallationGuidePanelProps> = ({
  isOpen,
  onClose,
  fixtures,
  nodes,
  routes,
  projectName = 'Plumbing Project',
  onAskAboutStep,
}) => {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  
  // Generate guide from MEP data
  const guide = useMemo(() => {
    return generateInstallationGuide(fixtures, routes, nodes, projectName);
  }, [fixtures, routes, nodes, projectName]);
  
  const toggleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };
  
  const allSteps = useMemo(() => [
    ...guide.phases.preparation,
    ...guide.phases.roughIn,
    ...guide.phases.finish,
    ...guide.phases.testing,
  ], [guide]);
  
  const completionPercent = Math.round((completedSteps.size / allSteps.length) * 100);
  
  // Print function
  const handlePrint = () => {
    window.print();
  };
  
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[600px] sm:w-[700px] sm:max-w-[700px] p-0">
        <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Installation Guide</h2>
            <p className="text-xs text-muted-foreground">{projectName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="p-4 border-b shrink-0">
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Est. Time</p>
                <p className="font-semibold text-sm">{guide.totalEstimatedTime}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="font-semibold text-sm">€{guide.totalCostBudget.toFixed(0)}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Materials</p>
                <p className="font-semibold text-sm">{guide.materialsSummary.length} items</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div 
                className="h-4 w-4 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                style={{ 
                  borderColor: completionPercent === 100 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  color: completionPercent === 100 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                }}
              >
                ✓
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="font-semibold text-sm">{completionPercent}%</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs defaultValue="steps" className="flex-1 flex flex-col min-h-0">
        <div className="border-b px-4 shrink-0">
          <TabsList className="h-10">
            <TabsTrigger value="steps" className="text-sm">
              Installation Steps ({allSteps.length})
            </TabsTrigger>
            <TabsTrigger value="materials" className="text-sm">
              Materials List
            </TabsTrigger>
            <TabsTrigger value="mistakes" className="text-sm">
              Common Mistakes ({guide.commonMistakes.length})
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="steps" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Preparation Phase */}
              {guide.phases.preparation.length > 0 && (
                <section>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800">Phase 1</Badge>
                    Preparation
                  </h3>
                  <div className="space-y-3">
                    {guide.phases.preparation.map((step) => (
                      <InstallationStepCard
                        key={step.id}
                        step={step}
                        isComplete={completedSteps.has(step.id)}
                        onToggleComplete={() => toggleStepComplete(step.id)}
                        onAskAboutStep={onAskAboutStep}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Rough-In Phase */}
              {guide.phases.roughIn.length > 0 && (
                <section>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-orange-100 text-orange-800">Phase 2</Badge>
                    Rough-In
                  </h3>
                  <div className="space-y-3">
                    {guide.phases.roughIn.map((step) => (
                      <InstallationStepCard
                        key={step.id}
                        step={step}
                        isComplete={completedSteps.has(step.id)}
                        onToggleComplete={() => toggleStepComplete(step.id)}
                        onAskAboutStep={onAskAboutStep}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Finish Phase */}
              {guide.phases.finish.length > 0 && (
                <section>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">Phase 3</Badge>
                    Finish
                  </h3>
                  <div className="space-y-3">
                    {guide.phases.finish.map((step) => (
                      <InstallationStepCard
                        key={step.id}
                        step={step}
                        isComplete={completedSteps.has(step.id)}
                        onToggleComplete={() => toggleStepComplete(step.id)}
                        onAskAboutStep={onAskAboutStep}
                      />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Testing Phase */}
              {guide.phases.testing.length > 0 && (
                <section>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-800">Phase 4</Badge>
                    Testing
                  </h3>
                  <div className="space-y-3">
                    {guide.phases.testing.map((step) => (
                      <InstallationStepCard
                        key={step.id}
                        step={step}
                        isComplete={completedSteps.has(step.id)}
                        onToggleComplete={() => toggleStepComplete(step.id)}
                        onAskAboutStep={onAskAboutStep}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="materials" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <MaterialsSummary guide={guide} />
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="mistakes" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Review these common installation mistakes before starting work. 
                Each issue can cause problems that are expensive to fix later.
              </p>
              {guide.commonMistakes.map((mistake) => (
                <CommonMistakeCard key={mistake.id} mistake={mistake} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
