

# Fix: Make Cabinet Door Panels, Seams, and Handles Visible

## Problem
Panel insets, center seams, and handles exist in the geometry but are visually too subtle to see — doors look like flat colored boxes.

## Changes — `src/components/3d/KitchenBlock3D.tsx`

### 1. Door panel insets (base, island, wall cabinet — lines 240-259)
- **Inset border**: `0.015` → `0.008` (8mm gap between panel edge and cabinet edge)
- **Inset depth (Z offset)**: `d/2 + 0.002` → `d/2 + 0.006` (5mm proud of front face, up from 2mm)
- **Inset color**: `offsetHSL(0, 0, -0.04)` → `offsetHSL(0, 0, -0.15)` (15% darker than frontColor)

### 2. Tall cabinet panels (lines 270-298) — same treatment
- **Border**: `0.015` → `0.008`
- **Panel color**: same `-0.15` offset
- **Horizontal seam width**: `0.003` → `0.003` (already 3mm, keep as is)
- **Horizontal seam color**: already uses `seamColor` which is `-0.25` — keep

### 3. Center seam line (lines 260-266)
- **Width**: `0.002` → `0.003` (3mm)
- **Color**: change from `seamColor` to a computed 20% brightness version: `new THREE.Color(bodyColor).multiplyScalar(0.2).getStyle()`

### 4. Handles (lines 311-333)
- **Bar handle**: `[0.10, 0.008, 0.015]` → `[0.12, 0.01, 0.015]` (12cm long × 1cm diameter)
- **Knob handle**: `sphereGeometry args={[0.012, 8, 8]}` → `args={[0.0125, 12, 12]}` (2.5cm diameter, smoother sphere)
- **Fridge bar handle thickness**: `[0.012, bodyTop*0.6, 0.015]` → `[0.01, bodyTop*0.6, 0.015]` (1cm wide)
- **Position**: move from `bodyYCenter + bodyTop * 0.15` → `bodyYCenter + bodyTop * 0.17` (upper third) and `x` offset `0.03` from center (3cm from seam)
- **Handle colors**: already using `handleProps.color` from the chrome/nickel lookup — confirmed correct

### 5. Seam color variable (line 162)
- Change `seamColor` from `offsetHSL(0, 0, -0.25)` → use `new THREE.Color(bodyColor).multiplyScalar(0.2).getStyle()` for true 20% brightness

## One file changed
`src/components/3d/KitchenBlock3D.tsx`

