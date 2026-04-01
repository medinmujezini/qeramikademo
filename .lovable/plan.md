

# Second Floor Editing Robustness

## What Changes

1. **Quick floor-switching chevrons** next to FloorManager in the 3D toolbar
2. **Ghost wall overlays** in the 2D Canvas (Room Layout) — blue below, orange above, non-interactive
3. **Solid ghost walls + floor slabs** in the 3D view replacing current wireframes

## Technical Plan

### 1. Floor level chevrons — `src/components/tabs/DesignTab.tsx`

**Line 44**: Add `ChevronUp, ChevronDown` to the lucide-react import.

**After line 1833** (`<FloorManager />`): Insert up/down chevron buttons using existing `building`, `activeLevel`, `setActiveLevel` from context. Disable when no floor exists in that direction.

```tsx
<Button variant="ghost" size="icon" className="h-6 w-6"
  disabled={!building.floors.some(f => f.level > activeLevel)}
  onClick={() => setActiveLevel(activeLevel + 1)}>
  <ChevronUp className="h-3 w-3" />
</Button>
<Button variant="ghost" size="icon" className="h-6 w-6"
  disabled={!building.floors.some(f => f.level < activeLevel)}
  onClick={() => setActiveLevel(activeLevel - 1)}>
  <ChevronDown className="h-3 w-3" />
</Button>
```

### 2. Ghost wall overlay in 2D — `src/components/floor-plan/Canvas2D.tsx`

**Context destructuring (line 70-80)**: Add `showAdjacentFloors`, `getFloorPlanForLevel` from `useFloorPlanContext()`.

**In `draw()` function, after grid drawing (line 348) and before active wall drawing (line 350)**: Insert a ghost wall rendering block. For each adjacent level (`activeLevel ± 1`), get the floor plan via `getFloorPlanForLevel()` and draw each wall as a simple filled rectangle:
- Floor below: `rgba(59, 130, 246, 0.20)` (blue)
- Floor above: `rgba(249, 115, 22, 0.15)` (orange)

Uses the same wall-rectangle math as active walls (compute angle from start→end, translate/rotate context, `fillRect` with wall thickness × length). No dimension labels, no interaction, no hit-testing.

### 3. Solid ghost walls + slabs in 3D — `src/components/tabs/DesignTab.tsx`

**Lines 1006**: Change `meshBasicMaterial` to `meshStandardMaterial` with `color="#999"`, `transparent`, `opacity={0.25}`, `depthWrite={false}`. Remove `wireframe`.

**After the ghost walls group (line 1009)**, add a floor slab mesh for each ghost level that has a `slab` property:
- Compute room bounds from `ghostPlan.points`
- Slab height from `floor.slab.thickness` (default 20cm) × `CM_TO_METERS`
- Position at `yOffset` (bottom of that level)
- Render as `<boxGeometry>` with neutral gray 30% opacity material

## Files Modified

| File | Change |
|---|---|
| `src/components/tabs/DesignTab.tsx` | Add ChevronUp/Down chevrons; upgrade ghost walls to solid + add slab meshes |
| `src/components/floor-plan/Canvas2D.tsx` | Add ghost wall overlay for adjacent floors before active walls |

