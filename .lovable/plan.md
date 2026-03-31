

# Fix: Include Ceiling and Lights in Unreal GLB Export

## Problem

The GLB export runs **before** `setShowCeiling(true)` — so the ceiling mesh and room lights are not in the scene at export time. The emitter grid (`pointLight`s) always renders but GLTFExporter needs `KHR_lights_punctual` extension support to include them, and the manifest already describes lights separately.

## Two Issues to Fix

### 1. Force ceiling visible before export snapshot

**File: `src/components/tabs/DesignTab.tsx`**

In `enterWalkthrough`, move the ceiling visibility toggle **before** the GLB export call:

- Set `ceilingBeforeWalkRef.current = showCeiling` and `setShowCeiling(true)` before the export
- Add a short `await new Promise(r => setTimeout(r, 100))` to let React re-render the ceiling into the scene
- Then run `exportSceneToGLBBlob(scene)`

This ensures the ceiling mesh exists in the Three.js scene graph when the exporter clones it.

### 2. Ensure ceiling mesh exports as double-sided

**File: `src/utils/glbExporter.ts`**

The ceiling mesh is named `"ceiling"` — verify it's not accidentally stripped by `isEditorObject`. Currently it isn't (no pattern match), so it will export correctly once visible. The `DoubleSide` material is already set in `Ceiling3D.tsx`.

For lights: Three.js `GLTFExporter` does not export `pointLight` objects by default (needs `KHR_lights_punctual`). The manifest already includes emitter data for Unreal to create its own lights, so this is fine — Unreal should use the manifest `emissiveLights` array, not the GLB lights.

## Files Modified

| File | Change |
|---|---|
| `src/components/tabs/DesignTab.tsx` | Move ceiling visibility ON before GLB export, add render delay |

