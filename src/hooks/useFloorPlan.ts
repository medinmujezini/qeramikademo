import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { 
  FloorPlan, Point, Wall, Door, Window, Fixture, Column,
  PlumbingRoute, ElectricalRoute, WallTileSection,
  WallMaterial, DoorType, WindowType, FixtureType, ColumnShape,
  MainConnectionPoints, CeilingPlane, WallHeightMode, RoomLight
} from '@/types/floorPlan';
import { createDefaultFloorPlan, DEFAULT_CEILING_PLANE } from '@/types/floorPlan';
import { splitArc } from '@/utils/arcUtils';
import { 
  adjustCeilingPlaneForHeight, 
  recomputeAllWallHeights,
  getEffectiveWallHeights
} from '@/utils/ceilingUtils';
import { 
  DEFAULT_WALL_HEIGHT, 
  DEFAULT_WALL_THICKNESS,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_DOOR_HEIGHT,
  DEFAULT_WINDOW_SILL_HEIGHT
} from '@/constants/units';

export const useFloorPlan = () => {
  const [floorPlan, setFloorPlan] = useState<FloorPlan>(createDefaultFloorPlan());
  const [selectedElement, setSelectedElement] = useState<{ type: string; id: string } | null>(null);
  const [history, setHistory] = useState<FloorPlan[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;
  const historyRef = useRef(history);
  historyRef.current = history;

  const saveToHistory = useCallback((plan: FloorPlan) => {
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIndexRef.current + 1), plan];
      historyIndexRef.current = newHistory.length - 1;
      return newHistory;
    });
    setHistoryIndex(historyIndexRef.current);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const newIndex = historyIndexRef.current - 1;
      setHistoryIndex(newIndex);
      setFloorPlan(historyRef.current[newIndex]);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const newIndex = historyIndexRef.current + 1;
      setHistoryIndex(newIndex);
      setFloorPlan(historyRef.current[newIndex]);
    }
  }, []);

  // Points
  const addPoint = useCallback((x: number, y: number): string => {
    const id = uuidv4();
    setFloorPlan(prev => {
      const updated = { ...prev, points: [...prev.points, { id, x, y }] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const movePoint = useCallback((id: string, x: number, y: number) => {
    setFloorPlan(prev => ({
      ...prev,
      points: prev.points.map(p => p.id === id ? { ...p, x, y } : p)
    }));
  }, []);

  const deletePoint = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = {
        ...prev,
        points: prev.points.filter(p => p.id !== id),
        walls: prev.walls.filter(w => w.startPointId !== id && w.endPointId !== id)
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Walls
  const addWall = useCallback((startPointId: string, endPointId: string, isCurved: boolean = false, bulge: number = 0): string => {
    const id = uuidv4();
    const wall: Wall = {
      id,
      startPointId,
      endPointId,
      thickness: DEFAULT_WALL_THICKNESS,
      material: 'drywall',
      height: DEFAULT_WALL_HEIGHT,
      isCurved,
      bulge
    };
    setFloorPlan(prev => {
      const updated = { ...prev, walls: [...prev.walls, wall] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const updateWall = useCallback((id: string, updates: Partial<Wall>) => {
    setFloorPlan(prev => ({
      ...prev,
      walls: prev.walls.map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  }, []);

  // Update wall with automatic height synchronization at junctions
  const updateWallWithSync = useCallback((id: string, updates: Partial<Wall>, syncHeights: boolean = true) => {
    setFloorPlan(prev => {
      const wall = prev.walls.find(w => w.id === id);
      if (!wall) return prev;

      // Apply updates to the target wall first
      let updatedWalls = prev.walls.map(w => 
        w.id === id ? { ...w, ...updates } : w
      );

      // If height changed and sync is enabled, update connected walls
      if (syncHeights) {
        // Check if startHeight changed - sync walls at start junction
        if (updates.startHeight !== undefined) {
          const newHeight = updates.startHeight;
          updatedWalls = updatedWalls.map(w => {
            if (w.id === id) return w;
            if (w.startPointId === wall.startPointId) {
              return { ...w, startHeight: newHeight };
            }
            if (w.endPointId === wall.startPointId) {
              return { ...w, endHeight: newHeight };
            }
            return w;
          });
        }

        // Check if endHeight changed - sync walls at end junction
        if (updates.endHeight !== undefined) {
          const newHeight = updates.endHeight;
          updatedWalls = updatedWalls.map(w => {
            if (w.id === id) return w;
            if (w.startPointId === wall.endPointId) {
              return { ...w, startHeight: newHeight };
            }
            if (w.endPointId === wall.endPointId) {
              return { ...w, endHeight: newHeight };
            }
            return w;
          });
        }

        // Check if base height changed - sync all connected walls proportionally
        if (updates.height !== undefined && updates.startHeight === undefined && updates.endHeight === undefined) {
          const oldHeight = wall.height;
          const newHeight = updates.height;
          const ratio = newHeight / oldHeight;

          // Update connected walls at start point
          updatedWalls = updatedWalls.map(w => {
            if (w.id === id) return w;
            
            // At start point junction
            if (w.startPointId === wall.startPointId) {
              const currentStartHeight = w.startHeight ?? w.height;
              return { ...w, startHeight: Math.round(currentStartHeight * ratio) };
            }
            if (w.endPointId === wall.startPointId) {
              const currentEndHeight = w.endHeight ?? w.height;
              return { ...w, endHeight: Math.round(currentEndHeight * ratio) };
            }
            
            // At end point junction
            if (w.startPointId === wall.endPointId) {
              const currentStartHeight = w.startHeight ?? w.height;
              return { ...w, startHeight: Math.round(currentStartHeight * ratio) };
            }
            if (w.endPointId === wall.endPointId) {
              const currentEndHeight = w.endHeight ?? w.height;
              return { ...w, endHeight: Math.round(currentEndHeight * ratio) };
            }
            
            return w;
          });
        }
      }

      return { ...prev, walls: updatedWalls };
    });
  }, []);

  const deleteWall = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = {
        ...prev,
        walls: prev.walls.filter(w => w.id !== id),
        doors: prev.doors.filter(d => d.wallId !== id),
        windows: prev.windows.filter(w => w.wallId !== id)
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Convert straight wall to curved
  const convertToCurved = useCallback((wallId: string, bulge: number = 0.3) => {
    setFloorPlan(prev => {
      const updated = {
        ...prev,
        walls: prev.walls.map(w => 
          w.id === wallId ? { ...w, isCurved: true, bulge } : w
        )
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Convert curved wall back to straight
  const convertToStraight = useCallback((wallId: string) => {
    setFloorPlan(prev => {
      const updated = {
        ...prev,
        walls: prev.walls.map(w => 
          w.id === wallId ? { ...w, isCurved: false, bulge: 0 } : w
        )
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Insert a point anywhere on a wall, splitting it into two walls
  const insertPointOnWall = useCallback((wallId: string, x: number, y: number): string | null => {
    const wall = floorPlan.walls.find(w => w.id === wallId);
    if (!wall) return null;

    const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
    const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
    if (!startPoint || !endPoint) return null;

    // Calculate position along wall (0-1)
    const wallLength = Math.sqrt(
      (endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2
    );
    const clickDist = Math.sqrt(
      (x - startPoint.x) ** 2 + (y - startPoint.y) ** 2
    );
    const position = Math.max(0.05, Math.min(0.95, clickDist / wallLength));

    // For curved walls, use arc split calculation
    let bulge1 = 0, bulge2 = 0;
    let newX = x, newY = y;
    
    if (wall.isCurved && wall.bulge) {
      const splitResult = splitArc(startPoint, endPoint, wall.bulge, position);
      bulge1 = splitResult.bulge1;
      bulge2 = splitResult.bulge2;
      newX = splitResult.midPoint.x;
      newY = splitResult.midPoint.y;
    } else {
      // Calculate exact position on wall line (snap to wall)
      newX = startPoint.x + (endPoint.x - startPoint.x) * position;
      newY = startPoint.y + (endPoint.y - startPoint.y) * position;
    }
    
    const newPointId = uuidv4();
    const newWallId = uuidv4();

    setFloorPlan(prev => {
      // Distribute doors and windows to correct wall segment
      const updatedDoors = prev.doors.map(door => {
        if (door.wallId !== wallId) return door;
        if (door.position < position) {
          return { ...door, position: door.position / position };
        } else {
          return { 
            ...door, 
            wallId: newWallId, 
            position: (door.position - position) / (1 - position) 
          };
        }
      });

      const updatedWindows = prev.windows.map(window => {
        if (window.wallId !== wallId) return window;
        if (window.position < position) {
          return { ...window, position: window.position / position };
        } else {
          return { 
            ...window, 
            wallId: newWallId, 
            position: (window.position - position) / (1 - position) 
          };
        }
      });

      const updated = {
        ...prev,
        points: [...prev.points, { id: newPointId, x: newX, y: newY }],
        walls: [
          ...prev.walls.filter(w => w.id !== wallId),
          { ...wall, endPointId: newPointId, bulge: bulge1 },
          { ...wall, id: newWallId, startPointId: newPointId, endPointId: wall.endPointId, bulge: bulge2 }
        ],
        doors: updatedDoors,
        windows: updatedWindows
      };
      saveToHistory(updated);
      return updated;
    });

    return newPointId;
  }, [floorPlan, saveToHistory]);

  // Split wall at a specific position (0-1) - convenience wrapper
  const splitWall = useCallback((wallId: string, position: number) => {
    const wall = floorPlan.walls.find(w => w.id === wallId);
    if (!wall) return;

    const startPoint = floorPlan.points.find(p => p.id === wall.startPointId);
    const endPoint = floorPlan.points.find(p => p.id === wall.endPointId);
    if (!startPoint || !endPoint) return;

    const x = startPoint.x + (endPoint.x - startPoint.x) * position;
    const y = startPoint.y + (endPoint.y - startPoint.y) * position;
    
    insertPointOnWall(wallId, x, y);
  }, [floorPlan, insertPointOnWall]);

  // Merge two walls that share a junction point (when point has exactly 2 walls)
  const mergeWallsAtPoint = useCallback((pointId: string) => {
    const connectedWalls = floorPlan.walls.filter(
      w => w.startPointId === pointId || w.endPointId === pointId
    );

    if (connectedWalls.length !== 2) return;

    const [wall1, wall2] = connectedWalls;
    
    // Only merge if both walls are straight (or we'd lose curve info)
    if (wall1.isCurved || wall2.isCurved) return;
    
    let newStartPointId: string;
    let newEndPointId: string;

    if (wall1.endPointId === pointId && wall2.startPointId === pointId) {
      newStartPointId = wall1.startPointId;
      newEndPointId = wall2.endPointId;
    } else if (wall1.startPointId === pointId && wall2.endPointId === pointId) {
      newStartPointId = wall2.startPointId;
      newEndPointId = wall1.endPointId;
    } else if (wall1.endPointId === pointId && wall2.endPointId === pointId) {
      newStartPointId = wall1.startPointId;
      newEndPointId = wall2.startPointId;
    } else {
      newStartPointId = wall1.endPointId;
      newEndPointId = wall2.endPointId;
    }

    const startPoint = floorPlan.points.find(p => p.id === newStartPointId);
    const midPoint = floorPlan.points.find(p => p.id === pointId);
    const endPoint = floorPlan.points.find(p => p.id === newEndPointId);
    if (!startPoint || !midPoint || !endPoint) return;

    const wall1Length = Math.sqrt((midPoint.x - startPoint.x) ** 2 + (midPoint.y - startPoint.y) ** 2);
    const wall2Length = Math.sqrt((endPoint.x - midPoint.x) ** 2 + (endPoint.y - midPoint.y) ** 2);
    const totalLength = wall1Length + wall2Length;
    const wall1Ratio = wall1Length / totalLength;

    setFloorPlan(prev => {
      const newWallId = uuidv4();

      const updatedDoors = prev.doors.map(door => {
        if (door.wallId === wall1.id) {
          return { ...door, wallId: newWallId, position: door.position * wall1Ratio };
        } else if (door.wallId === wall2.id) {
          return { ...door, wallId: newWallId, position: wall1Ratio + door.position * (1 - wall1Ratio) };
        }
        return door;
      });

      const updatedWindows = prev.windows.map(window => {
        if (window.wallId === wall1.id) {
          return { ...window, wallId: newWallId, position: window.position * wall1Ratio };
        } else if (window.wallId === wall2.id) {
          return { ...window, wallId: newWallId, position: wall1Ratio + window.position * (1 - wall1Ratio) };
        }
        return window;
      });

      const updated = {
        ...prev,
        points: prev.points.filter(p => p.id !== pointId),
        walls: [
          ...prev.walls.filter(w => w.id !== wall1.id && w.id !== wall2.id),
          { ...wall1, id: newWallId, startPointId: newStartPointId, endPointId: newEndPointId }
        ],
        doors: updatedDoors,
        windows: updatedWindows
      };
      saveToHistory(updated);
      return updated;
    });
  }, [floorPlan, saveToHistory]);

  // Doors
  const addDoor = useCallback((wallId: string, position: number, type: DoorType = 'hinged-left'): string => {
    const id = uuidv4();
    const door: Door = {
      id,
      wallId,
      position,
      width: DEFAULT_DOOR_WIDTH,
      height: DEFAULT_DOOR_HEIGHT,
      type
    };
    setFloorPlan(prev => {
      const updated = { ...prev, doors: [...prev.doors, door] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const updateDoor = useCallback((id: string, updates: Partial<Door>) => {
    setFloorPlan(prev => ({
      ...prev,
      doors: prev.doors.map(d => d.id === id ? { ...d, ...updates } : d)
    }));
  }, []);

  const deleteDoor = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = { ...prev, doors: prev.doors.filter(d => d.id !== id) };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Windows
  const addWindow = useCallback((wallId: string, position: number, type: WindowType = 'casement'): string => {
    const id = uuidv4();
    const window: Window = {
      id,
      wallId,
      position,
      width: 120,
      height: 120,
      sillHeight: DEFAULT_WINDOW_SILL_HEIGHT,
      type
    };
    setFloorPlan(prev => {
      const updated = { ...prev, windows: [...prev.windows, window] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const updateWindow = useCallback((id: string, updates: Partial<Window>) => {
    setFloorPlan(prev => ({
      ...prev,
      windows: prev.windows.map(w => w.id === id ? { ...w, ...updates } : w)
    }));
  }, []);

  const deleteWindow = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = { ...prev, windows: prev.windows.filter(w => w.id !== id) };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Fixtures - center-based coordinates (cx, cy)
  const addFixture = useCallback((
    type: FixtureType, 
    cx: number, 
    cy: number, 
    template: Omit<Fixture, 'id' | 'cx' | 'cy' | 'rotation' | 'anchoredToWallId' | 'anchorMode' | 'secondaryWallId' | 'wallOffset'>
  ): string => {
    const id = uuidv4();
    // Use template connections if provided, otherwise create defaults
    const plumbingConnections = template.plumbingConnections.length > 0 
      ? template.plumbingConnections.map(c => ({ ...c, id: uuidv4() }))
      : [
          { id: uuidv4(), type: 'water-supply' as const, localX: 0, localY: -template.depth / 2 + 5, targetPreference: 'wall' as const, allowedTargets: ['wall' as const], defaultSide: 'back' as const },
          { id: uuidv4(), type: 'drainage' as const, localX: 0, localY: 0, targetPreference: 'floor' as const, allowedTargets: ['floor' as const, 'wall' as const], defaultSide: 'bottom' as const }
        ];
    
    const electricalConnections = template.electricalConnections.length > 0
      ? template.electricalConnections.map(c => ({ ...c, id: uuidv4() }))
      : template.category !== 'general' 
        ? [{ id: uuidv4(), type: 'outlet' as const, localX: 0, localY: -template.depth / 2 + 5, wattage: 100, targetPreference: 'wall' as const }]
        : [];
    
    const fixture: Fixture = {
      ...template,
      id,
      type,
      cx,
      cy,
      rotation: 0,
      anchorMode: 'free',
      plumbingConnections,
      electricalConnections
    };
    setFloorPlan(prev => {
      const updated = { ...prev, fixtures: [...prev.fixtures, fixture] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const moveFixture = useCallback((id: string, cx: number, cy: number, anchorWallId?: string | null) => {
    setFloorPlan(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(f => f.id === id ? { 
        ...f, 
        cx, 
        cy,
        anchoredToWallId: anchorWallId === null ? undefined : (anchorWallId ?? f.anchoredToWallId)
      } : f)
    }));
  }, []);

  const rotateFixture = useCallback((id: string, rotation: number) => {
    setFloorPlan(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(f => f.id === id ? { ...f, rotation } : f)
    }));
  }, []);

  const updateFixture = useCallback((id: string, updates: Partial<Fixture>) => {
    setFloorPlan(prev => ({
      ...prev,
      fixtures: prev.fixtures.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  }, []);

  const deleteFixture = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = {
        ...prev,
        fixtures: prev.fixtures.filter(f => f.id !== id),
        plumbingRoutes: prev.plumbingRoutes.filter(r => r.fixtureId !== id),
        electricalRoutes: prev.electricalRoutes.filter(r => r.fixtureId !== id)
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Columns
  const addColumn = useCallback((
    x: number, 
    y: number, 
    template?: Partial<Omit<Column, 'id' | 'x' | 'y'>>
  ): string => {
    const id = uuidv4();
    const column: Column = {
      id,
      x,
      y,
      shape: template?.shape ?? 'rectangle', // Default to rectangle
      width: template?.width ?? 30,
      depth: template?.depth ?? 30,
      height: template?.height ?? 280,
      rotation: template?.rotation ?? 0,
      isStructural: template?.isStructural ?? true,
      material: template?.material ?? 'concrete',
      armWidth: template?.armWidth,
      armLength: template?.armLength,
    };
    setFloorPlan(prev => {
      const updated = { ...prev, columns: [...prev.columns, column] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const moveColumn = useCallback((id: string, x: number, y: number) => {
    setFloorPlan(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.id === id ? { ...c, x, y } : c)
    }));
  }, []);

  const updateColumn = useCallback((id: string, updates: Partial<Column>) => {
    setFloorPlan(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  }, []);

  const rotateColumn = useCallback((id: string, rotation: number) => {
    setFloorPlan(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.id === id ? { ...c, rotation } : c)
    }));
  }, []);

  const deleteColumn = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = { ...prev, columns: prev.columns.filter(c => c.id !== id) };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Main connection points
  const updateMainConnections = useCallback((connections: Partial<MainConnectionPoints>) => {
    setFloorPlan(prev => {
      const updated = {
        ...prev,
        mainConnections: { ...prev.mainConnections, ...connections }
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Tile sections
  const addTileSection = useCallback((
    wallId: string,
    tileId: string,
    startPosition: number = 0,
    endPosition: number = 1,
    startHeight: number = 0,
    endHeight: number = 280
  ): string => {
    const id = uuidv4();
    const section: WallTileSection = {
      id,
      wallId,
      tileId,
      startPosition,
      endPosition,
      startHeight,
      endHeight,
      orientation: 'horizontal',
      pattern: 'grid',
      offsetX: 0,
      offsetY: 0,
      groutColor: '#d1d5db'
    };
    setFloorPlan(prev => {
      const updated = { ...prev, tileSections: [...prev.tileSections, section] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const updateTileSection = useCallback((id: string, updates: Partial<WallTileSection>) => {
    setFloorPlan(prev => ({
      ...prev,
      tileSections: prev.tileSections.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  }, []);

  const deleteTileSection = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = { ...prev, tileSections: prev.tileSections.filter(s => s.id !== id) };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Assign tile to entire wall (convenience function)
  const assignTileToWall = useCallback((wallId: string, tileId: string, tileSettings?: Partial<WallTileSection>) => {
    const wall = floorPlan.walls.find(w => w.id === wallId);
    if (!wall) return;

    setFloorPlan(prev => {
      const newSections = prev.tileSections.filter(s => s.wallId !== wallId);
      const newSection: WallTileSection = {
        id: uuidv4(),
        wallId,
        tileId,
        startPosition: tileSettings?.startPosition ?? 0,
        endPosition: tileSettings?.endPosition ?? 1,
        startHeight: tileSettings?.startHeight ?? 0,
        endHeight: tileSettings?.endHeight ?? wall.height,
        orientation: tileSettings?.orientation ?? 'horizontal',
        pattern: tileSettings?.pattern ?? 'grid',
        offsetX: tileSettings?.offsetX ?? 0,
        offsetY: tileSettings?.offsetY ?? 0,
        groutColor: tileSettings?.groutColor ?? '#d1d5db'
      };
      const updated = { ...prev, tileSections: [...newSections, newSection] };
      saveToHistory(updated);
      return updated;
    });
  }, [floorPlan.walls, saveToHistory]);

  // Update multiple tile sections for a wall
  const updateWallTileSections = useCallback((wallId: string, sections: Partial<WallTileSection>[]) => {
    const wall = floorPlan.walls.find(w => w.id === wallId);
    if (!wall) return;

    setFloorPlan(prev => {
      const otherSections = prev.tileSections.filter(s => s.wallId !== wallId);
      
      const newSections = sections.map(s => ({
        id: s.id || uuidv4(),
        wallId,
        tileId: s.tileId!,
        startPosition: s.startPosition ?? 0,
        endPosition: s.endPosition ?? 1,
        startHeight: s.startHeight ?? 0,
        endHeight: s.endHeight ?? wall.height,
        orientation: s.orientation ?? 'horizontal',
        pattern: s.pattern ?? 'grid',
        offsetX: s.offsetX ?? 0,
        offsetY: s.offsetY ?? 0,
        groutColor: s.groutColor ?? '#d1d5db',
      }));
      
      const updated = { ...prev, tileSections: [...otherSections, ...newSections] };
      saveToHistory(updated);
      return updated;
    });
  }, [floorPlan.walls, saveToHistory]);

  // Ceiling plane operations
  const updateCeilingPlane = useCallback((updates: Partial<CeilingPlane>) => {
    setFloorPlan(prev => {
      const currentPlane = prev.ceilingPlane ?? DEFAULT_CEILING_PLANE;
      const newPlane = { ...currentPlane, ...updates };
      
      // Recompute wall heights if ceiling plane is enabled
      let updatedWalls = prev.walls;
      if (newPlane.enabled) {
        updatedWalls = recomputeAllWallHeights(prev.walls, prev.points, newPlane);
      }
      
      const updated = { 
        ...prev, 
        ceilingPlane: newPlane,
        walls: updatedWalls
      };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Set height at a specific point with mode selection
  const setHeightAtPoint = useCallback((
    pointId: string,
    targetHeight: number,
    mode: 'apply-to-room' | 'override-wall',
    wallId?: string
  ) => {
    setFloorPlan(prev => {
      const point = prev.points.find(p => p.id === pointId);
      if (!point) return prev;

      if (mode === 'apply-to-room') {
        // Adjust ceiling plane to satisfy the height at this point
        const currentPlane = prev.ceilingPlane ?? DEFAULT_CEILING_PLANE;
        const newPlane = adjustCeilingPlaneForHeight(point, targetHeight, {
          ...currentPlane,
          enabled: true
        });
        
        // Recompute all wall heights from updated plane
        const updatedWalls = recomputeAllWallHeights(prev.walls, prev.points, newPlane);
        
        const updated = { 
          ...prev, 
          ceilingPlane: newPlane,
          walls: updatedWalls
        };
        saveToHistory(updated);
        return updated;
      } else {
        // Override mode: update only the specific wall
        if (!wallId) return prev;
        
        const updatedWalls = prev.walls.map(w => {
          if (w.id !== wallId) return w;
          
          const isStartPoint = w.startPointId === pointId;
          return {
            ...w,
            heightMode: 'override' as WallHeightMode,
            ...(isStartPoint 
              ? { overrideStartHeight: targetHeight, startHeight: targetHeight }
              : { overrideEndHeight: targetHeight, endHeight: targetHeight }
            )
          };
        });
        
        const updated = { ...prev, walls: updatedWalls };
        saveToHistory(updated);
        return updated;
      }
    });
  }, [saveToHistory]);

  // Toggle wall height mode
  const setWallHeightMode = useCallback((wallId: string, mode: WallHeightMode) => {
    setFloorPlan(prev => {
      const wall = prev.walls.find(w => w.id === wallId);
      if (!wall) return prev;

      let updatedWalls: Wall[];
      
      if (mode === 'room') {
        // Switch to room mode - recompute heights from ceiling plane
        const plane = prev.ceilingPlane ?? DEFAULT_CEILING_PLANE;
        updatedWalls = prev.walls.map(w => {
          if (w.id !== wallId) return w;
          
          if (plane.enabled) {
            const { startHeight, endHeight } = getEffectiveWallHeights(
              { ...w, heightMode: 'room' }, 
              prev.points, 
              plane
            );
            return {
              ...w,
              heightMode: 'room' as WallHeightMode,
              startHeight: Math.round(startHeight),
              endHeight: Math.round(endHeight),
              overrideStartHeight: undefined,
              overrideEndHeight: undefined
            };
          }
          
          return { ...w, heightMode: 'room' as WallHeightMode };
        });
      } else {
        // Switch to override mode - preserve current heights as overrides
        updatedWalls = prev.walls.map(w => {
          if (w.id !== wallId) return w;
          return {
            ...w,
            heightMode: 'override' as WallHeightMode,
            overrideStartHeight: w.startHeight ?? w.height,
            overrideEndHeight: w.endHeight ?? w.height
          };
        });
      }
      
      const updated = { ...prev, walls: updatedWalls };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Toggle endpoint lock
  const toggleEndpointLock = useCallback((wallId: string, endpoint: 'start' | 'end') => {
    setFloorPlan(prev => {
      const updatedWalls = prev.walls.map(w => {
        if (w.id !== wallId) return w;
        
        if (endpoint === 'start') {
          const isLocked = !w.lockStartHeight;
          return {
            ...w,
            lockStartHeight: isLocked,
            overrideStartHeight: isLocked ? (w.startHeight ?? w.height) : undefined
          };
        } else {
          const isLocked = !w.lockEndHeight;
          return {
            ...w,
            lockEndHeight: isLocked,
            overrideEndHeight: isLocked ? (w.endHeight ?? w.height) : undefined
          };
        }
      });
      
      return { ...prev, walls: updatedWalls };
    });
  }, []);

  // Wall finish operations
  const setWallFinish = useCallback((
    wallId: string, 
    surfaceType: 'paint' | 'wallpaper' | 'tiles',
    options: { 
      color?: string; 
      patternId?: string; 
      tileId?: string; 
      groutColor?: string; 
      pattern?: 'grid' | 'staggered' | 'herringbone' | 'diagonal';
      jointWidth?: number;
      orientation?: 'horizontal' | 'vertical';
      offsetX?: number;
      offsetY?: number;
      // Cached tile properties for 3D rendering
      tileWidth?: number;
      tileHeight?: number;
      tileColor?: string;
      tileMaterial?: string;
    }
  ) => {
    setFloorPlan(prev => {
      const wall = prev.walls.find(w => w.id === wallId);
      if (!wall) return prev;

      // If tiles, create/update a tile section AND wall finish
      if (surfaceType === 'tiles' && options.tileId) {
        const existingSection = prev.tileSections.find(s => s.wallId === wallId);
        const sectionId = existingSection?.id || uuidv4();
        
        const newSection = {
          id: sectionId,
          wallId,
          tileId: options.tileId,
          startPosition: 0,
          endPosition: 1,
          startHeight: 0,
          endHeight: wall.height,
          orientation: options.orientation || 'horizontal' as const,
          pattern: options.pattern || 'grid' as const,
          offsetX: options.offsetX || 0,
          offsetY: options.offsetY || 0,
          groutColor: options.groutColor || '#9ca3af',
        };

        const otherSections = prev.tileSections.filter(s => s.wallId !== wallId);
        
        // Also create/update wall finish for 3D rendering
        const wallFinishes = prev.wallFinishes || [];
        const existingFinish = wallFinishes.find(f => f.wallId === wallId);
        
        const newFinish = {
          id: existingFinish?.id || uuidv4(),
          wallId,
          surfaceType: 'tiles' as const,
          tileId: options.tileId,
          groutColor: options.groutColor || '#9ca3af',
          pattern: options.pattern || 'grid' as const,
          jointWidth: options.jointWidth,
          orientation: options.orientation,
          offsetX: options.offsetX,
          offsetY: options.offsetY,
          // Cache tile properties for 3D rendering
          tileWidth: options.tileWidth,
          tileHeight: options.tileHeight,
          tileColor: options.tileColor,
          tileMaterial: options.tileMaterial,
        };
        
        const otherFinishes = wallFinishes.filter(f => f.wallId !== wallId);
        
        const updated = { 
          ...prev, 
          tileSections: [...otherSections, newSection],
          wallFinishes: [...otherFinishes, newFinish]
        };
        saveToHistory(updated);
        return updated;
      }

      // For paint/wallpaper, just update the wall material or store in a separate structure
      const wallFinishes = prev.wallFinishes || [];
      const existingFinish = wallFinishes.find(f => f.wallId === wallId);
      
      const newFinish = {
        id: existingFinish?.id || uuidv4(),
        wallId,
        surfaceType,
        color: options.color,
        patternId: options.patternId,
      };

      const otherFinishes = wallFinishes.filter(f => f.wallId !== wallId);
      const updated = { ...prev, wallFinishes: [...otherFinishes, newFinish] };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Batch apply tile finish to ALL walls in a single state update
  const setAllWallsFinish = useCallback((
    surfaceType: 'paint' | 'wallpaper' | 'tiles',
    options: { 
      color?: string; 
      patternId?: string; 
      tileId?: string; 
      groutColor?: string; 
      pattern?: 'grid' | 'staggered' | 'herringbone' | 'diagonal';
      jointWidth?: number;
      orientation?: 'horizontal' | 'vertical';
      offsetX?: number;
      offsetY?: number;
      tileWidth?: number;
      tileHeight?: number;
      tileColor?: string;
      tileMaterial?: string;
    }
  ) => {
    setFloorPlan(prev => {
      let tileSections = [...prev.tileSections];
      let wallFinishes = [...(prev.wallFinishes || [])];

      for (const wall of prev.walls) {
        if (surfaceType === 'tiles' && options.tileId) {
          const existingSection = tileSections.find(s => s.wallId === wall.id);
          const sectionId = existingSection?.id || uuidv4();

          const newSection = {
            id: sectionId,
            wallId: wall.id,
            tileId: options.tileId,
            startPosition: 0,
            endPosition: 1,
            startHeight: 0,
            endHeight: wall.height,
            orientation: options.orientation || 'horizontal' as const,
            pattern: options.pattern || 'grid' as const,
            offsetX: options.offsetX || 0,
            offsetY: options.offsetY || 0,
            groutColor: options.groutColor || '#9ca3af',
          };

          tileSections = [...tileSections.filter(s => s.wallId !== wall.id), newSection];

          const existingFinish = wallFinishes.find(f => f.wallId === wall.id);
          const newFinish = {
            id: existingFinish?.id || uuidv4(),
            wallId: wall.id,
            surfaceType: 'tiles' as const,
            tileId: options.tileId,
            groutColor: options.groutColor || '#9ca3af',
            pattern: options.pattern || 'grid' as const,
            jointWidth: options.jointWidth,
            orientation: options.orientation,
            offsetX: options.offsetX,
            offsetY: options.offsetY,
            tileWidth: options.tileWidth,
            tileHeight: options.tileHeight,
            tileColor: options.tileColor,
            tileMaterial: options.tileMaterial,
          };

          wallFinishes = [...wallFinishes.filter(f => f.wallId !== wall.id), newFinish];
        } else {
          const existingFinish = wallFinishes.find(f => f.wallId === wall.id);
          const newFinish = {
            id: existingFinish?.id || uuidv4(),
            wallId: wall.id,
            surfaceType,
            color: options.color,
            patternId: options.patternId,
          };
          wallFinishes = [...wallFinishes.filter(f => f.wallId !== wall.id), newFinish];
        }
      }

      const updated = { ...prev, tileSections, wallFinishes };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  const removeWallFinish = useCallback((wallId: string) => {
    setFloorPlan(prev => {
      // Remove tile sections for this wall
      const tileSections = prev.tileSections.filter(s => s.wallId !== wallId);
      // Remove wall finishes
      const wallFinishes = (prev.wallFinishes || []).filter(f => f.wallId !== wallId);
      
      const updated = { ...prev, tileSections, wallFinishes };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  const setFloorFinish = useCallback((
    surfaceType: 'tiles' | 'hardwood' | 'carpet',
    options: { color?: string; tileId?: string; groutColor?: string; pattern?: 'grid' | 'staggered' | 'herringbone' | 'diagonal'; materialId?: string; textureScaleCm?: number }
  ) => {
    setFloorPlan(prev => {
      const floorFinish = {
        id: prev.floorFinish?.id || uuidv4(),
        surfaceType,
        color: options.color,
        tileId: options.tileId,
        pattern: options.pattern,
        groutColor: options.groutColor,
        materialId: options.materialId,
        textureScaleCm: options.textureScaleCm,
      };
      
      const updated = { ...prev, floorFinish };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  const removeFloorFinish = useCallback(() => {
    setFloorPlan(prev => {
      const updated = { ...prev, floorFinish: undefined };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Floor plan operations
  const resetFloorPlan = useCallback(() => {
    const newPlan = createDefaultFloorPlan();
    setFloorPlan(newPlan);
    saveToHistory(newPlan);
  }, [saveToHistory]);

  const loadFloorPlan = useCallback((plan: FloorPlan) => {
    // Ensure columns array exists for backward compatibility
    const planWithColumns = {
      ...plan,
      columns: plan.columns || [],
      ceilingPlane: plan.ceilingPlane ?? DEFAULT_CEILING_PLANE,
      wallFinishes: plan.wallFinishes || [],
    };
    setFloorPlan(planWithColumns);
    saveToHistory(planWithColumns);
  }, [saveToHistory]);

  // Camera views
  const addCameraView = useCallback((view: import('@/types/floorPlan').SavedCameraView) => {
    setFloorPlan(prev => {
      const updated = { ...prev, savedCameraViews: [...(prev.savedCameraViews ?? []), view] };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  const removeCameraView = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = { ...prev, savedCameraViews: (prev.savedCameraViews ?? []).filter(v => v.id !== id) };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  // Room lights
  const addRoomLight = useCallback((cx: number, cy: number): string => {
    const id = uuidv4();
    const light: RoomLight = {
      id,
      cx,
      cy,
      width: 60,
      depth: 30,
      rotation: 0,
      intensity: 3,
      color: '#ffffff',
      enabled: true,
    };
    setFloorPlan(prev => {
      const updated = { ...prev, roomLights: [...(prev.roomLights ?? []), light] };
      saveToHistory(updated);
      return updated;
    });
    return id;
  }, [saveToHistory]);

  const updateRoomLight = useCallback((id: string, updates: Partial<RoomLight>) => {
    setFloorPlan(prev => ({
      ...prev,
      roomLights: (prev.roomLights ?? []).map(l => l.id === id ? { ...l, ...updates } : l),
    }));
  }, []);

  const deleteRoomLight = useCallback((id: string) => {
    setFloorPlan(prev => {
      const updated = { ...prev, roomLights: (prev.roomLights ?? []).filter(l => l.id !== id) };
      saveToHistory(updated);
      return updated;
    });
  }, [saveToHistory]);

  return {
    floorPlan,
    setFloorPlan,
    selectedElement,
    setSelectedElement,
    // Points
    addPoint,
    movePoint,
    deletePoint,
    // Walls
    addWall,
    updateWall,
    deleteWall,
    splitWall,
    insertPointOnWall,
    mergeWallsAtPoint,
    convertToCurved,
    convertToStraight,
    // Doors
    addDoor,
    updateDoor,
    deleteDoor,
    // Windows
    addWindow,
    updateWindow,
    deleteWindow,
    // Fixtures
    addFixture,
    moveFixture,
    rotateFixture,
    updateFixture,
    deleteFixture,
    // Columns
    addColumn,
    moveColumn,
    updateColumn,
    rotateColumn,
    deleteColumn,
    // Tile sections
    addTileSection,
    updateTileSection,
    deleteTileSection,
    assignTileToWall,
    updateWallTileSections,
    // Wall & Floor finishes
    setWallFinish,
    setAllWallsFinish,
    removeWallFinish,
    setFloorFinish,
    removeFloorFinish,
    // Main connections
    updateMainConnections,
    // Ceiling plane operations
    updateCeilingPlane,
    setHeightAtPoint,
    setWallHeightMode,
    toggleEndpointLock,
    // History
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    // Operations
    resetFloorPlan,
    loadFloorPlan,
    // Smart wall updates with height sync
    updateWallWithSync,
    // Camera views
    addCameraView,
    removeCameraView,
    // Room lights
    addRoomLight,
    updateRoomLight,
    deleteRoomLight,
  };
};
