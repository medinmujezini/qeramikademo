import React, { useMemo } from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Trash2, RotateCw, ArrowUp, ArrowDown, AlertTriangle, Link2, Link2Off, Lock, Unlock, Home, Edit3 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

import type { WallMaterial, DoorType, WindowType, ColumnShape } from '@/types/floorPlan';
import { 
  SLOPE_PRESETS, 
  calculateHeightFromAngle, 
  calculateAngleFromHeights,
  detectHeightMismatches,
  getConnectedWalls
} from '@/utils/wallHeightUtils';
import { getEffectiveWallHeights, getWallSlopeRelation } from '@/utils/ceilingUtils';

const WALL_MATERIALS: { value: WallMaterial; label: string }[] = [
  { value: 'concrete', label: 'Concrete' },
  { value: 'brick', label: 'Brick' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'wood', label: 'Wood' },
];

const DOOR_TYPES: { value: DoorType; label: string }[] = [
  { value: 'hinged-left', label: 'Hinged Left' },
  { value: 'hinged-right', label: 'Hinged Right' },
  { value: 'sliding', label: 'Sliding' },
  { value: 'pocket', label: 'Pocket' },
  { value: 'double', label: 'Double' },
];

const WINDOW_TYPES: { value: WindowType; label: string }[] = [
  { value: 'casement', label: 'Casement' },
  { value: 'sliding', label: 'Sliding' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'double-hung', label: 'Double Hung' },
];

const COLUMN_SHAPES: { value: ColumnShape; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' },
  { value: 'l-shaped', label: 'L-Shaped' },
  { value: 't-shaped', label: 'T-Shaped' },
  { value: 'hexagonal', label: 'Hexagonal' },
  { value: 'octagonal', label: 'Octagonal' },
];

export const PropertiesPanel: React.FC = () => {
  const { 
    floorPlan, 
    selectedElement, 
    updateWall,
    updateWallWithSync,
    deleteWall,
    updateDoor,
    deleteDoor,
    updateWindow,
    deleteWindow,
    deleteFixture,
    rotateFixture,
    updateColumn,
    deleteColumn,
    rotateColumn,
    convertToCurved,
    convertToStraight,
    wallSyncSettings,
    setWallSyncSettings,
    ceilingPlane,
    isCeilingPlaneEnabled,
    setWallHeightMode,
    toggleEndpointLock,
    setHeightAtPoint
  } = useFloorPlanContext();

  if (!selectedElement) {
    return (
      <Card className="h-full border-border">
        <CardHeader className="py-3">
          <CardTitle className="text-sm text-muted-foreground">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Select an element to view its properties</p>
        </CardContent>
      </Card>
    );
  }

  if (selectedElement.type === 'wall') {
    const wall = floorPlan.walls.find(w => w.id === selectedElement.id);
    if (!wall) return null;

    const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
    const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
    const length = startPoint && endPoint 
      ? Math.sqrt((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2).toFixed(0)
      : 0;

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Wall Properties</CardTitle>
          <Button variant="destructive" size="icon" onClick={() => deleteWall(wall.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Length</Label>
            <p className="text-sm font-medium">{length} cm</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="thickness">Thickness (cm)</Label>
            <Input
              id="thickness"
              type="number"
              value={wall.thickness}
              onChange={(e) => updateWall(wall.id, { thickness: Number(e.target.value) })}
              min={5}
              max={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input
              id="height"
              type="number"
              value={wall.height}
              onChange={(e) => updateWall(wall.id, { height: Number(e.target.value) })}
              min={100}
              max={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Material</Label>
            <Select
              value={wall.material}
              onValueChange={(value) => updateWall(wall.id, { material: value as WallMaterial })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALL_MATERIALS.map(mat => (
                  <SelectItem key={mat.value} value={mat.value}>{mat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Curved Wall Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="curved">Curved Wall</Label>
            <Switch
              id="curved"
              checked={wall.isCurved || false}
              onCheckedChange={(checked) => {
                if (checked) {
                  convertToCurved(wall.id, 0.3);
                } else {
                  convertToStraight(wall.id);
                }
              }}
            />
          </div>

          {/* Bulge slider for curved walls */}
          {wall.isCurved && (
            <div className="space-y-2">
              <Label htmlFor="bulge">Curvature</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="bulge"
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={wall.bulge || 0}
                  onChange={(e) => updateWall(wall.id, { bulge: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs w-10 text-right">{((wall.bulge || 0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Wall Height Mode - Room vs Override */}
          {isCeilingPlaneEnabled && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {wall.heightMode === 'override' ? (
                    <Edit3 className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Home className="h-4 w-4 text-primary" />
                  )}
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Height Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      {wall.heightMode === 'override' 
                        ? 'Manual override (won\'t update with ceiling changes)'
                        : 'Following room ceiling'
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant={wall.heightMode !== 'override' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setWallHeightMode(wall.id, 'room')}
                >
                  <Home className="h-3 w-3 mr-1" />
                  Follow Ceiling
                </Button>
                <Button
                  variant={wall.heightMode === 'override' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setWallHeightMode(wall.id, 'override')}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Override
                </Button>
              </div>
              
              {wall.heightMode !== 'override' && (
                <p className="text-xs text-muted-foreground bg-primary/5 rounded p-2">
                  Heights are computed from ceiling plane. Edit height to adjust the ceiling for all walls.
                </p>
              )}
              
              {wall.heightMode === 'override' && (
                <Badge variant="secondary" className="text-xs">
                  Override active
                </Badge>
              )}
            </div>
          )}

          {/* Enhanced Sloped Wall Controls */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sloped" className="text-sm font-medium">Sloped Height</Label>
                <p className="text-xs text-muted-foreground">Different heights at each end</p>
              </div>
              <Switch
                id="sloped"
                checked={(wall.startHeight ?? wall.height) !== (wall.endHeight ?? wall.height)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    // Enable sloped: set different heights
                    updateWall(wall.id, { 
                      startHeight: wall.height, 
                      endHeight: Math.round(wall.height * 0.7),
                      slopeMode: 'height',
                      slopeDirection: 'descending'
                    });
                  } else {
                    // Reset to uniform height
                    updateWall(wall.id, { 
                      startHeight: wall.height, 
                      endHeight: wall.height,
                      slopeAngle: undefined,
                      slopeDirection: undefined,
                      slopeMode: undefined
                    });
                  }
                }}
              />
            </div>
            
            {/* Show enhanced controls when sloped is enabled */}
            {(wall.startHeight ?? wall.height) !== (wall.endHeight ?? wall.height) && (
              <div className="space-y-3 pt-2 border-t">
                {/* Auto-sync toggle */}
                <div className="flex items-center justify-between bg-background/50 rounded-md p-2">
                  <div className="flex items-center gap-1.5">
                    {wallSyncSettings.autoSyncJunctionHeights ? (
                      <Link2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Link2Off className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <Label className="text-xs">Auto-sync junctions</Label>
                  </div>
                  <Switch
                    checked={wallSyncSettings.autoSyncJunctionHeights}
                    onCheckedChange={(checked) => 
                      setWallSyncSettings(prev => ({ ...prev, autoSyncJunctionHeights: checked }))
                    }
                  />
                </div>

                {/* Connected walls info */}
                {wallSyncSettings.autoSyncJunctionHeights && (() => {
                  const connectedWalls = getConnectedWalls(wall.id, floorPlan.walls);
                  if (connectedWalls.length === 0) return null;
                  
                  return (
                    <div className="text-xs text-muted-foreground bg-primary/5 rounded-md p-2">
                      <span className="flex items-center gap-1">
                        <Link2 className="h-3 w-3" />
                        Changes will sync to {connectedWalls.length} connected wall{connectedWalls.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })()}

                {/* Input mode tabs */}
                <Tabs 
                  value={wall.slopeMode || 'height'} 
                  onValueChange={(mode) => updateWall(wall.id, { slopeMode: mode as 'height' | 'angle' })}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="height" className="text-xs">By Height</TabsTrigger>
                    <TabsTrigger value="angle" className="text-xs">By Angle</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="height" className="space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="startHeight" className="text-xs flex items-center gap-1">
                          Start Height
                          {wallSyncSettings.autoSyncJunctionHeights && <Link2 className="h-2.5 w-2.5 text-primary" />}
                          <span className="text-muted-foreground">(cm)</span>
                        </Label>
                        <Input
                          id="startHeight"
                          type="number"
                          value={wall.startHeight ?? wall.height}
                          onChange={(e) => {
                            const newStartHeight = Number(e.target.value);
                            const direction = newStartHeight > (wall.endHeight ?? wall.height) ? 'descending' : 'ascending';
                            if (wallSyncSettings.autoSyncJunctionHeights) {
                              updateWallWithSync(wall.id, { 
                                startHeight: newStartHeight,
                                slopeDirection: direction
                              }, true);
                            } else {
                              updateWall(wall.id, { 
                                startHeight: newStartHeight,
                                slopeDirection: direction
                              });
                            }
                          }}
                          min={50}
                          max={500}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="endHeight" className="text-xs flex items-center gap-1">
                          End Height
                          {wallSyncSettings.autoSyncJunctionHeights && <Link2 className="h-2.5 w-2.5 text-primary" />}
                          <span className="text-muted-foreground">(cm)</span>
                        </Label>
                        <Input
                          id="endHeight"
                          type="number"
                          value={wall.endHeight ?? wall.height}
                          onChange={(e) => {
                            const newEndHeight = Number(e.target.value);
                            const direction = (wall.startHeight ?? wall.height) > newEndHeight ? 'descending' : 'ascending';
                            if (wallSyncSettings.autoSyncJunctionHeights) {
                              updateWallWithSync(wall.id, { 
                                endHeight: newEndHeight,
                                slopeDirection: direction
                              }, true);
                            } else {
                              updateWall(wall.id, { 
                                endHeight: newEndHeight,
                                slopeDirection: direction
                              });
                            }
                          }}
                          min={50}
                          max={500}
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="angle" className="space-y-3 mt-2">
                    {/* Preset angle buttons */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quick Presets</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {SLOPE_PRESETS.map((preset) => {
                          const currentAngle = calculateAngleFromHeights(
                            wall.startHeight ?? wall.height,
                            wall.endHeight ?? wall.height,
                            parseFloat(length as string) || 100
                          );
                          const isActive = Math.abs(currentAngle - preset.angle) < 2;
                          return (
                            <Button
                              key={preset.angle}
                              variant={isActive ? "default" : "outline"}
                              size="sm"
                              className="h-7 px-2 text-xs"
                              title={preset.description}
                              onClick={() => {
                                const wallLength = parseFloat(length as string) || 100;
                                const direction = wall.slopeDirection || 'descending';
                                const baseHeight = wall.startHeight ?? wall.height;
                                const newEndHeight = calculateHeightFromAngle(
                                  baseHeight,
                                  wallLength,
                                  preset.angle,
                                  direction
                                );
                                updateWall(wall.id, {
                                  endHeight: Math.max(50, Math.round(newEndHeight)),
                                  slopeAngle: preset.angle
                                });
                              }}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Custom angle slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Custom Angle</Label>
                        <span className="text-xs font-medium">
                          {calculateAngleFromHeights(
                            wall.startHeight ?? wall.height,
                            wall.endHeight ?? wall.height,
                            parseFloat(length as string) || 100
                          ).toFixed(1)}°
                        </span>
                      </div>
                      <Slider
                        value={[calculateAngleFromHeights(
                          wall.startHeight ?? wall.height,
                          wall.endHeight ?? wall.height,
                          parseFloat(length as string) || 100
                        )]}
                        min={1}
                        max={75}
                        step={1}
                        onValueChange={([angle]) => {
                          const wallLength = parseFloat(length as string) || 100;
                          const direction = wall.slopeDirection || 'descending';
                          const baseHeight = wall.startHeight ?? wall.height;
                          const newEndHeight = calculateHeightFromAngle(
                            baseHeight,
                            wallLength,
                            angle,
                            direction
                          );
                          if (wallSyncSettings.autoSyncJunctionHeights) {
                            updateWallWithSync(wall.id, {
                              endHeight: Math.max(50, Math.round(newEndHeight)),
                              slopeAngle: angle
                            }, true);
                          } else {
                            updateWall(wall.id, {
                              endHeight: Math.max(50, Math.round(newEndHeight)),
                              slopeAngle: angle
                            });
                          }
                        }}
                        className="py-2"
                      />
                    </div>
                    
                    {/* Direction toggle */}
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Slope Direction</Label>
                      <div className="flex gap-1">
                        <Button
                          variant={wall.slopeDirection === 'ascending' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            const startH = wall.startHeight ?? wall.height;
                            const endH = wall.endHeight ?? wall.height;
                            const minH = Math.min(startH, endH);
                            const maxH = Math.max(startH, endH);
                            if (wallSyncSettings.autoSyncJunctionHeights) {
                              updateWallWithSync(wall.id, {
                                startHeight: minH,
                                endHeight: maxH,
                                slopeDirection: 'ascending'
                              }, true);
                            } else {
                              updateWall(wall.id, {
                                startHeight: minH,
                                endHeight: maxH,
                                slopeDirection: 'ascending'
                              });
                            }
                          }}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={wall.slopeDirection === 'descending' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            const startH = wall.startHeight ?? wall.height;
                            const endH = wall.endHeight ?? wall.height;
                            const minH = Math.min(startH, endH);
                            const maxH = Math.max(startH, endH);
                            if (wallSyncSettings.autoSyncJunctionHeights) {
                              updateWallWithSync(wall.id, {
                                startHeight: maxH,
                                endHeight: minH,
                                slopeDirection: 'descending'
                              }, true);
                            } else {
                              updateWall(wall.id, {
                                startHeight: maxH,
                                endHeight: minH,
                                slopeDirection: 'descending'
                              });
                            }
                          }}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                {/* Visual slope indicator */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden border">
                    <svg 
                      viewBox="0 0 100 24" 
                      className="w-full h-full"
                      preserveAspectRatio="none"
                    >
                      <polygon
                        points={`0,${24 - ((wall.startHeight ?? wall.height) / 500 * 24)} 100,${24 - ((wall.endHeight ?? wall.height) / 500 * 24)} 100,24 0,24`}
                        fill="hsl(var(--primary) / 0.3)"
                        stroke="hsl(var(--primary))"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <span className="text-xs font-medium">
                      {Math.abs((wall.startHeight ?? wall.height) - (wall.endHeight ?? wall.height))}cm
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({calculateAngleFromHeights(
                        wall.startHeight ?? wall.height,
                        wall.endHeight ?? wall.height,
                        parseFloat(length as string) || 100
                      ).toFixed(1)}°)
                    </span>
                  </div>
                </div>

                {/* Connected wall height mismatch warnings */}
                {(() => {
                  const mismatches = detectHeightMismatches(floorPlan.walls, floorPlan.points);
                  const relevantMismatches = mismatches.filter(m => 
                    m.walls.some(w => w.wallId === wall.id)
                  );
                  
                  if (relevantMismatches.length === 0) return null;
                  
                  return (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Height Mismatch</span>
                      </div>
                      {relevantMismatches.map((mismatch, idx) => (
                        <p key={idx} className="text-xs text-amber-600 dark:text-amber-500">
                          {mismatch.message}
                        </p>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedElement.type === 'door') {
    const door = floorPlan.doors.find(d => d.id === selectedElement.id);
    if (!door) return null;

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Door Properties</CardTitle>
          <Button variant="destructive" size="icon" onClick={() => deleteDoor(door.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doorWidth">Width (cm)</Label>
            <Input
              id="doorWidth"
              type="number"
              value={door.width}
              onChange={(e) => updateDoor(door.id, { width: Number(e.target.value) })}
              min={60}
              max={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doorHeight">Height (cm)</Label>
            <Input
              id="doorHeight"
              type="number"
              value={door.height}
              onChange={(e) => updateDoor(door.id, { height: Number(e.target.value) })}
              min={180}
              max={280}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={door.type}
              onValueChange={(value) => updateDoor(door.id, { type: value as DoorType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOOR_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedElement.type === 'window') {
    const window = floorPlan.windows.find(w => w.id === selectedElement.id);
    if (!window) return null;

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Window Properties</CardTitle>
          <Button variant="destructive" size="icon" onClick={() => deleteWindow(window.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="winWidth">Width (cm)</Label>
            <Input
              id="winWidth"
              type="number"
              value={window.width}
              onChange={(e) => updateWindow(window.id, { width: Number(e.target.value) })}
              min={40}
              max={300}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="winHeight">Height (cm)</Label>
            <Input
              id="winHeight"
              type="number"
              value={window.height}
              onChange={(e) => updateWindow(window.id, { height: Number(e.target.value) })}
              min={40}
              max={250}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sillHeight">Sill Height (cm)</Label>
            <Input
              id="sillHeight"
              type="number"
              value={window.sillHeight}
              onChange={(e) => updateWindow(window.id, { sillHeight: Number(e.target.value) })}
              min={0}
              max={150}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={window.type}
              onValueChange={(value) => updateWindow(window.id, { type: value as WindowType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedElement.type === 'fixture') {
    const fixture = floorPlan.fixtures.find(f => f.id === selectedElement.id);
    if (!fixture) return null;

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm capitalize">{fixture.type} Properties</CardTitle>
          <Button variant="destructive" size="icon" onClick={() => deleteFixture(fixture.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Category</Label>
            <p className="text-sm font-medium capitalize">{fixture.category}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Width</Label>
              <p className="text-sm font-medium">{fixture.width} cm</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Depth</Label>
              <p className="text-sm font-medium">{fixture.depth} cm</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rotation">Rotation (°)</Label>
            <Input
              id="rotation"
              type="number"
              value={fixture.rotation}
              onChange={(e) => rotateFixture(fixture.id, Number(e.target.value))}
              step={15}
              min={0}
              max={360}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Position</Label>
            <p className="text-sm font-medium">X: {fixture.cx.toFixed(0)}, Y: {fixture.cy.toFixed(0)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selectedElement.type === 'column') {
    const column = floorPlan.columns.find(c => c.id === selectedElement.id);
    if (!column) return null;

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Column Properties</CardTitle>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => rotateColumn(column.id, (column.rotation + 45) % 360)}
              title="Rotate 45°"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="icon" onClick={() => deleteColumn(column.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Shape</Label>
            <Select
              value={column.shape}
              onValueChange={(value) => updateColumn(column.id, { shape: value as ColumnShape })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_SHAPES.map(shape => (
                  <SelectItem key={shape.value} value={shape.value}>{shape.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dimensions based on shape */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="colWidth">
                {column.shape === 'round' || column.shape === 'hexagonal' || column.shape === 'octagonal' 
                  ? 'Diameter' 
                  : 'Width'} (cm)
              </Label>
              <Input
                id="colWidth"
                type="number"
                value={column.width}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  const syncDepth = column.shape === 'round' || column.shape === 'square' || 
                                   column.shape === 'hexagonal' || column.shape === 'octagonal';
                  updateColumn(column.id, { 
                    width: value,
                    depth: syncDepth ? value : column.depth 
                  });
                }}
                min={10}
                max={100}
              />
            </div>
            {(column.shape === 'rectangle' || column.shape === 'l-shaped' || column.shape === 't-shaped') && (
              <div className="space-y-2">
                <Label htmlFor="colDepth">Depth (cm)</Label>
                <Input
                  id="colDepth"
                  type="number"
                  value={column.depth}
                  onChange={(e) => updateColumn(column.id, { depth: Number(e.target.value) })}
                  min={10}
                  max={100}
                />
              </div>
            )}
          </div>

          {/* L-shaped and T-shaped arm dimensions */}
          {(column.shape === 'l-shaped' || column.shape === 't-shaped') && (
            <div className="grid grid-cols-2 gap-2 border-t pt-3">
              <div className="space-y-2">
                <Label htmlFor="armWidth" className="text-xs">Arm Width (cm)</Label>
                <Input
                  id="armWidth"
                  type="number"
                  value={column.armWidth ?? 15}
                  onChange={(e) => updateColumn(column.id, { armWidth: Number(e.target.value) })}
                  min={5}
                  max={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="armLength" className="text-xs">Arm Length (cm)</Label>
                <Input
                  id="armLength"
                  type="number"
                  value={column.armLength ?? 20}
                  onChange={(e) => updateColumn(column.id, { armLength: Number(e.target.value) })}
                  min={10}
                  max={80}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="colHeight">Height (cm)</Label>
            <Input
              id="colHeight"
              type="number"
              value={column.height}
              onChange={(e) => updateColumn(column.id, { height: Number(e.target.value) })}
              min={100}
              max={500}
            />
          </div>

          {/* Rotation for non-round shapes */}
          {column.shape !== 'round' && (
            <div className="space-y-2">
              <Label htmlFor="colRotation">Rotation (°)</Label>
              <Input
                id="colRotation"
                type="number"
                value={column.rotation}
                onChange={(e) => rotateColumn(column.id, Number(e.target.value))}
                step={15}
                min={0}
                max={360}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="structural">Structural</Label>
            <Switch
              id="structural"
              checked={column.isStructural}
              onCheckedChange={(checked) => updateColumn(column.id, { isStructural: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Material</Label>
            <Select
              value={column.material}
              onValueChange={(value) => updateColumn(column.id, { material: value as WallMaterial })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALL_MATERIALS.map(mat => (
                  <SelectItem key={mat.value} value={mat.value}>{mat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Position</Label>
            <p className="text-sm font-medium">X: {column.x.toFixed(0)}, Y: {column.y.toFixed(0)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
