

# 8-Step Plan: Robust Multi-Floor System

## Current State

The data model exists (`Building`, `Floor`, `Staircase`, `FloorSlab`) and there's a basic floor selector dropdown + "Add Floor" button in the Design toolbar. However, **the system is mostly scaffolding** — the critical gap is that all floors share a single `useFloorPlan()` instance. Switching floors doesn't actually switch the floor plan. Staircases can only be added as "straight" with no type picker, no properties panel, and no slab opening sync.

---

## Step 1 — Per-Floor Floor Plan State

**Problem**: `FloorPlanContext` uses one `useFloorPlan()` hook. Switching `activeLevel` changes nothing — every floor edits the same walls/fixtures/furniture.

**Fix**: Store a `FloorPlan` inside each `Floor` object in the `Building` state. When `activeLevel` changes, serialize the current floor plan back into `building.floors[currentLevel].floorPlan` and load the new level's floor plan into the `useFloorPlan` hook via `loadFloorPlan()`.

**Files**: `src/contexts/FloorPlanContext.tsx`

---

## Step 2 — Floor Management UI

**Problem**: Can only add floors. No way to remove, rename, reorder, or set per-floor height. No visual indicator of which floor you're on.

**Fix**: Replace the minimal dropdown with a proper floor panel/popover:
- List all floors with rename inline edit
- Delete button (disabled if only 1 floor)
- Per-floor height input (floorToFloorHeight)
- Drag-reorder or up/down arrows
- "Duplicate floor" option (copies walls/layout from current floor)
- Active floor highlighted

**Files**: New `src/components/floor-plan/FloorManager.tsx`, update `DesignTab.tsx` toolbar

---

## Step 3 — Staircase Type Picker & Placement

**Problem**: Stairs button always adds a "straight" staircase at room center. No type selection, no visual placement.

**Fix**: 
- Click "Stairs" opens a popover with 4 type cards (straight, L-shaped, U-shaped, spiral) showing silhouette previews
- After selecting type, user clicks on the 3D floor to place (reuse the drag-plane pattern)
- Auto-calculate geometry from `floorToFloorHeight`
- Require a floor above to exist (show toast if not)

**Files**: New `src/components/3d/StaircasePlacer.tsx`, update `DesignTab.tsx`

---

## Step 4 — Staircase Properties Panel

**Problem**: No way to edit staircase properties after placement. Can't change type, dimensions, material, railing, or rotation.

**Fix**: When a staircase is selected in 3D (click detection):
- Show properties panel with: type selector, stair width, tread depth, tread material, railing style, rotation slider
- Auto-recalculate numTreads/riserHeight when dimensions change
- Delete button
- Position fields (x, y) for precise placement

**Files**: New `src/components/3d/StaircasePropertiesPanel.tsx`, update `DesignTab.tsx` for staircase selection state

---

## Step 5 — Auto-Sync Slab Openings with Staircases

**Problem**: `FloorSlab` has an `openings` array but nothing populates it. Staircases should automatically cut rectangular holes in the slab of the floor above.

**Fix**:
- When a staircase is added/moved/resized, auto-create/update a `SlabOpening` in the target floor's slab with matching position and dimensions (+ clearance margin)
- When a staircase is deleted, remove its linked slab opening
- Allow manual slab openings too (for light wells, double-height spaces)

**Files**: `src/contexts/FloorPlanContext.tsx` (staircase CRUD functions), `src/types/multiFloor.ts` (helper)

---

## Step 6 — Multi-Floor 3D Rendering

**Problem**: The 3D scene only renders the active floor at y=0. No ghost/wireframe of adjacent floors, no vertical stacking.

**Fix**:
- Render active floor fully at y=0
- Show floor above as transparent ghost (opacity 0.15) offset by `floorToFloorHeight * CM_TO_METERS` — walls only, no furniture
- Show floor below as subtle ghost (opacity 0.1) offset downward
- Staircases render across their full vertical span (already have `yOffset` prop)
- Toggle in toolbar: "Show adjacent floors" on/off

**Files**: `src/components/tabs/DesignTab.tsx` (DesignScene), new ghost floor rendering logic

---

## Step 7 — Multi-Floor 2D Canvas

**Problem**: The 2D canvas (`Canvas2D`) has no floor awareness. No staircase rendering in plan view, no slab openings shown.

**Fix**:
- Draw staircase footprints on the 2D canvas as dashed rectangles with direction arrows
- Draw slab openings as hatched rectangles
- Show ghost walls from floor above/below in light gray
- Floor selector in FloorPlanToolbar (or reuse the floor manager)
- Staircase click-to-select in 2D for property editing

**Files**: `src/components/floor-plan/Canvas2D.tsx`, `src/components/toolbars/FloorPlanToolbar.tsx`

---

## Step 8 — Multi-Floor GLB Export

**Problem**: Export only includes the active floor. For Unreal, we need the full building.

**Fix**:
- Export all floors stacked vertically at correct heights
- Each floor's walls/doors/windows/furniture as a named group (`Floor_0`, `Floor_1`, etc.)
- Staircases included spanning their floor range
- Floor slabs with openings included
- Manifest updated with `floors[]` array containing per-floor materials and furniture
- Option to export single floor or full building

**Files**: `src/utils/glbExporter.ts`, `src/utils/roomManifest.ts`, export UI in `DesignTab.tsx`

---

## Implementation Order

| Priority | Steps | Dependency |
|---|---|---|
| **Must-have first** | 1 | Foundation — nothing works without per-floor state |
| **Core UX** | 2, 3, 4 | Independent of each other, depend on Step 1 |
| **Structural** | 5, 6 | Depend on Steps 1-3 |
| **Completeness** | 7, 8 | Depend on Steps 1-6 |

