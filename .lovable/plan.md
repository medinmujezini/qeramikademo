

# Fix: Kitchen Block Colors and Materials Not Rendering Properly

## Problems Found

After reviewing the code, several issues prevent colors and materials from displaying correctly:

1. **Appliance colors are hardcoded**: Lines 48-49 in `KitchenBlock3D.tsx` set `bodyColor = '#e0e0e0'` and `frontColor = '#d0d0d0'` for all appliance types, completely ignoring the user's `cabinetColor` setting.

2. **Countertop materials look identical**: Only `steel` gets different material properties (metalness 0.8). Granite, marble, quartz, and wood all render with the same roughness=0.3 / metalness=0.1 — visually indistinguishable.

3. **No material-appropriate colors**: Changing countertop material doesn't affect appearance beyond a tiny metalness difference. Real granite looks different from marble, which looks different from wood.

4. **Handle color is hardcoded**: Always `#888` regardless of material choice — no chrome/brass/black options.

## Plan

### 1. Fix appliance colors (KitchenBlock3D.tsx)
Remove the hardcoded grey override. Use `block.cabinetColor` for all block types. Add a subtle steel-tint overlay only for the appliance front face (slightly desaturated version of cabinet color) rather than ignoring the color entirely.

### 2. Add material-specific rendering properties
Create a `COUNTERTOP_MATERIAL_PROPS` lookup that maps each material to distinct visual properties:

| Material | Roughness | Metalness | Color tint behavior |
|----------|-----------|-----------|---------------------|
| Granite  | 0.6       | 0.05      | Speckled darker tone |
| Marble   | 0.2       | 0.05      | Slightly veined/lighter |
| Quartz   | 0.15      | 0.1       | Clean, uniform |
| Wood     | 0.8       | 0.0       | Warm brown shift |
| Steel    | 0.1       | 0.9       | Reflective silver |

Apply these per-material properties to the countertop slab mesh so each material looks visually distinct.

### 3. Add handle material variation
Map handle style to appropriate metalness/color:
- Bar: chrome (#c0c0c0, metalness 0.9)
- Knob: brushed nickel (#a0a0a0, metalness 0.7)

### 4. Ensure reactivity
Wrap material computations in `useMemo` keyed on the block's color/material props so Three.js materials update when the user changes them in the properties panel.

## Files changed
- `src/components/3d/KitchenBlock3D.tsx` — all rendering fixes

