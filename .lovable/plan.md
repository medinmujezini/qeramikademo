

# Fix: GLB Curtain Model Positioning — Flush Against Wall

## Problem

The `CurtainGLTFModel` component centers the GLB model at origin (line 55-58), which means half the model's depth goes **into** the wall and windows. The curtain should sit entirely in front of the wall — back face flush, front face facing into the room.

Additionally, the wall offset on line 129 is only 5mm, which is fine for flat box geometry but insufficient for a 3D GLB model that has real depth.

## Root Cause

In `CurtainGLTFModel`, after scaling, the model is re-centered on all three axes including Z (depth). This places half the curtain behind the wall. Instead, the Z positioning should align the model's **back face** (max Z in wall-normal direction) to the wall surface — pushing the entire model outward.

## Changes — `src/components/3d/Curtain3D.tsx`

**Change 1: Fix CurtainGLTFModel Z-positioning (lines 55-58)**

After computing the bounding box post-scale, instead of centering on Z, position so the model's back is at Z=0 (the wall surface). The model should extend outward (positive Z in the curtain's local space):

- X: center as before (center horizontally)
- Y: center as before (center vertically)  
- Z: instead of `-center.z * uniformScale`, use `-box.max.z * uniformScale` — this pushes the entire model so its back face sits at Z=0, with the rest extending outward

**Change 2: Adjust wall offset for GLB models (around line 129)**

When a GLB model is present, use a slightly larger offset so the back of the curtain doesn't clip into the wall. Compute offset as `(wallThickness * scale / 2) + 0.01` for GLB models (10mm clearance) vs the current 5mm for flat geometry. This accounts for minor model irregularities.

**Change 3: Don't override all material colors unconditionally (lines 62-82)**

Currently every mesh material gets its color replaced with `fabricColor`. This destroys the GLB model's original textures (the floral pattern shown in the reference image). Change to: only set color if the user's `fabricColor` is not the default white/cream, OR better — skip color override entirely for GLB models since the model already has its own textures and materials. The `roughness` override can stay.

Actually, looking at this more carefully: the user uploaded a model that has its own pattern/texture. Overriding color destroys that. The fix should **not override color** on GLB models — just use the model's original materials as-is. Remove the `newMat.color.set(fabricColor)` line for GLB curtains.

## Summary of changes

| What | Current | Fixed |
|---|---|---|
| GLB Z-position | Centered (half in wall) | Back face at Z=0, extends outward |
| Wall offset for GLB | 5mm | 10mm |
| Material color override | Replaces all mesh colors | Preserves original model textures |

One file: `src/components/3d/Curtain3D.tsx`

