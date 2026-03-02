/**
 * Inspection Report Panel
 * 
 * Visual inspection checklist with pass/fail icons and code references.
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  ChevronDown,
  FileText,
  RefreshCw
} from 'lucide-react';
import type { MEPFixture, MEPRoute, MEPNode } from '@/types/mep';
import { 
  runFullInspection, 
  formatInspectionReport,
  type InspectionResult, 
  type InspectionViolation,
  type ViolationCategory 
} from '@/utils/mepInspectionValidator';

interface InspectionReportPanelProps {
  fixtures: MEPFixture[];
  routes: MEPRoute[];
  nodes: MEPNode[];
  onViolationClick?: (violation: InspectionViolation) => void;
}

const CATEGORY_LABELS: Record<ViolationCategory, string> = {
  slope: 'Drainage Slopes',
  vent: 'Venting',
  cleanout: 'Cleanouts',
  trap: 'Traps',
  size: 'Pipe Sizing',
  clearance: 'Clearances',
  connection: 'Connections',
  valve: 'Valves',
  code: 'Code Compliance',
};

const SEVERITY_ICONS = {
  critical: <XCircle className="h-4 w-4 text-red-500" />,
  error: <XCircle className="h-4 w-4 text-orange-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

export function InspectionReportPanel({
  fixtures,
  routes,
  nodes,
  onViolationClick,
}: InspectionReportPanelProps) {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const handleRunInspection = useCallback(() => {
    setIsRunning(true);
    // Small delay for UI feedback
    setTimeout(() => {
      const inspectionResult = runFullInspection(fixtures, routes, nodes);
      setResult(inspectionResult);
      setIsRunning(false);
      // Auto-expand categories with violations
      const categoriesWithIssues = new Set(
        [...inspectionResult.violations, ...inspectionResult.warnings].map(v => v.category)
      );
      setExpandedCategories(categoriesWithIssues);
    }, 100);
  }, [fixtures, routes, nodes]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleExport = useCallback(() => {
    if (!result) return;
    const report = formatInspectionReport(result);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mep-inspection-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Inspection Report
          </CardTitle>
          <div className="flex gap-2">
            {result && (
              <Button size="sm" variant="outline" onClick={handleExport}>
                Export
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={handleRunInspection}
              disabled={isRunning || fixtures.length === 0}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running...' : 'Run Inspection'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        {!result ? (
          <div className="h-full flex items-center justify-center text-muted-foreground p-4">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Run inspection to check code compliance</p>
              <p className="text-xs mt-1">Validates slopes, vents, traps, sizing, and more</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Score Card */}
              <div className={`p-4 rounded-lg ${result.passed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {result.passed ? (
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    ) : (
                      <XCircle className="h-8 w-8 text-red-500" />
                    )}
                    <div>
                      <div className="font-bold text-lg">
                        {result.passed ? 'PASSED' : 'FAILED'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Score: {result.score}/100
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-red-500">{result.summary.criticalCount} Critical</div>
                    <div className="text-orange-500">{result.summary.errorCount} Errors</div>
                    <div className="text-yellow-500">{result.summary.warningCount} Warnings</div>
                  </div>
                </div>
              </div>

              {/* Checks by Category */}
              <div className="space-y-2">
                {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                  const categoryViolations = [...result.violations, ...result.warnings]
                    .filter(v => v.category === category);
                  const hasIssues = categoryViolations.length > 0;
                  const hasCritical = categoryViolations.some(v => v.severity === 'critical');
                  
                  return (
                    <Collapsible
                      key={category}
                      open={expandedCategories.has(category)}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className={`flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 ${hasIssues ? 'bg-muted/30' : ''}`}>
                          <div className="flex items-center gap-2">
                            {hasCritical ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : hasIssues ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-sm font-medium">{label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {categoryViolations.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {categoryViolations.length}
                              </Badge>
                            )}
                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedCategories.has(category) ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        {categoryViolations.length === 0 ? (
                          <div className="pl-8 py-2 text-sm text-green-600">
                            ✓ All checks passed
                          </div>
                        ) : (
                          <div className="pl-4 space-y-1 py-2">
                            {categoryViolations.map((violation) => (
                              <div
                                key={violation.id}
                                className="p-2 rounded bg-muted/30 cursor-pointer hover:bg-muted/50"
                                onClick={() => onViolationClick?.(violation)}
                              >
                                <div className="flex items-start gap-2">
                                  {SEVERITY_ICONS[violation.severity]}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">{violation.title}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {violation.message}
                                    </div>
                                    {violation.codeReference && (
                                      <Badge variant="outline" className="text-[10px] mt-1">
                                        {violation.codeReference}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default InspectionReportPanel;
