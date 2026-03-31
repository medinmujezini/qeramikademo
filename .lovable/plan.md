

# Fix: SpawnPointMarker Dragging Moves Camera

## Problem
When dragging the spawn point character in design mode, OrbitControls also receives the pointer events, causing the camera to orbit simultaneously.

## Root Cause
1. **SpawnPointMarker's drag plane is tiny** (0.8×0.8 units) — pointer quickly leaves it during drag
2. **`setPointerCapture`** is called on `e.target as HTMLElement` which doesn't work in R3F's Three.js event system
3. **`e.stopPropagation()`** alone doesn't prevent OrbitControls from receiving events — OrbitControls listens on the canvas DOM element directly, not through R3F's event system

## Fix

### 1. `src/components/3d/SpawnPointMarker.tsx`
- Increase the invisible drag plane from `0.8×0.8` to `100×100` so the pointer stays captured during drag
- Only show the large plane while dragging (render conditionally or toggle visibility)

### 2. `src/components/tabs/DesignTab.tsx`
- Track a `isDraggingSpawn` state
- Pass it to SpawnPointMarker via a callback (`onDragStart`/`onDragEnd`)
- Add `isDraggingSpawn` to the OrbitControls `enabled` condition: `enabled={!isDragging && !isDraggingFixture && !isDraggingSpawn}`

## Files Modified

| File | Change |
|---|---|
| `src/components/3d/SpawnPointMarker.tsx` | Large drag plane while dragging, expose `onDragStart`/`onDragEnd` callbacks |
| `src/components/tabs/DesignTab.tsx` | Track `isDraggingSpawn`, disable OrbitControls during spawn drag |

