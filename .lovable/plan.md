

# 5-Step Plan: Connected Wall Geometry (Seamless Corners)

## Problem

Each wall is an independent `ExtrudeGeometry` mesh positioned at its midpoint. At shared endpoints (corners), walls don't extend far enough to meet, leaving visible gaps as shown in the screenshot. The `wallJunctionGeometry.ts` utility already exists with `analyzeWallJunctions()` and `getWallExtension()` but is **not wired into the rendering**.

## Current Architecture

- `Wall3D` component in `DesignTab.tsx` (line 268) computes wall length from start/end points, creates an extruded shape via `createWallShapeWithOpenings`, and positions the mesh at the midpoint
- Wall thickness is extruded symmetrically (`translate(0, 0, -halfThick)`)
- No junction awareness — each wall is an island

---

## Step 1 — Wire Junction Analysis into DesignScene

**File: `src/components/tabs/DesignTab.tsx`**

- Import `analyzeWallJunctions` and `getWallExtension` from `wallJunctionGeometry.ts`
- In `DesignScene`, compute junctions once via `useMemo` from `floorPlan.walls` and `floorPlan.points`
- Pass `junctions` array down to each `Wall3D` and `TiledWall3DWithMaterial`

## Step 2 — Extend Wall Geometry at Junction Points

**File: `src/components/tabs/DesignTab.tsx` (Wall3D component)**

- Accept `startExtension` and `endExtension` props (in cm, from `getWallExtension`)
- Convert extensions to scene units (`* scale`)
- Before computing `length`, extend the wall's effective start/end positions along the wall direction by the extension amounts
- Update the `midX`/`midZ` (mesh position) to account for the shifted center
- The `createWallShapeWithOpenings` call uses the extended `length`

This makes walls physically longer at corners so they overlap and form a solid joint.

## Step 3 — Apply Same Extensions to TiledWall3D

**File: `src/components/3d/TiledWall3D.tsx`**

- Accept `startExtension` and `endExtension` props
- Extend the wall length used for tile placement and shape generation
- Adjust the mesh position offset to match
- Ensures tiled walls also have seamless corners

## Step 4 — Fix the Junction Math for All Cases

**File: `src/utils/wallJunctionGeometry.ts`**

- The current miter math uses a simplified `(thickness/2) / tan(halfAngle)` which can produce wrong values for obtuse angles
- Fix: use `abs(angle difference)` properly, handle the 180° (collinear) case gracefully
- Add handling for walls with different thicknesses at a junction (use the thicker wall's extension)
- Cap extensions to prevent visual artifacts at very acute angles (< 15°)

## Step 5 — Door/Window Offset Correction

**Files: `src/components/tabs/DesignTab.tsx`, `src/components/3d/Door3D.tsx`, `src/components/3d/Window3D.tsx`**

- When walls are extended, door and window positions (defined as `position` along the wall length 0–1) shift because the wall is now longer
- Remap door/window `position` values to account for `startExtension`: `adjustedPosition = (originalPosition * originalLength + startExtension) / extendedLength`
- Apply this remapping when passing doors/windows to `Wall3D` and `Door3D`/`Window3D` position calculations

---

## Summary

| Step | File(s) | What |
|---|---|---|
| 1 | `DesignTab.tsx` | Compute junctions, pass to wall components |
| 2 | `DesignTab.tsx` (Wall3D) | Extend wall mesh length at junction endpoints |
| 3 | `TiledWall3D.tsx` | Same extension logic for tiled walls |
| 4 | `wallJunctionGeometry.ts` | Fix miter math for all angle cases |
| 5 | `DesignTab.tsx`, `Door3D`, `Window3D` | Correct door/window positions on extended walls |

