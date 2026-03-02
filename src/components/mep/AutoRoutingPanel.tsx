/**
 * Auto-Routing Control Panel
 * 
 * Provides UI controls for the stack-centric MEP auto-routing engine.
 * Routes fixtures to vertical drain/vent stacks with short horizontal branches.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Route, 
  Trash2, 
  Settings2, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Zap,
  ArrowDown,
  Info
} from 'lucide-react';
import type { MEPRoute, MEPFixture, MEPNode } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';
import { autoRouteAllFixturesStackCentric, type StackRoutingResult } from '@/utils/mepStackRouting';

interface AutoRoutingPanelProps {
  fixtures: MEPFixture[];
  nodes: MEPNode[];
  routes: MEPRoute[];
  walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  canvasWidth: number;
  canvasHeight: number;
  ceilingHeight?: number;  // For ceiling-mounted water heater routing
  onRoutesGenerated: (routes: MEPRoute[]) => void;
  onClearRoutes: () => void;
}

export function AutoRoutingPanel({
  fixtures,
  nodes,
  routes,
  walls,
  canvasWidth,
  canvasHeight,
  ceilingHeight = 280,
  onRoutesGenerated,
  onClearRoutes,
}: AutoRoutingPanelProps) {
  const [isRouting, setIsRouting] = useState(false);
  const [lastResult, setLastResult] = useState<StackRoutingResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [preferWallFollowing, setPreferWallFollowing] = useState(true);
  
  // Count stacks
  const drainStacks = nodes.filter(n => n.type === 'drain-stack' || n.type === 'wet-vent-stack').length;
  const ventStacks = nodes.filter(n => n.type === 'vent-stack').length;
  
  const handleAutoRoute = async () => {
    setIsRouting(true);
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = autoRouteAllFixturesStackCentric(
      fixtures,
      nodes,
      [],  // Start fresh
      {
        canvasWidth,
        canvasHeight,
        walls,
        preferWallFollowing,
        ceilingHeight,  // Pass ceiling height for ceiling-mounted water heaters
      }
    );
    
    setLastResult(result);
    onRoutesGenerated(result.routes);
    setIsRouting(false);
  };
  
  const handleClear = () => {
    onClearRoutes();
    setLastResult(null);
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Route className="h-4 w-4" />
          Stack-Centric Routing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted rounded-md p-2">
            <div className="text-muted-foreground">Fixtures</div>
            <div className="font-medium">{fixtures.length}</div>
          </div>
          <div className="bg-muted rounded-md p-2">
            <div className="text-muted-foreground">Routes</div>
            <div className="font-medium">{routes.length}</div>
          </div>
          <div className="bg-muted rounded-md p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <ArrowDown className="h-3 w-3" />
              Drain Stacks
            </div>
            <div className="font-medium">{drainStacks}</div>
          </div>
          <div className="bg-muted rounded-md p-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <ArrowDown className="h-3 w-3 rotate-180" />
              Vent Stacks
            </div>
            <div className="font-medium">{ventStacks}</div>
          </div>
        </div>
        
        {/* Stack info & settings */}
        {showSettings && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <strong>Stack-Centric Routing:</strong>
                  <ul className="mt-1 space-y-1 list-disc list-inside text-blue-200/80">
                    <li>Fixtures connect to nearest vertical stack</li>
                    <li>Short horizontal branches with slope</li>
                    <li>Vertical drops via sanitary tees</li>
                    <li>Vents rise above flood rim first</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Wall-following toggle */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="wall-following" className="text-xs">
                Wall-following routes
              </Label>
              <Switch
                id="wall-following"
                checked={preferWallFollowing}
                onCheckedChange={setPreferWallFollowing}
                className="scale-75"
              />
            </div>
          </div>
        )}
        
        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleAutoRoute}
            disabled={isRouting || fixtures.length === 0}
          >
            {isRouting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Routing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-1" />
                Route to Stacks
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={routes.length === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Result messages */}
        {lastResult && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              {lastResult.failureCount === 0 ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  All routes successful
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {lastResult.failureCount} failed
                </Badge>
              )}
              <span className="text-muted-foreground">
                {lastResult.successCount} / {lastResult.successCount + lastResult.failureCount}
              </span>
            </div>
            
            <ScrollArea className="h-24">
              <div className="space-y-1">
                {lastResult.messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`text-xs ${
                      msg.startsWith('✓') 
                        ? 'text-green-600' 
                        : msg.startsWith('✗') 
                        ? 'text-red-500' 
                        : 'text-muted-foreground'
                    }`}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Route priority legend */}
        <div className="text-xs text-muted-foreground">
          <div className="font-medium mb-1">Routing priority:</div>
          <div className="flex flex-wrap gap-1">
            {[
              { type: 'drainage', label: '1. Drain' },
              { type: 'vent', label: '2. Vent' },
              { type: 'hot-water', label: '3. Hot' },
              { type: 'cold-water', label: '4. Cold' },
              { type: 'power', label: '5. Power' },
            ].map(({ type, label }) => (
              <Badge
                key={type}
                variant="outline"
                className="text-[10px] px-1"
                style={{ 
                  borderColor: SYSTEM_COLORS[type as keyof typeof SYSTEM_COLORS],
                  color: SYSTEM_COLORS[type as keyof typeof SYSTEM_COLORS],
                }}
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
