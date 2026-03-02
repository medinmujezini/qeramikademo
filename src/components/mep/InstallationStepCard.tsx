/**
 * Installation Step Card
 * 
 * Displays a single installation step with materials, tools, tips, and warnings.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Clock,
  Wrench,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  ShoppingCart,
  ExternalLink,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import type { InstallationStep, MaterialRequirement } from '@/utils/installationGuideGenerator';

// =============================================================================
// PHASE BADGE COLORS
// =============================================================================

const PHASE_COLORS: Record<string, string> = {
  preparation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  'rough-in': 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  finish: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  testing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
};

const SYSTEM_COLORS: Record<string, string> = {
  'cold-water': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
  'hot-water': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  drainage: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  vent: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300',
  general: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-300',
};

// =============================================================================
// MATERIAL ROW
// =============================================================================

interface MaterialRowProps {
  material: MaterialRequirement;
  showPremium: boolean;
}

const MaterialRow: React.FC<MaterialRowProps> = ({ material, showPremium }) => {
  const option = showPremium ? material.durableOption : material.cheapestOption;
  const price = option.price * material.quantity;
  
  return (
    <tr className="border-b border-muted last:border-0">
      <td className="py-2 pr-2">
        <div className="font-medium text-sm">{material.name}</div>
        <div className="text-xs text-muted-foreground">{material.specification}</div>
      </td>
      <td className="py-2 px-2 text-center text-sm">
        {material.quantity} {material.unit}
      </td>
      <td className="py-2 px-2 text-right">
        <div className="text-sm font-medium">€{price.toFixed(2)}</div>
        <div className="text-xs text-muted-foreground">{option.brand}</div>
      </td>
      <td className="py-2 pl-2">
        {option.purchaseUrl ? (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
            <a href={option.purchaseUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{option.supplier}</span>
        )}
      </td>
    </tr>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface InstallationStepCardProps {
  step: InstallationStep;
  isComplete?: boolean;
  onToggleComplete?: () => void;
  onAskAboutStep?: (stepId: string) => void;
}

export const InstallationStepCard: React.FC<InstallationStepCardProps> = ({
  step,
  isComplete = false,
  onToggleComplete,
  onAskAboutStep,
}) => {
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  
  const totalCheapest = step.materials.reduce(
    (sum, m) => sum + m.cheapestOption.price * m.quantity,
    0
  );
  const totalPremium = step.materials.reduce(
    (sum, m) => sum + m.durableOption.price * m.quantity,
    0
  );
  
  return (
    <Card className={`transition-all ${isComplete ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                Step {step.order}
              </Badge>
              <Badge className={`text-xs ${PHASE_COLORS[step.phase]}`}>
                {step.phase}
              </Badge>
              <Badge className={`text-xs ${SYSTEM_COLORS[step.system]}`}>
                {step.system.replace('-', ' ')}
              </Badge>
            </div>
            <CardTitle className="text-base leading-tight flex items-center gap-2">
              {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
              {step.title}
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1"
              onClick={() => onAskAboutStep?.(step.id)}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ask AI
            </Button>
            {onToggleComplete && (
              <Button
                size="sm"
                variant={isComplete ? 'secondary' : 'outline'}
                className="h-8"
                onClick={onToggleComplete}
              >
                {isComplete ? 'Done' : 'Mark Done'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>
        
        {/* Time Estimate */}
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{step.estimatedTime}</span>
        </div>
        
        {/* Routing Reason */}
        {step.routingReason && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Why This Routing
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  {step.routingReason}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Materials */}
        {step.materials.length > 0 && (
          <Collapsible open={materialsOpen} onOpenChange={setMaterialsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Materials ({step.materials.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  €{(showPremium ? totalPremium : totalCheapest).toFixed(2)}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${materialsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Price tier:</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={!showPremium ? 'secondary' : 'ghost'}
                      className="h-6 text-xs"
                      onClick={() => setShowPremium(false)}
                    >
                      Budget
                    </Button>
                    <Button
                      size="sm"
                      variant={showPremium ? 'secondary' : 'ghost'}
                      className="h-6 text-xs"
                      onClick={() => setShowPremium(true)}
                    >
                      Premium
                    </Button>
                  </div>
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 px-2 text-center font-medium">Qty</th>
                      <th className="pb-2 px-2 text-right font-medium">Price</th>
                      <th className="pb-2 pl-2 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {step.materials.map((mat) => (
                      <MaterialRow key={mat.id} material={mat} showPremium={showPremium} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium">
                      <td className="pt-2">Total</td>
                      <td></td>
                      <td className="pt-2 text-right">
                        €{(showPremium ? totalPremium : totalCheapest).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Tools */}
        {step.tools.length > 0 && (
          <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Tools Required ({step.tools.length})
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 border rounded-lg">
                <ul className="grid grid-cols-2 gap-1">
                  {step.tools.map((tool, idx) => (
                    <li key={idx} className="text-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Tips */}
        {step.tips.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
              <Lightbulb className="h-4 w-4" />
              Pro Tips
            </div>
            <ul className="space-y-1">
              {step.tips.map((tip, idx) => (
                <li key={idx} className="text-sm pl-6 relative before:content-['✓'] before:absolute before:left-0 before:text-green-500">
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Warnings */}
        {step.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
              <AlertTriangle className="h-4 w-4" />
              Warnings
            </div>
            <ul className="space-y-1">
              {step.warnings.map((warning, idx) => (
                <li key={idx} className="text-sm text-destructive/90 pl-6 relative before:content-['⚠'] before:absolute before:left-0">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Code References */}
        {step.codeReferences.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">References:</span>
            {step.codeReferences.map((ref, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {ref}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
