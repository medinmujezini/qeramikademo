/**
 * Furniture State Management Hook
 * 
 * Manages furniture items in the floor plan.
 * All placements are collision-safe using functional state updates.
 * Smart rotation finds valid angles when primary rotation causes collision.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { FurnitureItem, FurnitureTemplate } from '@/data/furnitureLibrary';
import { createFurnitureFromTemplate } from '@/data/furnitureLibrary';
import { isPositionValid, findValidPositionSpiral } from '@/utils/furnitureCollision';

// Rotation increments to try when primary rotation causes collision
const ROTATION_CANDIDATES = [45, 90, 135, 180, 225, 270, 315];

interface FloorPlanPoint {
  id: string;
  x: number;
  y: number;
}

interface Wall {
  id: string;
  startPointId: string;
  endPointId: string;
  thickness: number;
}

export interface AddFurnitureResult {
  success: boolean;
  id: string | null;
  position: { x: number; y: number } | null;
  wasAdjusted: boolean;
}

export function useFurnitureState() {
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Use ref to capture result from functional state update
  const addResultRef = useRef<AddFurnitureResult>({
    success: false,
    id: null,
    position: null,
    wasAdjusted: false,
  });

  const addFurniture = useCallback((
    template: FurnitureTemplate,
    position: { x: number; y: number },
    rotation: number = 0
  ) => {
    const item = createFurnitureFromTemplate(template, position, rotation);
    setFurniture(prev => [...prev, item]);
    return item.id;
  }, []);

  /**
   * Add furniture with collision-aware placement.
   * Uses functional state update to always validate against the latest furniture list.
   * If the target position is invalid, searches for a nearby valid position.
   * Returns result object indicating success/failure and final position.
   */
  const addFurnitureWithCollisionCheck = useCallback((
    template: FurnitureTemplate,
    position: { x: number; y: number },
    walls: Wall[],
    points: FloorPlanPoint[],
    rotation: number = 0
  ): AddFurnitureResult => {
    // Create the item first (before we know final position)
    const item = createFurnitureFromTemplate(template, position, rotation);
    
    // Reset the result ref
    addResultRef.current = {
      success: false,
      id: null,
      position: null,
      wasAdjusted: false,
    };
    
    // Use functional update to get the latest furniture state
    setFurniture(prev => {
      // Check if initial position is valid against current furniture
      const initialCheck = isPositionValid(item, prev, walls, points);
      
      if (initialCheck.valid) {
        // Position is valid, add the item
        addResultRef.current = {
          success: true,
          id: item.id,
          position: item.position,
          wasAdjusted: false,
        };
        return [...prev, item];
      }
      
      // Position is invalid, try to find a valid one
      const validPos = findValidPositionSpiral(item, position, prev, walls, points);
      
      if (validPos) {
        // Found a valid position
        const adjustedItem = { ...item, position: validPos };
        addResultRef.current = {
          success: true,
          id: item.id,
          position: validPos,
          wasAdjusted: true,
        };
        return [...prev, adjustedItem];
      }
      
      // No valid position found - don't add the item
      addResultRef.current = {
        success: false,
        id: null,
        position: null,
        wasAdjusted: false,
      };
      return prev; // Return unchanged state
    });
    
    // Return the result (captured synchronously during setFurniture callback)
    return addResultRef.current;
  }, []);

  const moveFurniture = useCallback((id: string, position: { x: number; y: number }) => {
    setFurniture(prev =>
      prev.map(f => f.id === id ? { ...f, position } : f)
    );
  }, []);

  const rotateFurniture = useCallback((id: string, rotation: number) => {
    setFurniture(prev =>
      prev.map(f => f.id === id ? { ...f, rotation } : f)
    );
  }, []);

  /**
   * Smart rotation with collision validation.
   * First tries the requested rotation, then tries alternative angles
   * in order of preference (closest to requested first).
   * Returns the actual rotation applied, or null if none worked.
   */
  const rotateFurnitureWithValidation = useCallback((
    id: string,
    requestedRotation: number,
    walls: Wall[],
    points: FloorPlanPoint[]
  ): { success: boolean; actualRotation: number | null; collidingWith: string[] } => {
    const item = furniture.find(f => f.id === id);
    if (!item) return { success: false, actualRotation: null, collidingWith: [] };

    const otherFurniture = furniture.filter(f => f.id !== id);
    const currentRotation = item.rotation || 0;
    
    // Calculate the requested delta (how much the user wanted to rotate)
    const requestedDelta = ((requestedRotation - currentRotation) % 360 + 360) % 360;
    
    // Try the requested rotation first
    const testItem = { ...item, rotation: requestedRotation % 360 };
    const primaryResult = isPositionValid(testItem, otherFurniture, walls, points);

    if (primaryResult.valid) {
      setFurniture(prev =>
        prev.map(f => f.id === id ? { ...f, rotation: requestedRotation % 360 } : f)
      );
      return { success: true, actualRotation: requestedRotation % 360, collidingWith: [] };
    }

    // Primary rotation failed, try alternative rotations
    // Sort candidates by how close they are to the requested delta
    const sortedCandidates = ROTATION_CANDIDATES
      .filter(d => d !== requestedDelta)
      .sort((a, b) => Math.abs(a - requestedDelta) - Math.abs(b - requestedDelta));
    
    for (const delta of sortedCandidates) {
      const testRotation = (currentRotation + delta) % 360;
      const altTestItem = { ...item, rotation: testRotation };
      const altResult = isPositionValid(altTestItem, otherFurniture, walls, points);
      
      if (altResult.valid) {
        setFurniture(prev =>
          prev.map(f => f.id === id ? { ...f, rotation: testRotation } : f)
        );
        return { success: true, actualRotation: testRotation, collidingWith: [] };
      }
    }

    // No valid rotation found
    return { success: false, actualRotation: null, collidingWith: primaryResult.collidingWith };
  }, [furniture]);

  const updateFurnitureColor = useCallback((id: string, color: string) => {
    setFurniture(prev =>
      prev.map(f => f.id === id ? { ...f, color } : f)
    );
  }, []);

  const deleteFurniture = useCallback((id: string) => {
    setFurniture(prev => prev.filter(f => f.id !== id));
    if (selectedFurnitureId === id) {
      setSelectedFurnitureId(null);
    }
  }, [selectedFurnitureId]);

  const selectedFurniture = useMemo(() =>
    furniture.find(f => f.id === selectedFurnitureId) || null,
    [furniture, selectedFurnitureId]
  );

  const reset = useCallback(() => {
    setFurniture([]);
    setSelectedFurnitureId(null);
    setIsDragging(false);
  }, []);

  return {
    furniture,
    selectedFurnitureId,
    setSelectedFurnitureId,
    selectedFurniture,
    addFurniture,
    addFurnitureWithCollisionCheck,
    moveFurniture,
    rotateFurniture,
    rotateFurnitureWithValidation,
    updateFurnitureColor,
    deleteFurniture,
    reset,
    furnitureCount: furniture.length,
    isDragging,
    setIsDragging,
  };
}

export type FurnitureStateHook = ReturnType<typeof useFurnitureState>;
