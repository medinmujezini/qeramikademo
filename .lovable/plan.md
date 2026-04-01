

# Remove Floor Slab + Fix Ghost Floor Height

## Changes

### 1. Remove FloorSlab3D import
**File: `src/components/tabs/DesignTab.tsx`** (line 32)

Delete the `import { FloorSlab3D }` line.

### 2. Remove floor slab rendering block
**File: `src/components/tabs/DesignTab.tsx`** (lines 970-982)

Delete the entire `{/* Floor slabs for upper floors */}` block including the `.filter().map()` that renders `<FloorSlab3D>`.

### 3. Fix ghost floor yOffset calculation
**File: `src/components/tabs/DesignTab.tsx`** (line 993)

Replace:
```ts
const yOffset = (level - activeLevel) * floor.floorToFloorHeight * CM_TO_METERS;
```
With:
```ts
const activeFloor = building.floors.find(f => f.level === activeLevel);
const yOffset = (level - activeLevel) * (activeFloor?.floorToFloorHeight ?? 300) * CM_TO_METERS;
```

This uses the **active floor's** height for consistent vertical spacing instead of each ghost floor's own height.

## Files Modified

| File | Change |
|---|---|
| `src/components/tabs/DesignTab.tsx` | Remove FloorSlab3D import, delete slab rendering block, fix ghost yOffset |

