

# Stairs: 2D Canvas Rendering, Drag, Toolbar Tool, GLB Upload

## Overview

Add staircase visibility and interaction in the 2D floor plan canvas, a dedicated staircase tool in the toolbar, and custom GLB model upload support. Also fix the `DesignScene` runtime error (useFloorPlanContext outside provider).

## Technical Plan

### 1. Fix runtime error: DesignScene uses useFloorPlanContext inside R3F Canvas
**File: `src/components/tabs/DesignTab.tsx`** (~line 630)

`DesignScene` calls `useFloorPlanContext()` but renders inside `<Canvas>` which is outside the React context tree. Fix: extract the needed values (`staircases`, `building`, `activeLevel`, `selectedStaircaseId`, `setSelectedStaircaseId`, `showAdjacentFloors`, `getFloorPlanForLevel`) in the parent `DesignTab` component and pass them as props to `DesignScene`.

### 2. Add `customGlbUrl` to Staircase type
**File: `src/types/multiFloor.ts`**

Add `customGlbUrl?: string;` to the `Staircase` interface.

### 3. Add `staircase` to Tool type + toolbar button
**File: `src/components/toolbars/FloorPlanToolbar.tsx`**

- Change Tool type to include `'staircase'`
- Add `ArrowUpDown` icon button after the Column button
- When active, show highlighted state

**File: `src/components/floor-plan/Canvas2D.tsx`**

- Update local Tool type to include `'staircase'`

**File: `src/components/tabs/FloorPlanTab.tsx`**

- Update local Tool type to include `'staircase'`

### 4. Canvas2D staircase rendering + selection + drag
**File: `src/components/floor-plan/Canvas2D.tsx`**

- Import `staircases`, `activeLevel`, `building`, `selectedStaircaseId`, `setSelectedStaircaseId`, `updateStaircase`, `addStaircase` from `useFloorPlanContext()`
- **Draw function**: After existing elements, render each staircase where `fromLevel === activeLevel`:
  - Gold semi-transparent filled rect at `(stair.x, stair.y)` sized `stair.width × stair.depth`
  - Parallel horizontal lines inside for treads
  - Arrow pointing up for direction
  - Gold border, thicker if selected
- **`findStaircaseAt(x, y)`**: Hit-test helper checking if point is inside staircase rect (accounting for rotation)
- **Selection**: In `handleMouseDown` select tool section, check `findStaircaseAt` before the wall check. If found, call `setSelectedStaircaseId(stair.id)` and `setSelectedElement(null)` (staircase selection is separate)
- **Drag state**: Add `draggedStaircase` + `staircaseOffset` state. On mousedown if staircase found, start drag. On mousemove, update position via `updateStaircase(id, { x, y })`. On mouseup, clear drag.
- **Staircase tool click**: When `activeTool === 'staircase'` and clicked, check `building.floors.length >= 2`. If not, toast "Add a floor above first". Otherwise call `addStaircase('straight', snappedWorld.x, snappedWorld.y)`, then switch to select and select the new staircase.
- **Cursor**: Show `move` cursor when hovering over a staircase in select mode.

### 5. GLB upload in StaircasePropertiesPanel
**File: `src/components/3d/StaircasePropertiesPanel.tsx`**

- Add a file input button labeled "Upload Custom Model (.glb)"
- On file select: `URL.createObjectURL(file)` → `updateStaircase(stair.id, { customGlbUrl: url })`
- When `stair.customGlbUrl` exists, show filename + "Remove Custom Model" button that sets `customGlbUrl` to `undefined`

### 6. Custom GLB rendering in Staircase3D
**File: `src/components/3d/Staircase3D.tsx`**

- When `staircase.customGlbUrl` exists, use `useGLTF(staircase.customGlbUrl)` to load the model
- Render the loaded scene clone instead of procedural geometry
- Keep procedural geometry as fallback when no custom URL
- Use a conditional split: two sub-components (`CustomStaircase3D` and `ProceduralStaircase3D`) to avoid hook ordering issues with conditional `useGLTF`

## Files Modified

| File | Change |
|---|---|
| `src/types/multiFloor.ts` | Add `customGlbUrl?: string` to Staircase |
| `src/components/toolbars/FloorPlanToolbar.tsx` | Add `staircase` to Tool type, add stairs button |
| `src/components/tabs/FloorPlanTab.tsx` | Add `staircase` to Tool type |
| `src/components/floor-plan/Canvas2D.tsx` | Add `staircase` to Tool type, render 2D symbols, selection, drag, staircase tool placement |
| `src/components/3d/StaircasePropertiesPanel.tsx` | Add GLB upload/remove UI |
| `src/components/3d/Staircase3D.tsx` | Add custom GLB rendering with useGLTF |
| `src/components/tabs/DesignTab.tsx` | Fix DesignScene context error — pass context values as props |

