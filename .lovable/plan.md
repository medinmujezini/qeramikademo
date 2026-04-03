

# Enhanced Kitchen Blocks: PBR Textures + Realistic Geometry

## Overview
Three improvements: (A) PBR texture support for countertops, (B) enhanced procedural geometry for realistic cabinet details, (C) memoized geometry creation for performance.

## A. Countertop PBR Texture Support

### 1. Type update — `src/types/floorPlan.ts`
Add `countertopMaterialId?: string` to `KitchenBlock` — references a PBR material from the materials library.

### 2. Built-in procedural textures — `KitchenBlock3D.tsx`
Generate `CanvasTexture` patterns per material (marble veins, wood grain, granite speckle, quartz noise). Cache textures so they're created once per type. Steel uses high metalness only.

### 3. PBR Material Library linking — `KitchenBlock3D.tsx`
When `countertopMaterialId` is set, load albedo/normal/roughness from `MaterialContext` via `TextureLoader` and apply to the countertop slab mesh. Falls back to procedural texture if unset.

### 4. Material picker — `KitchenPropertiesPanel.tsx`
Add optional "Custom PBR Material" dropdown below countertop material, listing materials from `useMaterialContext()`. "None (use default)" clears it.

## B. Enhanced Procedural Geometry

All done with additional `<mesh>` elements in `ProceduralKitchenBlock`:

| Block Type | Details Added |
|---|---|
| Base Cabinet / Island | 10cm toe kick, door panel insets (2mm deep), center seam line, 2cm countertop overhang |
| Wall Cabinet | Panel insets, bottom edge trim strip |
| Tall Cabinet | Two-zone front with upper/lower inset panels, horizontal seam at 60% height, toe kick |
| Fridge | Recessed front panel, vertical handle bar, freezer/fridge gap line at 30% from top |
| Stove | Oven door panel below burners, handle bar, dark glass window rectangle |
| Sink | Faucet cylinder/arc on back edge |
| Dishwasher | Front panel with handle bar, status indicator strip |
| Countertop | Thin 3cm slab with front edge strip |

## C. Performance: Memoized Geometry (new addition)

Wrap the entire procedural geometry JSX tree inside `useMemo`, keyed on all relevant block properties (width, height, depth, cabinetColor, countertopColor, countertopMaterial, countertopMaterialId, handleStyle, blockType). This prevents Three.js from rebuilding the scene graph on every React render cycle when nothing changed — critical when 5-10+ blocks are placed simultaneously.

```text
Before:  ProceduralKitchenBlock renders → 20+ meshes rebuilt every frame
After:   useMemo([...deps]) → meshes only rebuilt when block properties change
```

## Files Modified
1. `src/types/floorPlan.ts` — add `countertopMaterialId`
2. `src/components/3d/KitchenBlock3D.tsx` — procedural textures, PBR loading, enhanced geometry, useMemo wrapping
3. `src/components/3d/KitchenPropertiesPanel.tsx` — PBR material picker

No database changes needed.

