

# Robust Second Floor & High-Quality Staircase System — Enhanced Plan

## Issues Found Beyond Original Analysis

### Bug A: Rotation hit-test sign mismatch (confirmed still present)
Line 267: `const rad = -(stair.rotation * Math.PI) / 180` (negative)
Line 978: `ctx.rotate((stair.rotation * Math.PI) / 180)` (positive)
The inverse rotation for hit-testing uses the wrong formula. After positive rotation, the inverse transform should be:
```
localX = dx * cos + dy * sin
localY = -dx * sin + dy * cos
```
Currently it uses `dx * cos - dy * sin` / `dx * sin + dy * cos` which is wrong for the sign.

### Bug B: Width/depth sliders don't recalculate tread geometry
Lines 122-127 in PropertiesPanel set `width` and `depth` directly without calling `calculateStaircaseGeometry`. The `StaircasePropertiesPanel` component (already exists) handles this correctly via `handleWidthChange`/`handleTreadDepthChange`. The inline panel should be replaced.

### Bug C: No keyboard delete/rotate for staircases
Lines 1699-1749: The Delete handler only checks `selectedElement`, never `selectedStaircaseId`. The R-key handler also ignores staircases.

### Bug D: Duplicate `break` statement
Line 1714-1715: There's a double `break` after the wall delete case — harmless but sloppy.

### Bug E: No hover highlight for staircases
The draw code has no visual distinction when hovering over a staircase in select mode — unlike walls/fixtures which change cursor. No fill change on hover.

### Bug F: Staircase drag has no room boundary clamping
Line 1463-1465: Drag updates position without constraining to room bounds. Stairs can be dragged outside walls.

### Missing: `hoveredStaircaseId` state doesn't exist
Need to add state tracking + mousemove detection for hover.

## Plan

### 1. Replace inline staircase panel with StaircasePropertiesPanel
**File: `src/components/floor-plan/PropertiesPanel.tsx`** (lines 91-189)

Replace the entire inline staircase block with:
```tsx
import { StaircasePropertiesPanel } from '@/components/3d/StaircasePropertiesPanel';

if (selectedStaircaseId && !selectedElement) {
  return (
    <Card className="h-full border-border overflow-auto">
      <StaircasePropertiesPanel />
    </Card>
  );
}
```
This uses the existing component that correctly calls `calculateStaircaseGeometry` on dimension changes and includes GLB upload support.

### 2. Fix rotation hit-test
**File: `src/components/floor-plan/Canvas2D.tsx`** (lines 267-274)

Change the inverse rotation math:
```tsx
const rad = (stair.rotation * Math.PI) / 180; // positive, matching draw
const cos = Math.cos(rad);
const sin = Math.sin(rad);
const dx = worldX - stair.x;
const dy = worldY - stair.y;
const localX = dx * cos + dy * sin;   // correct inverse
const localY = -dx * sin + dy * cos;  // correct inverse
```

### 3. Add keyboard shortcuts for staircases
**File: `src/components/floor-plan/Canvas2D.tsx`** (lines 1699-1749)

In the Delete/Backspace handler (after the `selectedElement` block), add:
```tsx
if (selectedStaircaseId) {
  removeStaircase(selectedStaircaseId);
  setSelectedStaircaseId(null);
}
```

In the R-key handler, add:
```tsx
if (selectedStaircaseId) {
  const stair = staircases.find(s => s.id === selectedStaircaseId);
  if (stair) updateStaircase(selectedStaircaseId, { rotation: (stair.rotation + 90) % 360 });
}
```

Add `removeStaircase`, `selectedStaircaseId`, `setSelectedStaircaseId`, `updateStaircase`, `staircases` to the `useCallback` deps array (line 1749).

### 4. Add hover highlight for staircases
**File: `src/components/floor-plan/Canvas2D.tsx`**

Add `hoveredStaircaseId` state. In `handleMouseMove`, when `activeTool === 'select'` and not dragging, call `findStaircaseAt` and set `hoveredStaircaseId`.

In the staircase draw block (line 985), use a brighter fill when hovered:
```tsx
const isHovered = hoveredStaircaseId === stair.id;
ctx.fillStyle = isDragging ? 'hsla(38, 60%, 68%, 0.4)' 
  : isHovered ? 'hsla(38, 60%, 68%, 0.3)' 
  : 'hsla(38, 60%, 68%, 0.2)';
```

### 5. Clamp staircase drag to room bounds
**File: `src/components/floor-plan/Canvas2D.tsx`** (lines 1461-1466)

After computing `newX`/`newY`, clamp to room bounding box:
```tsx
const pts = floorPlan.points;
if (pts.length > 0) {
  const minX = Math.min(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxX = Math.max(...pts.map(p => p.x));
  const maxY = Math.max(...pts.map(p => p.y));
  const stair = staircases.find(s => s.id === draggedStaircase);
  if (stair) {
    newX = Math.max(minX, Math.min(newX, maxX - stair.width));
    newY = Math.max(minY, Math.min(newY, maxY - stair.depth));
  }
}
```

### 6. Fix duplicate break statement
**File: `src/components/floor-plan/Canvas2D.tsx`** (line 1715)

Remove the extra `break;` after the wall delete case.

## Files Modified

| File | Change |
|---|---|
| `src/components/floor-plan/PropertiesPanel.tsx` | Replace inline staircase section with `StaircasePropertiesPanel` |
| `src/components/floor-plan/Canvas2D.tsx` | Fix rotation hit-test, add Delete/R keyboard shortcuts, hover highlight, room bounds clamping, remove duplicate break |

