/**
 * FurnitureScene Component
 * 
 * Container for all 3D furniture items with:
 * - Direct-drag UX with floating mini-toolbar
 * - Collision detection with rejection animation
 * - Deterministic drag-end: always ends in valid position
 * 
 * IMPORTANT: This component runs inside the R3F Canvas context,
 * so it cannot access React contexts from outside the Canvas.
 * Floor plan data must be passed as props.
 */

import React, { useCallback, useState, useRef } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useFurnitureContext } from '@/contexts/FurnitureContext';
import { Furniture3D } from './Furniture3D';
import { FurnitureMiniToolbar } from './FurnitureMiniToolbar';
import { FurnitureDragPlane } from './FurnitureDragPlane';
import { isPositionValid } from '@/utils/furnitureCollision';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import type { FloorPlan } from '@/types/floorPlan';
import * as THREE from 'three';
import { CM_TO_METERS } from '@/utils/modelLoader';
import { toast } from 'sonner';

interface FurnitureSceneProps {
  enableDrag?: boolean;
  enableSelection?: boolean;
  onFurnitureMoved?: (id: string, position: { x: number; y: number }) => void;
  /** Floor plan data - required since we can't access context inside R3F Canvas */
  floorPlan: FloorPlan;
}

// Rejection animation state
interface RejectionState {
  itemId: string;
  startTime: number;
  duration: number;
}

export const FurnitureScene: React.FC<FurnitureSceneProps> = ({
  enableDrag = true,
  enableSelection = true,
  onFurnitureMoved,
  floorPlan,
}) => {
  const {
    furniture,
    selectedFurnitureId,
    setSelectedFurnitureId,
    moveFurniture,
    selectedFurniture,
    isDragging,
    setIsDragging,
  } = useFurnitureContext();
  
  const [draggedItem, setDraggedItem] = useState<FurnitureItem | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [collisionState, setCollisionState] = useState<Record<string, boolean>>({});
  const [rejectionState, setRejectionState] = useState<RejectionState | null>(null);
  const [rejectionProgress, setRejectionProgress] = useState(0);
  const [pulseTime, setPulseTime] = useState(0);
  
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  
  // Use refs for drag state to ensure deterministic drag-end behavior
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastValidPositionRef = useRef<{ x: number; y: number } | null>(null);
  const latestPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isDragActiveRef = useRef(false);
  
  // Animate rejection pulse and drop indicator
  useFrame((state) => {
    // Update pulse time for drop indicator animation
    setPulseTime(state.clock.elapsedTime);
    
    if (!rejectionState) return;
    
    const elapsed = performance.now() - rejectionState.startTime;
    const progress = Math.min(elapsed / rejectionState.duration, 1);
    setRejectionProgress(progress);
    
    if (progress >= 1) {
      setRejectionState(null);
      setRejectionProgress(0);
    }
  });
  
  // Check collisions for a specific furniture item position
  const checkCollisionAtPosition = useCallback((
    itemId: string,
    position: { x: number; y: number },
    itemBase: FurnitureItem
  ): boolean => {
    const testItem = { ...itemBase, position };
    const otherFurniture = furniture.filter(f => f.id !== itemId);
    const walls = floorPlan.walls || [];
    const points = floorPlan.points || [];
    
    const result = isPositionValid(testItem, otherFurniture, walls, points);
    return !result.valid;
  }, [floorPlan.walls, floorPlan.points, furniture]);
  
  const handleSelect = useCallback((id: string) => {
    if (!enableSelection) return;
    setSelectedFurnitureId(id);
  }, [enableSelection, setSelectedFurnitureId]);
  
  const handleBackgroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.object.userData.isGround && enableSelection && !isDragging) {
      setSelectedFurnitureId(null);
    }
  }, [enableSelection, setSelectedFurnitureId, isDragging]);
  
  const snapToGrid = useCallback((value: number, gridSize: number = 10) => {
    return Math.round(value / gridSize) * gridSize;
  }, []);
  
  const handleDragStart = useCallback((item: FurnitureItem, e: ThreeEvent<PointerEvent>) => {
    if (!enableDrag) return;
    
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setDraggedItem(item);
    setIsDragging(true);
    setGhostPosition({ ...item.position });
    
    // Initialize all refs with starting position
    startPositionRef.current = { ...item.position };
    lastValidPositionRef.current = { ...item.position };
    latestPositionRef.current = { ...item.position };
    isDragActiveRef.current = true;
    
    // Calculate offset using intersection point
    const floorX = e.point.x / CM_TO_METERS;
    const floorY = e.point.z / CM_TO_METERS;
    setDragOffset({
      x: item.position.x - floorX,
      y: item.position.y - floorY,
    });
  }, [enableDrag, setIsDragging]);
  
  const handleDragMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isDragActiveRef.current || !draggedItem) return;
    e.stopPropagation();
    
    const floorX = e.point.x / CM_TO_METERS;
    const floorZ = e.point.z / CM_TO_METERS;
    const newX = snapToGrid(floorX + dragOffset.x);
    const newY = snapToGrid(floorZ + dragOffset.y);
    const newPos = { x: newX, y: newY };
    
    latestPositionRef.current = newPos;
    
    const hasCollision = checkCollisionAtPosition(draggedItem.id, newPos, draggedItem);
    
    if (!hasCollision) {
      lastValidPositionRef.current = newPos;
      setCollisionState(prev => ({ ...prev, [draggedItem.id]: false }));
    } else {
      setCollisionState(prev => ({ ...prev, [draggedItem.id]: true }));
    }
    
    moveFurniture(draggedItem.id, newPos);
    onFurnitureMoved?.(draggedItem.id, newPos);
  }, [draggedItem, dragOffset, snapToGrid, checkCollisionAtPosition, moveFurniture, onFurnitureMoved]);
  
  const handleDragEnd = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!draggedItem) return;
    e.stopPropagation();
    
    isDragActiveRef.current = false;
    
    const currentItem = furniture.find(f => f.id === draggedItem.id);
    if (!currentItem) {
      cleanupDrag();
      return;
    }
    
    const finalPosition = latestPositionRef.current || currentItem.position;
    const hasCollision = checkCollisionAtPosition(draggedItem.id, finalPosition, currentItem);
    
    if (hasCollision) {
      const revertPosition = lastValidPositionRef.current || startPositionRef.current;
      
      if (revertPosition) {
        moveFurniture(draggedItem.id, revertPosition);
        setCollisionState(prev => ({ ...prev, [draggedItem.id]: false }));
        
        setRejectionState({
          itemId: draggedItem.id,
          startTime: performance.now(),
          duration: 400,
        });
        
        toast.error('Cannot place here', {
          duration: 1500,
          position: 'bottom-center',
        });
      }
    }
    
    cleanupDrag();
  }, [draggedItem, furniture, checkCollisionAtPosition, moveFurniture]);
  
  const cleanupDrag = useCallback(() => {
    setDraggedItem(null);
    setIsDragging(false);
    setGhostPosition(null);
    startPositionRef.current = null;
    lastValidPositionRef.current = null;
    latestPositionRef.current = null;
  }, [setIsDragging]);
  
  return (
    <group name="furniture-scene">
      {/* Invisible ground plane for click detection */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.001, 0]}
        onClick={handleBackgroundClick}
        userData={{ isGround: true }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      
      {/* Large invisible drag plane — captures pointer during furniture drag */}
      {isDragging && draggedItem && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      
      {/* Grid overlay when dragging - positioned based on floor plan */}
      {isDragging && (() => {
        // Calculate floor bounds from floor plan points
        const points = floorPlan.points || [];
        let floorCenter = { x: 0, z: 0 };
        let floorSize = { width: 10, depth: 10 };
        
        if (points.length > 0) {
          const xs = points.map(p => p.x * CM_TO_METERS);
          const ys = points.map(p => p.y * CM_TO_METERS);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          floorCenter = { x: (minX + maxX) / 2, z: (minY + maxY) / 2 };
          floorSize = { width: maxX - minX + 2, depth: maxY - minY + 2 };
        }
        
        return (
          <FurnitureDragPlane 
            hasCollision={draggedItem ? collisionState[draggedItem.id] : false}
            floorCenter={floorCenter}
            floorSize={floorSize}
          />
        );
      })()}
      
      {/* Origin marker at drag start position */}
      {isDragging && draggedItem && ghostPosition && (
        <group
          position={[
            ghostPosition.x * CM_TO_METERS,
            0.002,
            ghostPosition.y * CM_TO_METERS,
          ]}
        >
          {/* Cross-hair marker at origin */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.08, 32]} />
            <meshBasicMaterial color="#64748b" transparent opacity={0.5} />
          </mesh>
          {/* Inner dot */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <circleGeometry args={[0.02, 16]} />
            <meshBasicMaterial color="#64748b" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
      
      {/* Connection line from ghost to drop position */}
      {isDragging && draggedItem && ghostPosition && latestPositionRef.current && (
        <Line
          points={[
            [ghostPosition.x * CM_TO_METERS, 0.003, ghostPosition.y * CM_TO_METERS],
            [latestPositionRef.current.x * CM_TO_METERS, 0.003, latestPositionRef.current.y * CM_TO_METERS],
          ]}
          color="#94a3b8"
          lineWidth={1}
          dashed
          dashSize={0.08}
          gapSize={0.04}
        />
      )}
      
      {/* Enhanced drop target indicator */}
      {isDragging && draggedItem && latestPositionRef.current && (() => {
        const hasCollision = collisionState[draggedItem.id];
        const baseColor = hasCollision ? '#ef4444' : '#22c55e';
        const pulseOpacity = 0.15 + Math.sin(pulseTime * 5) * 0.08;
        const width = draggedItem.dimensions.width * CM_TO_METERS;
        const depth = draggedItem.dimensions.depth * CM_TO_METERS;
        
        // Rectangle corners for border
        const halfW = width / 2;
        const halfD = depth / 2;
        const borderPoints: [number, number, number][] = [
          [-halfW, 0, -halfD],
          [halfW, 0, -halfD],
          [halfW, 0, halfD],
          [-halfW, 0, halfD],
          [-halfW, 0, -halfD],
        ];
        
        return (
          <group
            position={[
              latestPositionRef.current.x * CM_TO_METERS,
              0.004,
              latestPositionRef.current.y * CM_TO_METERS,
            ]}
            rotation={[0, -draggedItem.rotation * (Math.PI / 180), 0]}
          >
            {/* Pulsing footprint fill */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
              <planeGeometry args={[width, depth]} />
              <meshBasicMaterial 
                color={baseColor} 
                transparent 
                opacity={pulseOpacity} 
              />
            </mesh>
            
            {/* Animated border */}
            <Line
              points={borderPoints}
              color={baseColor}
              lineWidth={2}
              opacity={0.6 + Math.sin(pulseTime * 4) * 0.2}
              transparent
            />
            
            {/* Direction arrow showing furniture front */}
            <mesh 
              position={[0, 0.002, -depth / 2 - 0.06]} 
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <coneGeometry args={[0.04, 0.08, 3]} />
              <meshBasicMaterial color={baseColor} />
            </mesh>
            
            {/* Corner brackets */}
            {[
              { x: -1, z: -1, rotY: 0 },
              { x: 1, z: -1, rotY: Math.PI / 2 },
              { x: 1, z: 1, rotY: Math.PI },
              { x: -1, z: 1, rotY: -Math.PI / 2 },
            ].map((corner, i) => (
              <group
                key={i}
                position={[
                  corner.x * halfW * 0.95,
                  0.001,
                  corner.z * halfD * 0.95,
                ]}
                rotation={[0, corner.rotY, 0]}
              >
                {/* L-shaped bracket */}
                <Line
                  points={[
                    [0, 0, 0.06],
                    [0, 0, 0],
                    [0.06, 0, 0],
                  ]}
                  color={baseColor}
                  lineWidth={2}
                />
              </group>
            ))}
          </group>
        );
      })()}
      
      {/* Render all furniture items */}
      {furniture.map((item) => {
        const isBeingDragged = isDragging && draggedItem?.id === item.id;
        const showCollision = isBeingDragged && (collisionState[item.id] || false);
        const isRejecting = rejectionState?.itemId === item.id;
        const ceilingHeight = floorPlan.walls?.[0]?.height ?? 280;
        
        return (
          <Furniture3D
            key={item.id}
            item={item}
            isSelected={selectedFurnitureId === item.id}
            isDragging={isBeingDragged}
            hasCollision={showCollision}
            isRejecting={isRejecting}
            rejectionProgress={isRejecting ? rejectionProgress : 0}
            onSelect={handleSelect}
            onDragStart={(e) => handleDragStart(item, e)}
            modelUrl={item.modelUrl}
            ceilingHeight={ceilingHeight}
          />
        );
      })}
      
      {/* Floating mini-toolbar for selected furniture */}
      {selectedFurniture && !isDragging && (
        <FurnitureMiniToolbar
          item={selectedFurniture}
          onClose={() => setSelectedFurnitureId(null)}
          floorPlan={floorPlan}
        />
      )}
    </group>
  );
};

export default FurnitureScene;
