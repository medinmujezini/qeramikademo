

# Fix: Curtain Open/Close — Split from Center

## Problem
The GLB curtain model currently opens by X-scale compression (shrinks to 30% width but stays centered). This looks wrong — it should split into two halves that slide apart from the center, revealing the window at 100% open. The fallback box panels already do this but the GLB model does not.

## Approach
Render **two copies** of the GLB model (left half and right half) using `clippingPlanes` to clip each copy to its respective half. As `openAmount` increases, slide each half outward toward the wall edges.

This avoids duplicating geometry or distorting the model. Three.js clipping planes will cleanly cut the model in half visually.

## Changes — `src/components/3d/Curtain3D.tsx`

### 1. Remove the single-group X-scale approach
Delete the `openScale` variable (line 87) and the `<group scale={[openScale, 1, 1]}>` wrapper (line 90).

### 2. Render two instances of the cloned scene with clipping planes
Instead of one `<primitive>`, render two `<group>` elements:
- **Left half**: clipped to X ≤ 0 (local space), translated by `-openAmount * curtainW / 2` along X
- **Right half**: clipped to X ≥ 0 (local space), translated by `+openAmount * curtainW / 2` along X

Each group gets a `THREE.Plane` clipping plane. Enable `material.clippingPlanes` on all meshes in the clone by traversing and setting it during the `useMemo`.

### 3. Implementation detail
- Create two `THREE.Plane` objects: `leftClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)` (keeps X < 0) and `rightClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)` (keeps X > 0).
- Clone the scene twice. For each clone, traverse meshes and set `material.clippingPlanes = [clipPlane]` and `material.clipShadows = true`.
- Wrap each clone in a `<group>` with position offset based on `openAmount`:
  - Left: `position={[-openAmount * curtainW / 2, 0, 0]}`
  - Right: `position={[openAmount * curtainW / 2, 0, 0]}`
- Ensure `gl.localClippingEnabled = true` is set (via `useThree`).

### 4. Fallback box panels — already correct
The existing box panel logic (lines 204-220) already splits from center. No changes needed there.

## Result
At 0% open: both halves together = full curtain covering window.  
At 100% open: halves slide fully apart to wall edges, window fully revealed.  
Smooth intermediate positions for any slider value.

## Files modified
- `src/components/3d/Curtain3D.tsx`

