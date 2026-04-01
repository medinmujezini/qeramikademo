

# Improve Staircase 3D Realism & Multi-Floor Visibility

## Problems

1. **3D geometry doesn't match 2D footprint** — The geometry generator uses `stairWidth` and `treadDepth × numTreads` independently, ignoring the `width`/`depth` properties from the Staircase interface. So a staircase sized 200×100cm in the 2D canvas renders as a completely different size in 3D.

2. **Staircase not visible from second floor** — Currently only `fromLevel === activeLevel` staircases render. When viewing the second floor, the top of the staircase (which arrives at that floor) is invisible. The staircase should also render when `toLevel === activeLevel`, showing the top portion poking through the floor.

3. **Geometry is crude** — Thin floating boxes with needle-thin stringers. Missing: solid closed risers (vertical faces between treads), a solid underside/soffit, proper handrail bars connecting posts, and nosing overhang.

## Plan

### 1. Scale geometry to match `width`/`depth` — `src/utils/staircaseGeometry.ts`

The `generateStraight` function currently uses `stairWidth` for tread width and `treadDepth × numTreads` for total run, ignoring the `width`/`depth` properties. Fix by:

- Computing `totalRun = stair.numTreads * stair.treadDepth * CM_TO_M` as before
- Computing `actualDepth = stair.depth * CM_TO_M`
- If they differ, scale Z positions by `actualDepth / totalRun` so treads fit within the declared depth
- Use `stair.width * CM_TO_M` for tread width (it should equal `stairWidth` but use the bounding `width` as the authority)
- Apply same logic to L-shaped, U-shaped, spiral

### 2. Add risers (vertical faces) — `src/utils/staircaseGeometry.ts`

Add a new output array to `StaircaseGeometryResult`:
```ts
risers: TreadGeometry[]; // vertical boards between treads
```

In `generateStraight`, for each tread `i > 0`, add a riser:
```ts
risers.push({
  position: [0, y - riserH / 2, z - treadD / 2],
  size: [treadW, riserH, 0.02], // 2cm thick vertical board
  rotation: 0,
});
```
This closes the gaps between treads for a solid look.

### 3. Add solid soffit (underside) — `src/utils/staircaseGeometry.ts`

Add to the result:
```ts
soffit: { points: [number,number,number][]; width: number; thickness: number; }
```
This is a single angled slab under the full staircase run. In `Staircase3D.tsx`, render it as a rotated box matching the stringer angle but wider (full tread width) and thinner (3cm).

### 4. Add handrail bars — `src/utils/staircaseGeometry.ts` + `src/components/3d/Staircase3D.tsx`

Add to the result:
```ts
handrails: { start: [number,number,number]; end: [number,number,number]; }[]
```
Connect consecutive railing post tops with horizontal cylinder segments. Render in `Staircase3D.tsx` as thin cylinders (radius 0.025m) oriented between posts.

### 5. Render in `Staircase3D.tsx` — `src/components/3d/Staircase3D.tsx`

Add rendering for:
- **Risers**: Same material as treads, rendered as `<boxGeometry>` meshes
- **Soffit**: Single angled box under the staircase, slightly darker shade
- **Handrails**: Cylinders connecting post tops using `lookAt`-style rotation
- **Tread nosing**: Add 1cm overhang to tread depth for realism (just increase tread `size[2]` by 0.01)

### 6. Show staircase from second floor — `src/components/tabs/DesignTab.tsx`

Change the filter on line 949 from:
```ts
.filter(s => s.fromLevel === activeLevel)
```
to:
```ts
.filter(s => s.fromLevel === activeLevel || s.toLevel === activeLevel)
```

When `s.toLevel === activeLevel`, compute yOffset as negative (the staircase starts one floor below):
```ts
const activeFloor = building.floors.find(f => f.level === activeLevel);
const yOffset = s.fromLevel === activeLevel ? 0 : -(activeFloor?.floorToFloorHeight ?? 300) * CM_TO_METERS;
```

This makes the top of the staircase visible when viewing the upper floor.

## Files Modified

| File | Change |
|---|---|
| `src/utils/staircaseGeometry.ts` | Scale geometry to width/depth, add risers array, soffit data, handrail connections |
| `src/components/3d/Staircase3D.tsx` | Render risers, soffit, handrails, tread nosing |
| `src/components/tabs/DesignTab.tsx` | Show staircase on both fromLevel and toLevel floors |

