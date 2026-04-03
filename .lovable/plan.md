

# Fix: Curtain GLB Model Rendering — Positioning, Scaling, and Coverage

## Problems identified

From the screenshot and code review, multiple issues compound:

1. **GLB model Z-positioning is wrong**: Line 59 uses `-box.max.z * uniformScale` which assumes the model's "back" is at max Z. Depending on the model's coordinate system, this could push the curtain INTO the wall instead of outward. The model could have its front at max Z.

2. **Uniform scaling distorts coverage**: `Math.min(scaleX, scaleY)` on line 51 picks the smaller scale, meaning if the model is taller than wide relative to the target, it won't fill the width — leaving gaps around the window.

3. **Wall offset is still too small**: 10mm (line 127) is not enough for a GLB model with 3D depth. The model clips into the wall geometry.

4. **No open/close support for GLB models**: When `hasModel` is true, only the raw GLB renders — the `openAmount` slider does nothing. The GLB just sits there regardless of the slider position.

5. **Model bottom not grounded**: The model is Y-centered at `cy` (center of curtain height), but the bounding box centering doesn't account for the curtain needing to hang from the top (mount point) down.

## Plan — all changes in `src/components/3d/Curtain3D.tsx`

### Change 1: Fix CurtainGLTFModel scaling — use independent X/Y, not uniform
Replace `Math.min(scaleX, scaleY)` with separate X and Y scales. The model should stretch to exactly fill `targetWidth` × `targetHeight`. Curtain GLBs are decorative — aspect ratio distortion is acceptable to ensure full window coverage.

```
const scaleX = size.x > 0 ? targetWidth / size.x : 1;
const scaleY = size.y > 0 ? targetHeight / size.y : 1;
const scaleZ = size.z > 0 ? 0.03 / size.z : 1; // clamp depth to 3cm
clone.scale.set(scaleX, scaleY, scaleZ);
```

### Change 2: Fix Z-positioning — always push model OUTWARD
After scaling, recompute bounding box. Position so the model's min Z (back face) sits at Z=0, with the rest extending into positive Z (toward the room). Use `newBox.min.z` not `box.max.z`:

```
const newBox = new THREE.Box3().setFromObject(clone);
const newCenter = newBox.getCenter(new THREE.Vector3());
clone.position.set(
  -newCenter.x,
  -newBox.min.y,  // bottom at Y=0
  -newBox.min.z   // back face at Z=0, extends outward
);
```

### Change 3: Fix wall offset for GLB models
Increase from 10mm to 20mm (`0.02`) for GLB models. This ensures the curtain clears the wall surface and window frame geometry completely.

### Change 4: Fix Y-positioning — curtain hangs from mount point DOWN
Currently `cy = mountH - curtainH / 2` centers the curtain vertically. But with the new bounding-box grounding (bottom at Y=0), the group position should place the bottom of the curtain near the floor. Change the group's Y to just use `0` (floor level) for the GLB case, since the model's bottom is grounded at Y=0 within the group, and the model already spans the full curtainH.

Actually, simpler: keep `cy = mountH - curtainH` so the bottom of the curtain is at `mountH - curtainH` from floor (near floor for floor-length curtains). The model's bottom is at local Y=0, so group Y = `mountH - curtainH`.

### Change 5: Add basic open support for GLB models
When `openAmount > 0`, scale the GLB's X by `(1 - openAmount)` and offset it slightly. Since the user confirmed GLBs are "whole set," we can simply scale X to compress the curtain (simulating gathering) and reduce width. This is a simple visual approximation — not perfect, but functional.

## Summary

| Issue | Current | Fix |
|---|---|---|
| Scaling | Uniform min(X,Y) — gaps | Independent X/Y/Z — fills target exactly |
| Z-position | `-box.max.z` — depends on model orientation | `-newBox.min.z` after rescale — always outward |
| Y-position | Centered at curtainH/2 | Grounded: bottom at Y=0, group at `mountH - curtainH` |
| Wall offset | 10mm | 20mm for GLB models |
| Depth | Model's original depth | Clamped to 3cm |
| Open/close | No effect on GLB | X-scale compression |

One file changed: `src/components/3d/Curtain3D.tsx`

