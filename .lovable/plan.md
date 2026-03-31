

# Fix Triplanar Material Artifacts (Wave/Ripple Pattern)

## Problem

The screenshot shows concentric wave/ripple patterns on all wall and ceiling surfaces. This happens because the `createTriplanarMaterial` function replaces `#include <map_fragment>` in the fragment shader with triplanar sampling code even when a texture IS provided — but the real issue is that when `texture` is a canvas-based or procedural texture, the triplanar projection coordinates (`worldPos.yz`, `.xz`, `.xy`) create visible moiré interference patterns at certain scales and viewing angles.

For **plain walls** (no texture), the function correctly returns early without shader injection — so the artifacts are from walls/surfaces that DO have a texture assigned.

## Root Cause

The `textureScale: 2.0` combined with the wall dimensions creates repeating patterns that interfere visually. The ceiling surface likely has its own material with similar issues.

## Fix — 2 Changes

### 1. Only use triplanar on walls that actually need it

**File: `src/components/tabs/DesignTab.tsx`**

When `texture` is null (plain walls — which is the common case), use a regular `MeshStandardMaterial` directly instead of calling `createTriplanarMaterial`. Only use triplanar when there's an actual texture that needs to display on side faces.

### 2. Fix triplanar scale and add fallback

**File: `src/utils/triplanarMaterial.ts`**

- Change default `textureScale` from `1.0` to `0.5` (larger textures, less repetition)
- Ensure the `customProgramCacheKey` includes texture ID to prevent shader cache collisions
- Add `map` to the material constructor so Three.js knows the material uses a texture (required for the `#include <map_fragment>` code path to exist in the shader)

### 3. FloorSlab3D — remove triplanar for untextured slabs

**File: `src/components/3d/FloorSlab3D.tsx`**

Currently calls `createTriplanarMaterial` with no `map` — this should already return a plain material (early return in the function). Verify this is working correctly; if so, no change needed. If the slab shows artifacts, switch to plain `MeshStandardMaterial`.

## Files Modified

| File | Change |
|---|---|
| `src/components/tabs/DesignTab.tsx` | Use plain material for untextured walls, triplanar only when texture exists |
| `src/utils/triplanarMaterial.ts` | Fix default scale, improve cache key |
| `src/components/3d/FloorSlab3D.tsx` | Verify plain material path works (likely no change needed) |

