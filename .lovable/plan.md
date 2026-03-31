

# Add Robust Emissive Ceiling Light System

## What the user wants

Invisible lights mounted on the ceiling that illuminate the room from above — no visible mesh panel, just the light source. This creates realistic interior lighting without visible fixtures.

## Current state

- `Ceiling3D.tsx` renders `RoomLight3D` which shows a visible emissive plane + `rectAreaLight`
- Users manually add room lights via toolbar button
- The system works but lights are visible panels, not invisible emitters

## Plan

### 1. Auto-generate ceiling emitters from room bounds

**File: `src/components/3d/Ceiling3D.tsx`**

Add an automatic emissive grid system that places invisible lights across the ceiling:

- Compute room bounds from floor plan points (already done)
- Generate a grid of invisible `pointLight` or `rectAreaLight` sources evenly spaced across the ceiling
- Grid density: ~1 light per 4m² (adaptive based on room size), with configurable density
- Lights are invisible (no mesh) — purely emissive sources just below the ceiling plane
- Default warm white color (`#fff5e6`), moderate intensity (~0.8 per light)
- Scale total intensity based on room area so small rooms aren't blown out

### 2. New `CeilingEmitter` sub-component

Inside `Ceiling3D.tsx`, add a `CeilingEmitterGrid` component:
- Takes room bounds, ceiling height, and config (density, color, intensity, enabled)
- Generates positions in a grid pattern with slight random jitter to avoid uniform shadows
- Each emitter is a `pointLight` with `castShadow={false}` (for performance) and `decay={2}` for realistic falloff
- Tag with `userData={{ editorOnly: false }}` so they export to GLB
- For Unreal export: also add dim `rectAreaLight` sources at key positions for better GI

### 3. Add controls to `DesignTab.tsx` toolbar

Add a toggle and intensity slider near the existing Ceiling toggle:
- "Auto Lights" switch (on by default)
- Intensity slider (0.2–3.0)
- Color picker (warm white default)
- Density selector: sparse / normal / dense

### 4. Export support

**File: `src/utils/roomManifest.ts`**
- Add `emissiveLights` array to manifest with positions, intensities, colors
- Unreal side can recreate these as point lights or rect lights

### 5. GLB export cleanup

**File: `src/utils/glbExporter.ts`**
- Ensure invisible light markers (empty groups with metadata) are included in export for Unreal to parse

## Files Modified

| File | Change |
|---|---|
| `src/components/3d/Ceiling3D.tsx` | Add `CeilingEmitterGrid` component with auto-placed invisible lights |
| `src/components/tabs/DesignTab.tsx` | Add auto-light controls (toggle, intensity, color, density) to toolbar |
| `src/types/floorPlan.ts` | Add `CeilingEmitterConfig` interface to FloorPlan |
| `src/utils/roomManifest.ts` | Include emitter grid in manifest for Unreal |

