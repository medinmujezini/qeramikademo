import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface NewFloorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFloor: (options: { name: string; height: number; copyOuterWalls: boolean }) => void;
  nextLevel: number;
  hasFloorBelow: boolean;
}

export const NewFloorDialog: React.FC<NewFloorDialogProps> = ({
  open,
  onOpenChange,
  onCreateFloor,
  nextLevel,
  hasFloorBelow,
}) => {
  const [name, setName] = useState(`Floor ${nextLevel}`);
  const [height, setHeight] = useState('300');
  const [copyOuterWalls, setCopyOuterWalls] = useState(true);

  const handleCreate = () => {
    const h = Number(height);
    if (h < 200 || h > 600) return;
    onCreateFloor({ name: name.trim() || `Floor ${nextLevel}`, height: h, copyOuterWalls: hasFloorBelow && copyOuterWalls });
    onOpenChange(false);
    // Reset for next use
    setName(`Floor ${nextLevel + 1}`);
    setHeight('300');
    setCopyOuterWalls(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-display uppercase tracking-widest">New Floor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="floor-name" className="text-xs">Floor Name</Label>
            <Input
              id="floor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="floor-height" className="text-xs">Floor-to-Floor Height (cm)</Label>
            <Input
              id="floor-height"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              min={200}
              max={600}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">Range: 200–600 cm</p>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="copy-walls"
              checked={copyOuterWalls}
              onCheckedChange={(v) => setCopyOuterWalls(v === true)}
              disabled={!hasFloorBelow}
            />
            <div>
              <Label htmlFor="copy-walls" className="text-xs cursor-pointer">
                Copy outside walls from floor below
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {hasFloorBelow
                  ? 'Walls will be locked as structural and cannot be deleted'
                  : 'No floor below to copy from'}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreate}>Create Floor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
