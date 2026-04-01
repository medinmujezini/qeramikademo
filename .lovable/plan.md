

# Fix: Wall Heights Must Match Floor-to-Floor Height

## Problem

When creating a new floor with a custom height (e.g., 500cm), `addFloor()` sets `newFloor.floorToFloorHeight = 500` but the **cloned structural walls** retain their original `height` property (e.g., 280cm from the source floor). Result: the gap between floors grows but the actual wall meshes stay short.

## Root Cause

In `src/contexts/FloorPlanContext.tsx` line 187-188:
```ts
if (options?.height) {
  newFloor.floorToFloorHeight = options.height;
}
```
This only sets the floor metadata. The cloned walls (lines 206-212) copy the source wall's `height` as-is. No code updates wall heights to match.

## Fix

**File: `src/contexts/FloorPlanContext.tsx`**

After setting `floorToFloorHeight`, also update all walls in the new floor's plan to use the new height:

```ts
if (options?.height) {
  newFloor.floorToFloorHeight = options.height;
  // Sync wall heights to match floor height
  newFloor.floorPlan = {
    ...newFloor.floorPlan,
    walls: newFloor.floorPlan.walls.map(w => ({ ...w, height: options.height })),
  };
}
```

Move this block **after** the wall cloning section (after line 218) so it also catches cloned structural walls.

Also fix the runtime error: `DesignScene` calls `useFloorPlanContext()` but renders inside the R3F `<Canvas>` which is outside `FloorPlanProvider`. Need to pass context values as props or move the provider wrapping.

## Files Modified

| File | Change |
|---|---|
| `src/contexts/FloorPlanContext.tsx` | Move height-to-wall sync after wall cloning, update all walls in new floor |

