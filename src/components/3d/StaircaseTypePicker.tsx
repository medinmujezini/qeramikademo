/**
 * StaircaseTypePicker — Step 3: Popover with 4 staircase type cards
 */

import React from 'react';
import { useFloorPlanContext } from '@/contexts/FloorPlanContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import type { StaircaseType } from '@/types/multiFloor';

const STAIR_TYPES: { type: StaircaseType; label: string; desc: string; icon: string }[] = [
  { type: 'straight', label: 'Straight', desc: 'Simple linear staircase', icon: '┃' },
  { type: 'l-shaped', label: 'L-Shaped', desc: 'Quarter turn with landing', icon: '┗' },
  { type: 'u-shaped', label: 'U-Shaped', desc: 'Half turn, compact footprint', icon: '┃┃' },
  { type: 'spiral', label: 'Spiral', desc: 'Circular, minimal space', icon: '◎' },
];

export const StaircaseTypePicker: React.FC = () => {
  const { building, activeLevel, addStaircase, floorPlan } = useFloorPlanContext();
  const [open, setOpen] = React.useState(false);

  const hasFloorAbove = building.floors.some(f => f.level === activeLevel + 1);

  const handleSelect = (type: StaircaseType) => {
    if (!hasFloorAbove) {
      toast.error('Add a floor above first to place stairs');
      return;
    }
    const cx = (floorPlan.roomWidth || 800) / 2;
    const cy = (floorPlan.roomHeight || 600) / 2;
    addStaircase(type, cx - 50, cy - 140);
    toast.success(`${type} staircase added`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <ArrowUpDown className="h-3 w-3" />
          Stairs
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-2">
          <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">Staircase Type</span>
          {!hasFloorAbove && (
            <p className="text-[10px] text-destructive">Add a floor above first</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {STAIR_TYPES.map(st => (
              <button
                key={st.type}
                className="flex flex-col items-center gap-1 p-2 rounded-sm border border-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-colors text-center disabled:opacity-40"
                disabled={!hasFloorAbove}
                onClick={() => handleSelect(st.type)}
              >
                <span className="text-lg font-mono text-primary">{st.icon}</span>
                <span className="text-[10px] font-medium text-foreground">{st.label}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{st.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
