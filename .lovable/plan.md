

# Verdict: Approve with revisions

## Analysis

The prompt correctly identifies two real problems:

1. **Offset too large** (line 229): 0.02m = 2cm gap pushes curtains too far from the wall, exposing window openings behind. Reducing to 0.005 is correct.

2. **X-scale compression is broken**: `scale={[1 - openAmount, 1, 1]}` squishes all geometry into thin lines. The sliding approach is the right fix.

## Revisions needed

### Issue 1: Panel geometry is full-width, not half-width

The prompt says "each panel should be `curtainW / 2` wide" but the current `panelGeometry` is built as `new THREE.PlaneGeometry(curtainW, curtainH, ...)` — full width. Creating two separate half-width geometries would require either:
- Building the geometry at `curtainW / 2` width, OR
- Keeping full-width geometry but clipping/positioning so each half only shows its portion

**Simplest correct approach**: Keep the full-width geometry as-is. Each panel mesh renders the full fold pattern. Position them so at `openAmount=0` they overlap at center (both at x=0). As openAmount increases, slide left panel to `-panelOffsetX` and right panel to `+panelOffsetX`. The visual overlap at center when closed is fine — it's how real curtains work (two layers of fabric meet in the middle).

The `panelOffsetX` formula should be `openAmount * curtainW / 2` (current value on line 265 is already this). Just remove the scale.

### Issue 2: Fold frequency shouldn't change with openAmount

The current code has `effectiveFreq = baseFoldFreq * (1 + openAmount * 2)` which was meant for the compression approach. With sliding panels, the folds should stay constant regardless of openAmount. Remove the dynamic freq/depth scaling — use base values always.

### Issue 3: Backing liner dimensions

The backing liners (lines 322-335) currently use `curtainW` width with scale compression. With sliding, they should stay at `curtainW` width (no scale) and follow panel positions.

## Revised plan

### File: `src/components/3d/Curtain3D.tsx`

**Change 1** — Line 229: offset `0.02` → `0.005`

**Change 2** — Lines 250-253: Remove dynamic freq/depth. Use base values directly:
```
const foldDepth = curtain.type === 'sheer' ? 0.005 : 0.01;
const foldFreq = curtain.type === 'sheer' ? 16 : 20;
```
Remove `effectiveFreq`/`effectiveDepth`. Use `foldFreq` and `foldDepth` in the loop. Remove `openAmount` from the `useMemo` dependency array.

**Change 3** — Lines 302, 309: Remove `scale={[1 - openAmount, 1, 1]}` from both panel meshes. Keep positions as-is (`-panelOffsetX` and `+panelOffsetX`).

**Change 4** — Lines 322, 329: Remove `scale={[1 - openAmount, 1, 1]}` from backing liner meshes. Keep positions following panels.

**Change 5** — Lines 342-343, 350-351: Make bunched fabric width dynamic: `0.03 + openAmount * 0.08` instead of fixed `0.06`.

**Change 6** — Sheer: single panel slides to one side. Currently sheer renders one mesh at `-panelOffsetX`. Change to slide it to `-panelOffsetX` (left side only), no scale. This already works correctly with the current position logic — just remove the scale.

One file changed: `src/components/3d/Curtain3D.tsx`

