

# Verdict: Approve with minor revisions

## Root Cause Assessment

**The diagnosis is correct.** `meshStandardMaterial` relies on scene lighting, and point lights 3 meters below a floor slab with a clipping plane at Y=0 simply cannot illuminate geometry effectively. Emissive materials are the right solution — they render at a constant brightness regardless of scene lighting.

## Revisions

### Emissive values — **Reduce slightly**

The proposed values (0.4 treads, 0.3 risers, 0.2 soffits, 0.35 railings) are reasonable but may look slightly "glowy" in scenes with ambient light. Revise to:
- Treads/landings: **0.35**
- Risers: **0.25**
- Soffits: **0.15**
- Railings/posts/handrails: **0.3**

These are subtle enough to not look radioactive while still being clearly visible. Easy to tweak later.

### StairMaterial emissive implementation — **Small clarification**

The emissive color should be the **same as the diffuse color** (already stated in the prompt as `emissive={color}`). This is correct — it makes the material self-illuminate with its own hue rather than a foreign glow.

### Keep the 3 PointLights — **Revise: remove only 2**

Keep **one** dim point light at the top (Y=-0.3, intensity=1.5) as a fill. Emissive materials don't cast light onto surrounding geometry (trim border, slab edges). A single weak fill light ensures the trim border and slab edges aren't pitch black. Remove the middle and bottom lights.

### Everything else — **Approve as-is**

- `emissiveBoost` prop approach: clean and non-breaking
- Passing 0 on the from-floor: correct, normal lighting works there
- Keeping trim border, clipping, yOffset: agreed

## Final Plan

### File 1: `src/components/3d/Staircase3D.tsx`

1. Add `emissiveBoost?: number` to `Staircase3DProps` (default 0)
2. Add `emissiveIntensity?: number` prop to `StairMaterial`, pass `emissive={color}` and `emissiveIntensity` to `meshStandardMaterial`
3. Forward `emissiveBoost` into `ProceduralStaircase3D`
4. Pass per-component emissive values: treads 0.35, risers 0.25, soffits 0.15, railings 0.3 — all multiplied by `emissiveBoost`

### File 2: `src/components/tabs/DesignTab.tsx`

1. Pass `emissiveBoost={isArrivingFromBelow ? 1 : 0}` to `Staircase3D` (line ~1083)
2. Remove the middle and bottom `<pointLight>` (lines 1092-1095), keep top light but reduce intensity to 1.5

| File | Change |
|---|---|
| `src/components/3d/Staircase3D.tsx` | Add emissiveBoost prop, update StairMaterial with emissive support |
| `src/components/tabs/DesignTab.tsx` | Pass emissiveBoost, trim stairwell lights to one fill |

