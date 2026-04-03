

# Revised Prompt — Fix Panel Curtain Realism + Open Slider

## Issues with the original prompt

The fold parameter tweak alone won't fix the core problems visible in the screenshot:

1. **Segment count too low for higher frequency**: The prompt increases foldFreq from 8→24 but keeps `segsX = 32`. With 24 cycles across 32 segments, each fold gets ~1.3 vertices — not enough to render a sine wave. It'll still look jagged. Need `segsX = 64` minimum (ideally 80+).

2. **Open slider feels broken**: The "open" mechanism shrinks `visibleW = curtainW * (1 - openAmount)` which makes the curtain geometry narrower AND moves panels apart via `panelOffsetX`. The panel gets smaller as it opens, which looks wrong. Real curtains maintain their full width — the fabric bunches up to the sides. The prompt doesn't address this at all.

3. **Backing liner gap**: The backing plane sits at Z=-0.03 but with foldDepth=0.008 the fold peaks are at Z=±0.008. The 3cm gap between fold surface and liner creates visible depth separation. Should move liner closer.

## Revised plan

### File: `src/components/3d/Curtain3D.tsx`

**Change 1 — Fold parameters (line 248-260)**
- `segsX`: 32 → 80 (enough vertices for smooth folds)
- `foldDepth` panel: 0.025 → 0.01 (shallow gathered look)
- `foldFreq` panel: 8 → 20 (many tight folds)  
- `foldDepth` sheer: 0.01 → 0.005
- `foldFreq` sheer: 12 → 16
- Remove `yFactor` dampening — use `pos.setZ(i, fold)` directly
- Add slight random variation per fold to break uniformity: `fold * (0.85 + 0.15 * Math.sin(x * 137.5))` — creates natural irregularity

**Change 2 — Fix open slider (lines 245-246, 266)**
- Keep `visibleW = curtainW` (full width always — don't shrink geometry)
- Instead, compress the fold frequency as openAmount increases: `effectiveFreq = foldFreq * (1 + openAmount * 2)` and increase `effectiveDepth = foldDepth * (1 + openAmount * 1.5)` — fabric bunches tighter
- Scale the mesh X by `(1 - openAmount)` using `scale={[1 - openAmount, 1, 1]}` on each panel mesh — this compresses the geometry to the sides without reducing vertex count
- Keep `panelOffsetX` for sliding panels apart

**Change 3 — Backing liner position (lines 323, 330)**
- Move from Z=-0.03 to Z=-0.015 (closer to the shallower folds)

### Summary

| What | Before | After |
|---|---|---|
| segsX | 32 | 80 |
| Panel foldDepth | 0.025 | 0.01 |
| Panel foldFreq | 8 | 20 |
| yFactor dampening | Applied | Removed |
| Open behavior | Shrinks geometry width | Compresses folds via X-scale |
| Backing Z | -0.03 | -0.015 |

One file changed: `src/components/3d/Curtain3D.tsx`

