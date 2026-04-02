

# Fix Curtain Sizing & Positioning — Realistic Interior Look

## Problem
Curtains are currently sized to barely cover the window opening (+40cm width, height = wallHeight - 10). Real curtains:
- Extend 20-30cm past each side of the window (total width = window width + 50-60cm)
- For **panel/sheer**: hang from near ceiling to floor (full wall height)
- For **roman/roller/pleated** (blinds): sized to window opening + small margins
- Mount near the ceiling, not at the window frame

## Changes

### 1. `CurtainDialog.tsx` — Smart defaults by type

When a wall is selected, calculate defaults based on curtain type:

- **Panel/Sheer** (full drapes):
  - Width: window width + 60cm (30cm overhang each side)
  - Height: wallHeight - 5cm (near floor)
  - Mount height: wallHeight (ceiling)

- **Roman/Roller/Pleated** (window treatments):
  - Width: window width + 20cm (10cm overhang each side)
  - Height: window height + 20cm (10cm above frame, 10cm below sill)
  - Mount height: window sill height + window height + 10cm

Add a type-change effect that recalculates width/height defaults when the user switches curtain type.

### 2. `CurtainDialog.tsx` — Add "Hang Style" radio

Add a simple selector below dimensions:
- **Floor-length** (default for panel/sheer): height auto-set to mountHeight
- **Sill-length**: height auto-set to match window bottom
- **Custom**: manual entry

This gives users control while defaulting to the realistic option.

### 3. `Curtain3D.tsx` — Positioning fix

Currently `cy = mountH - curtainH / 2` which centers the curtain vertically from mount point. This is correct but the mount height and curtain height defaults are what make it look wrong. No geometry changes needed — the dialog defaults fix the visual.

### 4. `CurtainDialog.tsx` — Pass window dimensions to defaults

The `onConfirm` callback already receives `width`/`height`/`mountHeight`. The fix is in the `useEffect` that calculates defaults — it needs to account for curtain type and use window sill height + window height data.

Update the wall-selection effect to compute:
```
avgWindowWidth = average window width on wall
avgWindowHeight = average window height on wall  
avgSillHeight = average sill height on wall
```

Then set defaults per type as described above.

### Files to change

| File | Change |
|---|---|
| `src/components/3d/CurtainDialog.tsx` | Type-aware default sizing, hang style selector, pass window height/sill data |
| `src/components/tabs/DesignTab.tsx` | Pass `wallHeight` from actual wall height instead of hardcoded `280` |

No changes to `Curtain3D.tsx` — the 3D geometry is fine, it's the input defaults that are wrong.

