

# Fix Staircase Issues: Selection, Resize, Finishes Tab, 3D Placement

## Issues

1. **Selection unresponsive in Room Layout** — clicking a staircase immediately starts dragging instead of just selecting. The `handleMouseDown` sets `draggedStaircase` on first click, making simple click-to-select impossible. Need to differentiate click vs drag (use mouseup without movement for selection).

2. **No resize controls** — staircases have fixed width/depth from `calculateStaircaseGeometry`. The `StaircasePropertiesPanel` has width/depth sliders but the 2D canvas shows no resize handles. Need width/depth inputs in `PropertiesPanel` when a staircase is selected (similar to how wall properties show).

3. **Stairs missing in Finishes tab** — `TilesCanvas.tsx` only draws walls, doors, and windows. It never reads `staircases` from context. Need to render the same gold staircase symbol there (non-interactive, just visual).

4. **3D: stairs on both floors + sticking out** — In `DesignTab.tsx` line 950, the filter is `s.fromLevel === activeLevel || s.toLevel === activeLevel`, which renders the staircase on BOTH the ground and first floor. Should only render on `fromLevel === activeLevel`. Also the staircase position is absolute (`stair.x`, `stair.y`) but may be placed outside room bounds — the user needs resize to fix that.

## Technical Plan

### 1. Fix click-to-select vs drag in Canvas2D
**File: `src/components/floor-plan/Canvas2D.tsx`**

- On mousedown with staircase hit: store the staircase ID and click position but do NOT set `draggedStaircase` yet. Set a `pendingStaircaseDrag` state.
- On mousemove: if `pendingStaircaseDrag` and mouse moved > 5px, promote to `draggedStaircase`.
- On mouseup: if `pendingStaircaseDrag` and mouse didn't move (no drag), just select via `setSelectedStaircaseId`. Show properties panel.

### 2. Show staircase properties in PropertiesPanel
**File: `src/components/floor-plan/PropertiesPanel.tsx`**

- Read `selectedStaircaseId`, `staircases`, `updateStaircase`, `removeStaircase`, `setSelectedStaircaseId` from context.
- When `selectedStaircaseId` is set (and no wall/fixture selected), render a staircase properties card with:
  - Type display (read-only label)
  - Width slider (60-200 cm)
  - Depth slider (100-600 cm)  
  - Stair width slider (60-150 cm)
  - Tread depth slider (20-35 cm)
  - Rotation slider (0-360)
  - Position X/Y inputs
  - Delete button (calls `removeStaircase`)
- Changing width/depth calls `updateStaircase` which updates both 2D and 3D.

### 3. Render staircases in Finishes tab (TilesCanvas)
**File: `src/components/tiles/TilesCanvas.tsx`**

- Import `staircases`, `activeLevel` from `useFloorPlanContext()`.
- In the draw function, after drawing walls/doors/windows, draw each staircase where `fromLevel === activeLevel` as a semi-transparent gold rectangle with tread lines (same visual as Canvas2D but non-interactive).

### 4. Fix 3D: only render staircase on fromLevel
**File: `src/components/tabs/DesignTab.tsx`** (line 950)

Change filter from:
```ts
.filter(s => s.fromLevel === activeLevel || s.toLevel === activeLevel)
```
To:
```ts
.filter(s => s.fromLevel === activeLevel)
```

This ensures the staircase only appears once, on the floor where it starts.

## Files Modified

| File | Change |
|---|---|
| `src/components/floor-plan/Canvas2D.tsx` | Click vs drag differentiation for staircases |
| `src/components/floor-plan/PropertiesPanel.tsx` | Add staircase properties section with resize controls + delete |
| `src/components/tiles/TilesCanvas.tsx` | Render staircase symbols on Finishes tab |
| `src/components/tabs/DesignTab.tsx` | Fix filter to only show staircase on fromLevel |

