

# Fix Furniture Drag — Use R3F Drag Plane Like Spawn Marker

## Problem

Furniture dragging uses `window.addEventListener('pointermove'/'pointerup')` which means OrbitControls (listening on the canvas DOM element) receives the same pointer events and orbits the camera simultaneously. The spawn point marker doesn't have this issue because it uses a large R3F mesh plane that captures all pointer events within the Three.js event system, where `stopPropagation()` actually prevents OrbitControls from seeing them.

## Solution

Apply the same pattern used by SpawnPointMarker: render a large invisible R3F drag plane when dragging, and handle `onPointerMove`/`onPointerUp` on that plane instead of on `window`.

### `src/components/3d/FurnitureScene.tsx`

1. **Remove `window.addEventListener` approach** — delete the `useEffect` that registers `pointermove`/`pointerup` on `window` (lines 167-258)

2. **Add a large invisible drag plane mesh** (100×100 units) that only renders when `isDragging` is true, positioned at y=0.001 (floor level)

3. **Move pointer handlers to R3F events on the drag plane**:
   - `onPointerMove` — same logic as current `handlePointerMove` but using `e.point` from R3F intersection (x/z → floor position), call `e.stopPropagation()`
   - `onPointerUp` — same logic as current `handlePointerUp`, call `e.stopPropagation()`

4. **Update `handleDragStart`** — also call `e.nativeEvent.stopImmediatePropagation()` to prevent OrbitControls from processing the initial pointerdown

### Key changes:
- Floor position calculation becomes simpler: directly use `e.point.x / CM_TO_METERS` and `e.point.z / CM_TO_METERS` from the plane intersection instead of raycasting
- The existing `FurnitureDragPlane` grid component is purely visual — the new invisible drag plane is a separate interaction mesh

## Files Modified

| File | Change |
|---|---|
| `src/components/3d/FurnitureScene.tsx` | Replace window event listeners with R3F drag plane mesh, same pattern as SpawnPointMarker |

