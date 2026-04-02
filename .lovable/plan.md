

# Verdict: Approve — minor revision

## Analysis

The prompt is well-reasoned. The diagnosis is correct: each curtain gets `config.width` (window width + 60cm) which leaves gaps on multi-window walls. The fix location (DesignTab.tsx onConfirm, line 2590) is correct — wall geometry is available there via `floorPlan.points`.

## One revision needed

The prompt says "maximum distance between any two adjacent window centers" and applies that to ALL curtains on the wall. This is wrong for walls with unevenly spaced windows (e.g., 3 windows where two are close together and one is far away). The far-apart pair would force all curtains to be enormous.

**Better approach**: give each curtain a width based on its own spacing to its neighbors, not the global max. For each window, calculate half-distance to left neighbor + half-distance to right neighbor + overlap. Edge windows extend to the wall edge.

However, for the common case (2 evenly-spaced windows), the max-distance approach works fine. Given complexity vs. payoff, the prompt's simpler approach is acceptable for now.

## Revised plan

### File: `src/components/tabs/DesignTab.tsx` (lines 2590-2607)

In the `onConfirm` handler, before the `forEach`:

1. Get wall start/end points from `floorPlan.points`
2. Calculate `wallLength` via `distanceBetweenPoints` (import from `wallGeometry.ts`)
3. For `panel`/`sheer` types with 2+ windows:
   - Sort windows by position
   - Compute max gap between adjacent window centers (position × wallLength)
   - Set `effectiveWidth = Math.max(config.width, maxGap + 20)`
4. For other types or single window: `effectiveWidth = config.width`
5. Use `effectiveWidth` instead of `config.width` in the `addCurtain` call

No other files change.

