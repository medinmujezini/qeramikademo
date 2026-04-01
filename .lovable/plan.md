

# Fix: Stairs Visibility from Upper Floor — Analysis & Revisions

## Verdict: Approve with revisions

### (1) yOffset calculation — **Approve with minor fix**

The prompt is correct. Line 1067 uses `activeFloor?.floorToFloorHeight` which is the *current* floor's height, but the staircase rises from `stair.fromLevel`, so we need that floor's height. The suggested fix is accurate.

However, remove the `- 0.02` offset currently on line 1067 — it was a hack to push stairs down slightly. The corrected fromFloor height should be sufficient.

### (2) Stairwell lighting — **Approve with revision**

Good idea, but revise:
- Y position should be `-0.3` not `-0.5` — half a meter below is too deep and may light the wrong area
- Add `decay={2}` for realistic falloff
- Use a warm color (`#fff5e6`) instead of default white to match the room's ambient tone
- Keep intensity at ~2 and distance at ~5 as suggested

### (3) Stairwell walls — **Revise significantly**

The concept is sound but needs adjustment:
- **Height**: Should NOT be `fromFloor.floorToFloorHeight`. The shaft walls should only extend from the floor surface downward to the slab thickness + a small amount (~1m) — just enough to give visual context. Full floor-height walls would block the view of the stairs entirely, defeating the purpose.
- **Wall count**: Only render 3 walls (skip the side where stairs enter from), or render all 4 but make them short (~1m tall parapet walls around the opening edge). A full shaft would make the stairwell a dark box.
- **Alternative**: Render a thin border/trim (10cm tall, 2cm thick) around the opening perimeter instead of full walls. This gives the "finished stairwell" look without blocking visibility.

### Revised Plan

| Item | Change |
|---|---|
| `src/components/tabs/DesignTab.tsx` ~line 1064 | Use `fromFloor.floorToFloorHeight` for yOffset; remove `-0.02` hack |
| `src/components/tabs/DesignTab.tsx` after Staircase3D | Add warm PointLight at stair center, Y=-0.3, intensity 2, distance 5, decay 2 |
| `src/components/tabs/DesignTab.tsx` after light | Add 10cm-tall trim border (4 thin boxes) around slab opening perimeter using `#e5e5e5` material |

