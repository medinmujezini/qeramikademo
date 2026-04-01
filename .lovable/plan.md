

# Multi-Floor: New Floor Dialog + Structural Walls

## What Changes

1. When the user clicks "Add Floor," a dialog appears asking for floor name, height (cm), and whether to copy outer walls from the floor below as locked structural walls.
2. Structural walls (`isStructural: true`) render with a gold outline in Canvas2D and cannot be selected, moved, or deleted.
3. FloorManager shows a lock icon with structural wall count per floor.

## Technical Plan

### 1. Add `isStructural` to Wall type
**File: `src/types/floorPlan.ts`** (line ~37)

Add `isStructural?: boolean;` to the `Wall` interface.

### 2. Update `addFloor` signature in context
**File: `src/contexts/FloorPlanContext.tsx`**

- Change `addFloor` type from `() => void` to `(options?: { name?: string; height?: number; copyOuterWalls?: boolean }) => void`
- In the implementation (~line 178), accept the options object:
  - Use `options.name` and `options.height` if provided, otherwise defaults
  - If `copyOuterWalls` is true, find the current active floor's walls, identify perimeter walls (walls that form the outermost boundary — simplification: copy ALL walls from the floor below and mark them `isStructural: true`), clone those walls and their points into the new floor plan

### 3. Create NewFloorDialog component
**New file: `src/components/floor-plan/NewFloorDialog.tsx`**

A `Dialog` with:
- Floor name input (default: "Floor N")
- Floor-to-floor height input (default: 300, range 200-600)
- Checkbox: "Copy outside walls from floor below" (disabled if no floor below)
- Cancel / Create buttons
- On create: calls `addFloor({ name, height, copyOuterWalls })`

### 4. Update FloorManager to show dialog instead of direct add
**File: `src/components/floor-plan/FloorManager.tsx`**

- Add state `showNewFloorDialog`
- Change the "Add" button onClick to open the dialog instead of calling `addFloor()` directly
- Import and render `NewFloorDialog`
- Add structural wall count per floor: count walls where `isStructural === true` in each floor's plan, show a `Lock` icon + count next to the height line

### 5. Protect structural walls in Canvas2D
**File: `src/components/floor-plan/Canvas2D.tsx`**

- In `findWallAt()`: skip walls where `isStructural === true` (prevents selection)
- In `draw()`: render structural walls with a gold stroke (`#C9A96E`) and slightly thicker line
- In delete handlers: skip structural walls

### 6. Protect structural walls in PropertiesPanel
**File: `src/components/floor-plan/PropertiesPanel.tsx`**

- If the selected wall is structural, show a read-only view with a "Structural Wall" badge and disable edit/delete controls

## Files Modified

| File | Change |
|---|---|
| `src/types/floorPlan.ts` | Add `isStructural?: boolean` to `Wall` |
| `src/contexts/FloorPlanContext.tsx` | Update `addFloor` to accept options, copy walls logic |
| New `src/components/floor-plan/NewFloorDialog.tsx` | Dialog for name, height, copy walls checkbox |
| `src/components/floor-plan/FloorManager.tsx` | Show dialog on Add, display structural wall count with lock icon |
| `src/components/floor-plan/Canvas2D.tsx` | Gold outline for structural walls, prevent selection/deletion |
| `src/components/floor-plan/PropertiesPanel.tsx` | Read-only mode for structural walls |

