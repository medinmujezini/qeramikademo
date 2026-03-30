/**
 * FurnitureMiniToolbar - Floating toolbar that appears above selected furniture
 * 
 * Simple, compact toolbar with essential actions only.
 * Uses HTML overlay positioned in 3D space for crisp rendering.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { Palette, RotateCw, MoreHorizontal, Trash2, X, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useFurnitureContext } from '@/contexts/FurnitureContext';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import type { FloorPlan } from '@/types/floorPlan';
import { CM_TO_METERS } from '@/utils/modelLoader';
import { FurnitureColorPopup } from './FurnitureColorPopup';
import { FurnitureDetailsDialog } from './FurnitureDetailsDialog';
import { toast } from 'sonner';

interface FurnitureMiniToolbarProps {
  item: FurnitureItem;
  onClose: () => void;
  /** Floor plan data - required since we can't access context inside R3F Canvas */
  floorPlan: FloorPlan;
}

export const FurnitureMiniToolbar: React.FC<FurnitureMiniToolbarProps> = ({
  item,
  onClose,
  floorPlan,
}) => {
  const navigate = useNavigate();
  const { rotateFurniture, rotateFurnitureWithValidation, deleteFurniture, updateFurnitureColor } = useFurnitureContext();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Calculate position above furniture
  const positionY = (item.dimensions.height * CM_TO_METERS) + 0.3;
  
  const handleProductView = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/product-view', {
      state: {
        id: item.id,
        name: item.name,
        dimensions: item.dimensions,
        color: item.color,
        modelUrl: item.modelUrl,
      }
    });
  };
  
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRotation = item.rotation || 0;
    const requestedRotation = (currentRotation + 45) % 360;
    
    // Smart rotation - tries alternatives if primary fails
    const walls = floorPlan.walls || [];
    const points = floorPlan.points || [];
    const result = rotateFurnitureWithValidation(item.id, requestedRotation, walls, points);
    
    if (!result.success) {
      toast.error('Cannot rotate - no valid orientation found', {
        duration: 1500,
        position: 'bottom-center',
      });
    } else if (result.actualRotation !== null && result.actualRotation !== requestedRotation) {
      // Rotation was adjusted to a different angle
      const actualDelta = ((result.actualRotation - currentRotation) % 360 + 360) % 360;
      toast.info(`Rotated ${actualDelta}° to avoid collision`, {
        duration: 1500,
        position: 'bottom-center',
      });
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFurniture(item.id);
  };
  
  const handleColorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  };
  
  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDetails(true);
  };
  
  const handleColorChange = (color: string) => {
    updateFurnitureColor(item.id, color);
    setShowColorPicker(false);
  };
  
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showColorPicker) {
          setShowColorPicker(false);
        } else if (showDetails) {
          setShowDetails(false);
        } else {
          onClose();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        const currentRotation = item.rotation || 0;
        const requestedRotation = (currentRotation + 45) % 360;
        const walls = floorPlan.walls || [];
        const points = floorPlan.points || [];
        const result = rotateFurnitureWithValidation(item.id, requestedRotation, walls, points);
        
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
        deleteFurniture(item.id);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item.id, item.rotation, showColorPicker, showDetails, onClose, rotateFurnitureWithValidation, deleteFurniture, floorPlan.walls, floorPlan.points]);
  
  return (
    <Html
      position={[
        item.position.x * CM_TO_METERS,
        positionY,
        item.position.y * CM_TO_METERS,
      ]}
      center
      style={{ pointerEvents: 'auto' }}
      zIndexRange={[100, 0]}
    >
        <div 
          className="animate-fade-in flex items-center gap-1 px-2 py-1.5 rounded-full bg-background/95 backdrop-blur-sm border shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleColorClick}>
            <div className="w-5 h-5 rounded-full border-2 border-background shadow-sm" style={{ backgroundColor: item.color }} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleMoreClick}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleProductView}>
            <Box className="h-4 w-4" />
          </Button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {showColorPicker && (
          <FurnitureColorPopup
            currentColor={item.color}
            onColorChange={handleColorChange}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      
      {/* Details dialog */}
      <FurnitureDetailsDialog
        item={item}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </Html>
  );
};

export default FurnitureMiniToolbar;
