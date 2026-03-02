/**
 * FixtureScene Component
 * 
 * Container for all 3D fixture items with:
 * - Direct-drag UX with floating mini-toolbar
 * - Collision detection with rejection animation
 * - Deterministic drag-end: always ends in valid position
 * 
 * Mirrors FurnitureScene architecture for consistent UX.
 * 
 * IMPORTANT: This component runs inside the R3F Canvas context,
 * so it cannot access React contexts from outside the Canvas.
 * All required data must be passed as props.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ThreeEvent, useThree, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Fixture3D } from './Fixture3D';
import { FixtureMiniToolbar } from './FixtureMiniToolbar';
import { FurnitureDragPlane } from './FurnitureDragPlane';
import { isFixturePositionValid } from '@/utils/fixtureCollision';
import type { UnifiedFixture } from '@/types/fixture';
import type { FurnitureItem } from '@/data/furnitureLibrary';
import type { FloorPlan } from '@/types/floorPlan';
import * as THREE from 'three';
import { CM_TO_METERS } from '@/constants/units';
import { toast } from 'sonner';

interface FixtureSceneProps {
  enableDrag?: boolean;
  enableSelection?: boolean;
  onFixtureMoved?: (id: string, position: { x: number; y: number }) => void;
  /** Floor plan data - required since we can't access context inside R3F Canvas */
  floorPlan: FloorPlan;
  /** Fixtures from MEP context */
  fixtures: UnifiedFixture[];
  /** Furniture items for collision checking */
  furniture: FurnitureItem[];
  /** Currently selected fixture ID */
  selectedFixtureId: string | null;
  /** Callback to set selected fixture */
  setSelectedFixtureId: (id: string | null) => void;
  /** Callback to move fixture */
  moveFixture: (id: string, position: { x: number; y: number }) => void;
  /** Callback to rotate fixture */
  rotateFixture: (id: string, rotation: number) => void;
  /** Callback to delete fixture */
  deleteFixture: (id: string) => void;
  /** Is any fixture being dragged */
  isDraggingFixture: boolean;
  /** Set dragging state */
  setIsDraggingFixture: (dragging: boolean) => void;
}

// Rejection animation state
interface RejectionState {
  itemId: string;
  startTime: number;
  duration: number;
}

export const FixtureScene: React.FC<FixtureSceneProps> = ({
  enableDrag = true,
  enableSelection = true,
  onFixtureMoved,
  floorPlan,
  fixtures,
  furniture,
  selectedFixtureId,
  setSelectedFixtureId,
  moveFixture,
  rotateFixture,
  deleteFixture,
  isDraggingFixture,
  setIsDraggingFixture,
}) => {
  const { camera, gl } = useThree();
  const [draggedItem, setDraggedItem] = useState<UnifiedFixture | null>(null);
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
  
  // Get selected fixture
  const selectedFixture = fixtures.find(f => f.id === selectedFixtureId) || null;
  
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
  
  // Check collisions for a specific fixture position
  const checkCollisionAtPosition = useCallback((
    itemId: string,
    position: { x: number; y: number },
    itemBase: UnifiedFixture
  ): boolean => {
    const testItem = { ...itemBase, position };
    const otherFixtures = fixtures.filter(f => f.id !== itemId);
    const walls = floorPlan.walls || [];
    const points = floorPlan.points || [];
    
    const result = isFixturePositionValid(testItem, otherFixtures, furniture, walls, points);
    return !result.valid;
  }, [floorPlan.walls, floorPlan.points, fixtures, furniture]);
  
  const handleSelect = useCallback((id: string) => {
    if (!enableSelection) return;
    setSelectedFixtureId(id);
  }, [enableSelection, setSelectedFixtureId]);
  
  const handleBackgroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.object.userData.isGround && enableSelection && !isDraggingFixture) {
      setSelectedFixtureId(null);
    }
  }, [enableSelection, setSelectedFixtureId, isDraggingFixture]);
  
  const getFloorPosition = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    
    raycaster.current.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    const hit = raycaster.current.ray.intersectPlane(floorPlane.current, intersection);
    
    if (hit) {
      return {
        x: intersection.x / CM_TO_METERS,
        y: intersection.z / CM_TO_METERS,
      };
    }
    return null;
  }, [camera, gl.domElement]);
  
  const snapToGrid = useCallback((value: number, gridSize: number = 10) => {
    return Math.round(value / gridSize) * gridSize;
  }, []);
  
  const handleDragStart = useCallback((item: UnifiedFixture, e: ThreeEvent<PointerEvent>) => {
    if (!enableDrag) return;
    
    e.stopPropagation();
    setDraggedItem(item);
    setIsDraggingFixture(true);
    setGhostPosition({ ...item.position });
    
    // Initialize all refs with starting position
    startPositionRef.current = { ...item.position };
    lastValidPositionRef.current = { ...item.position };
    latestPositionRef.current = { ...item.position };
    isDragActiveRef.current = true;
    
    const floorPos = getFloorPosition(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (floorPos) {
      setDragOffset({
        x: item.position.x - floorPos.x,
        y: item.position.y - floorPos.y,
      });
    }
  }, [enableDrag, setIsDraggingFixture, getFloorPosition]);
  
  useEffect(() => {
    if (!draggedItem || !isDraggingFixture) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragActiveRef.current) return;
      
      const floorPos = getFloorPosition(e.clientX, e.clientY);
      if (floorPos && draggedItem) {
        const newX = snapToGrid(floorPos.x + dragOffset.x);
        const newY = snapToGrid(floorPos.y + dragOffset.y);
        const newPos = { x: newX, y: newY };
        
        // Update latest position ref
        latestPositionRef.current = newPos;
        
        // Check collision and update last valid position if valid
        const hasCollision = checkCollisionAtPosition(draggedItem.id, newPos, draggedItem);
        
        if (!hasCollision) {
          lastValidPositionRef.current = newPos;
          setCollisionState(prev => ({ ...prev, [draggedItem.id]: false }));
        } else {
          setCollisionState(prev => ({ ...prev, [draggedItem.id]: true }));
        }
        
        // Always move fixture to show current drag position
        moveFixture(draggedItem.id, newPos);
        onFixtureMoved?.(draggedItem.id, newPos);
      }
    };
    
    const handlePointerUp = () => {
      if (!draggedItem) return;
      
      // Immediately stop processing pointer moves
      isDragActiveRef.current = false;
      
      // Get the current position from the latest fixtures state
      const currentItem = fixtures.find(f => f.id === draggedItem.id);
      if (!currentItem) {
        // Item was deleted during drag, just clean up
        cleanupDrag();
        return;
      }
      
      // Final collision check at the current position
      const finalPosition = latestPositionRef.current || currentItem.position;
      const hasCollision = checkCollisionAtPosition(draggedItem.id, finalPosition, currentItem);
      
      if (hasCollision) {
        // Use last valid position, or fall back to start position
        const revertPosition = lastValidPositionRef.current || startPositionRef.current;
        
        if (revertPosition) {
          // Move back to valid position
          moveFixture(draggedItem.id, revertPosition);
          setCollisionState(prev => ({ ...prev, [draggedItem.id]: false }));
          
          // Trigger rejection animation and toast
          setRejectionState({
            itemId: draggedItem.id,
            startTime: performance.now(),
            duration: 400,
          });
          
          toast.error('Cannot place fixture here', {
            duration: 1500,
            position: 'bottom-center',
          });
        }
      }
      
      cleanupDrag();
    };
    
    const cleanupDrag = () => {
      setDraggedItem(null);
      setIsDraggingFixture(false);
      setGhostPosition(null);
      startPositionRef.current = null;
      lastValidPositionRef.current = null;
      latestPositionRef.current = null;
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggedItem, isDraggingFixture, dragOffset, getFloorPosition, snapToGrid, setIsDraggingFixture, moveFixture, fixtures, checkCollisionAtPosition, onFixtureMoved]);
  
  return (
    <group name="fixture-scene">
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
      
      {/* Grid overlay when dragging - positioned based on floor plan */}
      {isDraggingFixture && (() => {
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
      {isDraggingFixture && draggedItem && ghostPosition && (
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
      {isDraggingFixture && draggedItem && ghostPosition && latestPositionRef.current && (
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
      {isDraggingFixture && draggedItem && latestPositionRef.current && (() => {
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
            
            {/* Direction arrow showing fixture front */}
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
      
      {/* Render all fixture items */}
      {fixtures.map((item) => {
        const isBeingDragged = isDraggingFixture && draggedItem?.id === item.id;
        const showCollision = isBeingDragged && (collisionState[item.id] || false);
        const isRejecting = rejectionState?.itemId === item.id;
        
        return (
          <Fixture3D
            key={item.id}
            fixture={item}
            isSelected={selectedFixtureId === item.id}
            isDragging={isBeingDragged}
            hasCollision={showCollision}
            isRejecting={isRejecting}
            rejectionProgress={isRejecting ? rejectionProgress : 0}
            onSelect={handleSelect}
            onDragStart={(e) => handleDragStart(item, e)}
          />
        );
      })}
      
      {/* Floating mini-toolbar for selected fixture */}
      {selectedFixture && !isDraggingFixture && (
        <FixtureMiniToolbar
          fixture={selectedFixture}
          onClose={() => setSelectedFixtureId(null)}
          floorPlan={floorPlan}
          fixtures={fixtures}
          furniture={furniture}
          rotateFixture={rotateFixture}
          deleteFixture={deleteFixture}
        />
      )}
    </group>
  );
};

export default FixtureScene;
