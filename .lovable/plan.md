

# Verdict: Approve with minor revision

## Root Cause Assessment

**Partially correct.** The single weak light is a real problem, but the prompt overlooks another likely contributor: the `clipBelowY={0}` clipping plane on the Staircase3D component. If the clipping plane is cutting geometry at Y=0 (the floor surface), it may be hiding the upper portion of the staircase treads that should be visible through the opening. Worth verifying visually after the lighting fix — but the prompt says not to touch clipping, and it was intentionally set, so leave it for now.

## Revisions to the Prompt

### Decay value — **Revise to 1.5, not 1**

`decay={1}` (linear falloff) looks unnatural. `decay={2}` (physically correct inverse-square) is too aggressive for this enclosed space. Use `decay={1.5}` as a compromise — enough to reach the bottom without looking flat.

### Intensity values — **Reduce slightly**

With 3 lights at intensities 5/4/3 and low decay, there's risk of overexposure at the top. Revise to:
- Top: intensity **3**
- Middle: intensity **3**
- Bottom: intensity **2**

This gives even illumination without blowing out the area near the slab opening.

### Distance — **Approve at 8**

Correct — the current `distance={5}` barely covers a 3m shaft. 8 is appropriate.

### Everything else — **Approve as-is**

- 3 lights distributed vertically: good
- Color `#fff5e6`: correct (matches existing warm tone)
- `castShadow={false}`: correct optimization
- No other changes: agreed

## Final Plan

**File: `src/components/tabs/DesignTab.tsx`** — lines 1085-1094

Replace the single `<pointLight>` block with:

```tsx
{isArrivingFromBelow && (() => {
  const h = (fromFloor?.floorToFloorHeight ?? 300) * CM_TO_METERS;
  return (
    <>
      <pointLight position={[stairCenterX, -0.3, stairCenterZ]}
        color="#fff5e6" intensity={3} distance={8} decay={1.5} castShadow={false} />
      <pointLight position={[stairCenterX, -(h * 0.5), stairCenterZ]}
        color="#fff5e6" intensity={3} distance={8} decay={1.5} castShadow={false} />
      <pointLight position={[stairCenterX, -h + 0.3, stairCenterZ]}
        color="#fff5e6" intensity={2} distance={8} decay={1.5} castShadow={false} />
    </>
  );
})()}
```

No other files or systems are touched.

