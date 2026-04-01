/**
 * FloorManager — Multi-floor management UI (Step 2)
 * Rename, delete, duplicate, set height, switch active floor.
 */

import React, { useState } from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Layers, Plus, Trash2, Copy, Pencil, Check, X, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { NewFloorDialog } from './NewFloorDialog';

export const FloorManager: React.FC = () => {
  const {
    building, activeLevel, setActiveLevel,
    addFloor, removeFloor, renameFloor, duplicateFloor, updateFloorHeight,
    getFloorPlanForLevel,
  } = useFloorPlanContext();

  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editingHeight, setEditingHeight] = useState<number | null>(null);
  const [heightValue, setHeightValue] = useState('');
  const [showNewFloorDialog, setShowNewFloorDialog] = useState(false);

  const sortedFloors = [...building.floors].sort((a, b) => b.level - a.level);
  const maxLevel = Math.max(...building.floors.map(f => f.level), -1);

  const startRename = (level: number, name: string) => {
    setEditingLevel(level);
    setEditName(name);
  };

  const confirmRename = () => {
    if (editingLevel !== null && editName.trim()) {
      renameFloor(editingLevel, editName.trim());
      setEditingLevel(null);
    }
  };

  const startHeightEdit = (level: number, height: number) => {
    setEditingHeight(level);
    setHeightValue(String(height));
  };

  const confirmHeight = () => {
    if (editingHeight !== null) {
      const h = Number(heightValue);
      if (h >= 200 && h <= 600) {
        updateFloorHeight(editingHeight, h);
        setEditingHeight(null);
      } else {
        toast.error('Height must be between 200-600 cm');
      }
    }
  };

  const getStructuralWallCount = (level: number): number => {
    const plan = getFloorPlanForLevel(level);
    if (!plan) return 0;
    return plan.walls.filter(w => w.isStructural).length;
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Layers className="h-3 w-3" />
            <span className="uppercase tracking-wider">
              {building.floors.find(f => f.level === activeLevel)?.name || 'Floor'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start" side="bottom">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">Floors</span>
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => setShowNewFloorDialog(true)}>
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {sortedFloors.map(floor => {
                  const isActive = floor.level === activeLevel;
                  const isEditing = editingLevel === floor.level;
                  const isEditingH = editingHeight === floor.level;
                  const structuralCount = getStructuralWallCount(floor.level);

                  return (
                    <div
                      key={floor.id}
                      className={`rounded-sm px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                        isActive ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-muted/50'
                      }`}
                      onClick={() => { if (!isEditing && !isEditingH) setActiveLevel(floor.level); }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="h-5 text-xs px-1"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditingLevel(null); }}
                            />
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); confirmRename(); }}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setEditingLevel(null); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium truncate flex-1">{floor.name}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" style={{ opacity: isActive ? 1 : undefined }}>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); startRename(floor.level, floor.name); }}>
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); duplicateFloor(floor.level); toast.success('Floor duplicated'); }}>
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5 text-destructive"
                                disabled={building.floors.length <= 1}
                                onClick={(e) => { e.stopPropagation(); removeFloor(floor.level); toast.success('Floor removed'); }}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Height + structural walls info */}
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>Height:</span>
                          {isEditingH ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={heightValue}
                                onChange={e => setHeightValue(e.target.value)}
                                className="h-4 w-14 text-[10px] px-1"
                                type="number"
                                autoFocus
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => { if (e.key === 'Enter') confirmHeight(); if (e.key === 'Escape') setEditingHeight(null); }}
                              />
                              <span>cm</span>
                              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); confirmHeight(); }}>
                                <Check className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); startHeightEdit(floor.level, floor.floorToFloorHeight); }}
                            >
                              {floor.floorToFloorHeight} cm
                            </span>
                          )}
                        </div>
                        {structuralCount > 0 && (
                          <div className="flex items-center gap-0.5 text-primary/70">
                            <Lock className="h-2.5 w-2.5" />
                            <span>{structuralCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </PopoverContent>
      </Popover>

      <NewFloorDialog
        open={showNewFloorDialog}
        onOpenChange={setShowNewFloorDialog}
        onCreateFloor={(opts) => {
          addFloor(opts);
          toast.success(`${opts.name} created`);
        }}
        nextLevel={maxLevel + 1}
        hasFloorBelow={building.floors.length > 0}
      />
    </>
  );
};
