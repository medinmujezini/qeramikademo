

# Add Carpets & Ceiling Lights to Furniture Library

## Overview

Add two new furniture categories: **Decor** (carpets/rugs) and **Lighting** (ceiling lights). Carpets are flat floor items that collide with other furniture. Ceiling lights are furniture items rendered at ceiling height with an actual light source.

## Changes

### 1. `src/data/furnitureLibrary.ts` — New types, templates

- Add `'decor' | 'lighting'` to `FurnitureCategory`
- Add new `FurnitureType` values: `'rug-small'`, `'rug-medium'`, `'rug-large'`, `'rug-runner'`, `'ceiling-light-round'`, `'ceiling-light-square'`, `'chandelier'`, `'pendant-light'`
- Add templates with realistic dimensions (rugs: height ~1cm so they sit flat; lights: small bounding box e.g. 40×40×20cm)
- Add all to `FURNITURE_TEMPLATES` array and update `getFurnitureByCategory`

### 2. `src/components/design/UnifiedLibrary.tsx` — Category icons

- Add entries to `FURNITURE_CATEGORY_ICONS`: `decor` → `Sparkles` icon, `lighting` → `Lightbulb` icon
- Add `'rug'` and `'lamp'`/`'lightbulb'` to the `DynamicIcon` icon map

### 3. `src/components/3d/Furniture3D.tsx` — Ceiling light rendering

- Detect lighting category items (`item.category === 'lighting'`)
- Override Y position: instead of ground level (`groundOffset`), place at `ceilingHeight - itemHeight` (ceiling height from a new optional prop or constant 280cm default)
- Attach a Three.js `pointLight` or `spotLight` as a child of lighting furniture items, with configurable intensity based on item color

### 4. `src/components/3d/BlueprintBox.tsx` — Carpet/light placeholders

- For carpet items (height < 5cm): render as a flat plane instead of a box
- For lighting items: position at ceiling height

### 5. `src/components/3d/FurnitureScene.tsx` — Pass ceiling height

- Pass `ceilingHeight` prop (from `floorPlan.walls[0]?.height ?? 280`) to `Furniture3D` for lighting items
- Carpets already use standard collision — no changes needed since they're regular furniture with tiny height

## Technical Details

- Carpets collide normally via existing `furnitureCollision.ts` — their width/depth bounding box handles this
- Ceiling lights use the existing furniture drag system but are rendered at ceiling Y position
- Light emission uses `pointLight` attached to the furniture group, intensity ~2-5
- No database migration needed — hardcoded templates (DB templates optional via admin)

## Files Modified

| File | Change |
|---|---|
| `src/data/furnitureLibrary.ts` | New category types + 8 templates (4 rugs, 4 lights) |
| `src/components/design/UnifiedLibrary.tsx` | Category icons for decor & lighting |
| `src/components/3d/Furniture3D.tsx` | Ceiling-height positioning + point light for lighting items |
| `src/components/3d/BlueprintBox.tsx` | Flat plane for carpets, ceiling position for lights |
| `src/components/3d/FurnitureScene.tsx` | Pass ceilingHeight to Furniture3D |

