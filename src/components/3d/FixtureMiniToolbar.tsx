/**
 * FixtureMiniToolbar - Floating toolbar that appears above selected fixtures
 * 
 * Simple, compact toolbar with essential actions.
 * Uses HTML overlay positioned in 3D space for crisp rendering.
 * Mirrors FurnitureMiniToolbar for consistent UX.
 */

import React, { useEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import { RotateCw, Trash2, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

import type { UnifiedFixture } from '@/types/fixture';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import type { FloorPlan } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/constants/units';
import { isFixturePositionValid } from '@/utils/fixtureCollision';
import { toast } from 'sonner';

interface FixtureMiniToolbarProps {
  fixture: UnifiedFixture;
  onClose: () => void;
  floorPlan: FloorPlan;
  fixtures: UnifiedFixture[];
  furniture: FurnitureItem[];
  rotateFixture: (id: string, rotation: number) => void;
  deleteFixture: (id: string) => void;
}

// Rotation increments to try when primary rotation causes collision
const ROTATION_CANDIDATES = [45, 90, 135, 180, 225, 270, 315];

export const FixtureMiniToolbar: React.FC<FixtureMiniToolbarProps> = ({
  fixture,
  onClose,
  floorPlan,
  fixtures,
  furniture,
  rotateFixture,
  deleteFixture,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  
  // Calculate position above fixture
  const positionY = (fixture.dimensions.height * CM_TO_METERS) + 0.3;
  
  const rotateWithValidation = (requestedRotation: number): { success: boolean; actualRotation: number | null } => {
    const otherFixtures = fixtures.filter(f => f.id !== fixture.id);
    const walls = floorPlan.walls || [];
    const points = floorPlan.points || [];
    const currentRotation = fixture.rotation || 0;
    
    // Try the requested rotation first
    const testFixture = { ...fixture, rotation: requestedRotation % 360 };
    const primaryResult = isFixturePositionValid(testFixture, otherFixtures, furniture, walls, points);

    if (primaryResult.valid) {
      rotateFixture(fixture.id, requestedRotation % 360);
      return { success: true, actualRotation: requestedRotation % 360 };
    }

    // Primary rotation failed, try alternative rotations
    const requestedDelta = ((requestedRotation - currentRotation) % 360 + 360) % 360;
    const sortedCandidates = ROTATION_CANDIDATES
      .filter(d => d !== requestedDelta)
      .sort((a, b) => Math.abs(a - requestedDelta) - Math.abs(b - requestedDelta));
    
    for (const delta of sortedCandidates) {
      const testRotation = (currentRotation + delta) % 360;
      const altTestFixture = { ...fixture, rotation: testRotation };
      const altResult = isFixturePositionValid(altTestFixture, otherFixtures, furniture, walls, points);
      
      if (altResult.valid) {
        rotateFixture(fixture.id, testRotation);
        return { success: true, actualRotation: testRotation };
      }
    }

    // No valid rotation found
    return { success: false, actualRotation: null };
  };
  
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRotation = fixture.rotation || 0;
    const requestedRotation = (currentRotation + 45) % 360;
    
    const result = rotateWithValidation(requestedRotation);
    
    if (!result.success) {
      toast.error('Cannot rotate - no valid orientation found', {
        duration: 1500,
        position: 'bottom-center',
      });
    } else if (result.actualRotation !== null && result.actualRotation !== requestedRotation) {
      const actualDelta = ((result.actualRotation - currentRotation) % 360 + 360) % 360;
      toast.info(`Rotated ${actualDelta}° to avoid collision`, {
        duration: 1500,
        position: 'bottom-center',
      });
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFixture(fixture.id);
    onClose();
  };
  
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };
  
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showInfo) {
          setShowInfo(false);
        } else {
          onClose();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        const currentRotation = fixture.rotation || 0;
        const requestedRotation = (currentRotation + 45) % 360;
        const result = rotateWithValidation(requestedRotation);
        
        if (!result.success) {
          toast.error('Cannot rotate - no valid orientation', {
            duration: 1500,
            position: 'bottom-center',
          });
        } else if (result.actualRotation !== null && result.actualRotation !== requestedRotation) {
          const actualDelta = ((result.actualRotation - currentRotation) % 360 + 360) % 360;
          toast.info(`Rotated ${actualDelta}° to avoid collision`, {
            duration: 1500,
            position: 'bottom-center',
          });
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteFixture(fixture.id);
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fixture.id, fixture.rotation, showInfo, onClose, deleteFixture, floorPlan.walls, floorPlan.points, fixtures, furniture]);
  
  return (
    <Html
      position={[
        fixture.position.x * CM_TO_METERS,
        positionY,
        fixture.position.y * CM_TO_METERS,
      ]}
      center
      style={{ pointerEvents: 'auto' }}
      zIndexRange={[100, 0]}
    >
        <div 
          className="animate-fade-in flex items-center gap-1 px-2 py-1.5 rounded-full bg-background/95 backdrop-blur-sm border shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-0.5 text-xs font-medium text-muted-foreground border-r mr-1">
            {fixture.name}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleInfoClick}>
            <Info className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {showInfo && (
          <div className="mt-2 p-3 rounded-lg bg-background/95 backdrop-blur-sm border shadow-lg text-xs space-y-1.5 min-w-[180px]">
            <div className="font-semibold text-sm border-b pb-1.5 mb-2">{fixture.name}</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category:</span>
              <span className="capitalize">{fixture.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span>{fixture.dimensions.width}×{fixture.dimensions.depth}×{fixture.dimensions.height}cm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DFU:</span>
              <span>{fixture.dfu}</span>
            </div>
            {fixture.wattage > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wattage:</span>
                <span>{fixture.wattage}W</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rotation:</span>
              <span>{fixture.rotation}°</span>
            </div>
          </div>
        )}
    </Html>
  );
};

export default FixtureMiniToolbar;
