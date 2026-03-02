/**
 * Node Properties Panel
 * 
 * Displays and allows editing of MEP infrastructure node properties
 * including mounting type, height, and type-specific settings.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Trash2,
  Droplets,
  Zap,
  Flame,
  Sun,
  ArrowDown,
  ArrowUp,
  Building,
  Wind,
} from 'lucide-react';
import type { MEPNode, MountingType, WaterHeaterType, FuelType, WaterHeaterProps } from '@/types/mep';
import { SYSTEM_COLORS } from '@/types/mep';

interface NodePropertiesPanelProps {
  node: MEPNode | null;
  ceilingHeight?: number;  // Room ceiling height in cm
  onUpdateNode: (id: string, updates: Partial<MEPNode>) => void;
  onDelete: () => void;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  'water-main': 'Water Main',
  'water-heater': 'Water Heater',
  'water-manifold': 'Water Manifold',
  'drain-stack': 'Drain Stack',
  'vent-stack': 'Vent Stack',
  'wet-vent-stack': 'Wet Vent Stack',
  'stack-base': 'Stack Base',
  'stack-through-roof': 'Roof Termination',
  'floor-cleanout': 'Floor Cleanout',
  'electrical-panel': 'Electrical Panel',
  'junction-box': 'Junction Box',
  'sub-panel': 'Sub Panel',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  'water-main': SYSTEM_COLORS['cold-water'],
  'water-heater': SYSTEM_COLORS['hot-water'],
  'water-manifold': SYSTEM_COLORS['cold-water'],
  'drain-stack': SYSTEM_COLORS['drainage'],
  'vent-stack': SYSTEM_COLORS['vent'],
  'wet-vent-stack': SYSTEM_COLORS['vent'],
  'stack-base': SYSTEM_COLORS['drainage'],
  'stack-through-roof': SYSTEM_COLORS['vent'],
  'floor-cleanout': SYSTEM_COLORS['drainage'],
  'electrical-panel': SYSTEM_COLORS['power'],
  'junction-box': SYSTEM_COLORS['power'],
  'sub-panel': SYSTEM_COLORS['power'],
};

const FUEL_TYPE_ICONS: Record<FuelType, React.ReactNode> = {
  electric: <Zap className="h-3 w-3" />,
  gas: <Flame className="h-3 w-3" />,
  solar: <Sun className="h-3 w-3" />,
};

export const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({
  node,
  ceilingHeight = 280,
  onUpdateNode,
  onDelete,
}) => {
  if (!node) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Node Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select a node to view its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const nodeColor = NODE_TYPE_COLORS[node.type] || 'hsl(var(--muted-foreground))';
  const isWaterHeater = node.type === 'water-heater';
  const isStack = ['drain-stack', 'vent-stack', 'wet-vent-stack'].includes(node.type);
  const isElectrical = ['electrical-panel', 'sub-panel'].includes(node.type);
  const isWaterMain = node.type === 'water-main';

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    onUpdateNode(node.id, {
      position: {
        ...node.position,
        [axis]: value,
      },
    });
  };

  const handleMountingChange = (mountingType: MountingType) => {
    onUpdateNode(node.id, { mountingType });
  };

  const handleWaterHeaterPropsChange = (updates: Partial<WaterHeaterProps>) => {
    onUpdateNode(node.id, {
      waterHeaterProps: {
        type: node.waterHeaterProps?.type || 'tank',
        capacity: node.waterHeaterProps?.capacity || 50,
        inletHeight: node.waterHeaterProps?.inletHeight || 137,
        outletHeight: node.waterHeaterProps?.outletHeight || 142,
        fuelType: node.waterHeaterProps?.fuelType || 'electric',
        ...updates,
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: nodeColor }}
            />
            <span>{node.name}</span>
          </div>
          <Badge 
            variant="outline" 
            className="text-xs"
            style={{ borderColor: nodeColor, color: nodeColor }}
          >
            {NODE_TYPE_LABELS[node.type] || node.type}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delete Action - Only for non-default nodes */}
        {!node.id.includes('-default') && (
          <>
            <Button size="sm" variant="destructive" onClick={onDelete} className="w-full">
              <Trash2 className="h-3 w-3 mr-1" />
              Delete Node
            </Button>
            <Separator />
          </>
        )}
        
        {/* Position */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Position (cm)</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">X</Label>
              <Input 
                type="number" 
                value={Math.round(node.position.x)}
                onChange={(e) => handlePositionChange('x', Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Y</Label>
              <Input 
                type="number" 
                value={Math.round(node.position.y)}
                onChange={(e) => handlePositionChange('y', Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Z (height)</Label>
              <Input 
                type="number" 
                value={Math.round(node.position.z)}
                onChange={(e) => handlePositionChange('z', Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Mounting Type */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Mounting</Label>
          <Select 
            value={node.mountingType || 'floor'} 
            onValueChange={(v) => handleMountingChange(v as MountingType)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="floor">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-3 w-3" />
                  <span>Floor Mounted</span>
                </div>
              </SelectItem>
              <SelectItem value="wall">
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3" />
                  <span>Wall Mounted</span>
                </div>
              </SelectItem>
              <SelectItem value="ceiling">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-3 w-3" />
                  <span>Ceiling Mounted</span>
                </div>
              </SelectItem>
              <SelectItem value="underground">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-3 w-3" />
                  <span>Underground</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          {/* Height from Floor (for floor/wall mounting) */}
          {(node.mountingType === 'floor' || node.mountingType === 'wall' || !node.mountingType) && (
            <div className="mt-2">
              <Label className="text-xs">Height from Floor (cm)</Label>
              <Input 
                type="number" 
                value={node.heightFromFloor ?? 0}
                onChange={(e) => onUpdateNode(node.id, { 
                  heightFromFloor: Number(e.target.value),
                  position: { ...node.position, z: Number(e.target.value) }
                })}
                className="h-8 text-sm"
              />
            </div>
          )}
          
          {/* Height from Ceiling (for ceiling mounting) */}
          {node.mountingType === 'ceiling' && (
            <div className="mt-2 space-y-1">
              <Label className="text-xs">Distance from Ceiling (cm)</Label>
              <Input 
                type="number" 
                value={node.heightFromCeiling ?? 0}
                onChange={(e) => {
                  const heightFromCeiling = Number(e.target.value);
                  const actualHeight = ceilingHeight - heightFromCeiling;
                  onUpdateNode(node.id, { 
                    heightFromCeiling,
                    position: { ...node.position, z: actualHeight }
                  });
                }}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Ceiling: {ceilingHeight}cm → Actual height: {ceilingHeight - (node.heightFromCeiling ?? 0)}cm
              </p>
            </div>
          )}
          
          {/* Floor/Ceiling Penetration */}
          <div className="flex items-center justify-between text-xs mt-2">
            <span className="text-muted-foreground">Penetrates Floor</span>
            <Switch 
              checked={node.penetratesFloor ?? false}
              onCheckedChange={(checked) => onUpdateNode(node.id, { penetratesFloor: checked })}
              className="scale-75"
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Penetrates Ceiling</span>
            <Switch 
              checked={node.penetratesCeiling ?? false}
              onCheckedChange={(checked) => {
                // If penetrating ceiling, auto-update stack top elevation
                const updates: Partial<MEPNode> = { penetratesCeiling: checked };
                if (checked && node.stackProperties) {
                  updates.stackProperties = {
                    ...node.stackProperties,
                    topElevation: ceilingHeight + 30,  // Extend 30cm through roof
                    isVentTermination: true,
                  };
                }
                onUpdateNode(node.id, updates);
              }}
              className="scale-75"
            />
          </div>
        </div>
        
        {/* Water Heater Properties */}
        {isWaterHeater && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Droplets className="h-3 w-3" style={{ color: SYSTEM_COLORS['hot-water'] }} />
                Water Heater Settings
              </Label>
              
              {/* Type */}
              <div>
                <Label className="text-xs">Type</Label>
                <Select 
                  value={node.waterHeaterProps?.type || 'tank'} 
                  onValueChange={(v) => handleWaterHeaterPropsChange({ type: v as WaterHeaterType })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tank">Tank (Storage)</SelectItem>
                    <SelectItem value="tankless">Tankless (On-Demand)</SelectItem>
                    <SelectItem value="point-of-use">Point of Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Capacity */}
              <div>
                <Label className="text-xs">
                  {node.waterHeaterProps?.type === 'tankless' ? 'Flow Rate (GPM)' : 'Capacity (Gallons)'}
                </Label>
                <Input 
                  type="number" 
                  value={node.waterHeaterProps?.capacity || 50}
                  onChange={(e) => handleWaterHeaterPropsChange({ capacity: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              
              {/* Fuel Type */}
              <div>
                <Label className="text-xs">Fuel Type</Label>
                <Select 
                  value={node.waterHeaterProps?.fuelType || 'electric'} 
                  onValueChange={(v) => handleWaterHeaterPropsChange({ fuelType: v as FuelType })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3 w-3" />
                        <span>Electric</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gas">
                      <div className="flex items-center gap-2">
                        <Flame className="h-3 w-3" />
                        <span>Gas</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="solar">
                      <div className="flex items-center gap-2">
                        <Sun className="h-3 w-3" />
                        <span>Solar</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Connection Heights */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cold Inlet (cm)</Label>
                  <Input 
                    type="number" 
                    value={node.waterHeaterProps?.inletHeight || 137}
                    onChange={(e) => handleWaterHeaterPropsChange({ inletHeight: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hot Outlet (cm)</Label>
                  <Input 
                    type="number" 
                    value={node.waterHeaterProps?.outletHeight || 142}
                    onChange={(e) => handleWaterHeaterPropsChange({ outletHeight: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              
              {/* Ceiling-mount orientation note */}
              {node.mountingType === 'ceiling' && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-xs">
                  <p className="text-amber-600 flex items-center gap-1">
                    <ArrowDown className="h-3 w-3" />
                    <span>Ceiling-mounted: Connections are on the BOTTOM. Pipes will route DOWN to fixtures.</span>
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Stack Properties */}
        {isStack && node.stackProperties && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Wind className="h-3 w-3" style={{ color: nodeColor }} />
                Stack Properties
              </Label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Bottom (cm)</Label>
                  <Input 
                    type="number" 
                    value={node.stackProperties.bottomElevation}
                    onChange={(e) => onUpdateNode(node.id, { 
                      stackProperties: { 
                        ...node.stackProperties!, 
                        bottomElevation: Number(e.target.value) 
                      } 
                    })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Top (cm)</Label>
                  <Input 
                    type="number" 
                    value={node.stackProperties.topElevation}
                    onChange={(e) => onUpdateNode(node.id, { 
                      stackProperties: { 
                        ...node.stackProperties!, 
                        topElevation: Number(e.target.value) 
                      } 
                    })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-xs">Diameter (inches)</Label>
                <Input 
                  type="number" 
                  step="0.5"
                  value={node.stackProperties.diameter}
                  onChange={(e) => onUpdateNode(node.id, { 
                    stackProperties: { 
                      ...node.stackProperties!, 
                      diameter: Number(e.target.value) 
                    } 
                  })}
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Terminates at Roof</span>
                <Switch 
                  checked={node.stackProperties.isVentTermination ?? false}
                  onCheckedChange={(checked) => onUpdateNode(node.id, { 
                    stackProperties: { 
                      ...node.stackProperties!, 
                      isVentTermination: checked 
                    } 
                  })}
                  className="scale-75"
                />
              </div>
            </div>
          </>
        )}
        
        {/* Electrical Panel Properties */}
        {isElectrical && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" style={{ color: SYSTEM_COLORS['power'] }} />
                Panel Settings
              </Label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Main Breaker (A)</Label>
                  <Input 
                    type="number" 
                    value={node.mainBreakerSize || 200}
                    onChange={(e) => onUpdateNode(node.id, { mainBreakerSize: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Circuit Slots</Label>
                  <Input 
                    type="number" 
                    value={node.circuitCount || 20}
                    onChange={(e) => onUpdateNode(node.id, { circuitCount: Number(e.target.value) })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Water Main Properties */}
        {isWaterMain && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Droplets className="h-3 w-3" style={{ color: SYSTEM_COLORS['cold-water'] }} />
                Water Main Settings
              </Label>
              
              <div>
                <Label className="text-xs">Supply Pressure (PSI)</Label>
                <Input 
                  type="number" 
                  value={node.capacity || 60}
                  onChange={(e) => onUpdateNode(node.id, { capacity: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              
              <div className="text-xs text-muted-foreground">
                Typical residential: 40-80 PSI
              </div>
            </div>
          </>
        )}
        
        {/* Connected Routes */}
        {node.connectedRouteIds.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Connected Routes ({node.connectedRouteIds.length})
              </Label>
              <div className="text-xs text-muted-foreground">
                {node.connectedRouteIds.length} route(s) connected to this node
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
