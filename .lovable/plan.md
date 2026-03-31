

# Triplanar Material Mapping for Walls

## Problem

Wall meshes use `ExtrudeGeometry` which generates UVs based on the 2D shape profile. The front/back faces get proper UVs but the **top, bottom, and side (thickness) faces** get stretched or missing UVs — they appear as flat gray. The user wants to see material texture on all surfaces, including wall cross-sections visible from outside.

## Approach

Create a custom `TriplanarMaterial` using Three.js `onBeforeCompile` shader injection on `MeshStandardMaterial`. Triplanar mapping projects the texture from 3 axes (X, Y, Z) in world space and blends based on the surface normal, so every face — front, back, top, sides — gets correctly scaled texture without relying on UV coordinates.

## Steps

### 1. Create `src/utils/triplanarMaterial.ts`

A utility that creates a `MeshStandardMaterial` with triplanar shader injection:

- Accept params: `color`, `map` (texture), `roughness`, `textureScale` (world-space repeat, default ~0.5 for ~2m tiles)
- Use `material.onBeforeCompile = (shader) => { ... }` to:
  - Add a `uniform float uTriplanarScale` and `uniform sampler2D uTriplanarMap`
  - In the vertex shader: pass `vWorldPosition` and `vWorldNormal`
  - In the fragment shader: replace `#include <map_fragment>` with triplanar sampling:
    - Sample texture 3 times using `worldPos.yz`, `worldPos.xz`, `worldPos.xy` scaled by `uTriplanarScale`
    - Blend using `abs(worldNormal)` raised to a sharpness power (~4.0)
    - Multiply into `diffuseColor.rgb`
- When no texture map is provided, skip injection and use plain color (current behavior)

### 2. Update `Wall3D` in `src/components/tabs/DesignTab.tsx`

Replace the inline `<meshStandardMaterial>` JSX with the triplanar material:

- When `texture` exists (tile pattern): create triplanar material with the canvas texture
- When no texture: use triplanar material with just the wall color (so even plain walls look consistent)
- Use `useMemo` to create the material, dispose on cleanup
- Set `side={THREE.DoubleSide}` on the material

### 3. Update `TiledWall3D.tsx`

Apply the same triplanar material to tiled walls so PBR textures (albedo, normal, roughness) appear on all faces:

- For PBR materials: create triplanar material using the albedo map
- Normal and roughness maps can remain UV-based on front faces (less critical for thickness faces)

### 4. Apply to `FloorSlab3D.tsx`

Floor slabs also use extrusion — their side faces are plain. Apply triplanar with a concrete/slab color so edges look textured when visible from below or at angles.

## Technical Detail — Triplanar GLSL Snippet

```text
vec3 blending = pow(abs(vWorldNormal), vec3(4.0));
blending /= dot(blending, vec3(1.0));

vec4 xAxis = texture2D(uTriplanarMap, vWorldPosition.yz * uScale);
vec4 yAxis = texture2D(uTriplanarMap, vWorldPosition.xz * uScale);
vec4 zAxis = texture2D(uTriplanarMap, vWorldPosition.xy * uScale);

vec4 triColor = xAxis * blending.x + yAxis * blending.y + zAxis * blending.z;
diffuseColor *= triColor;
```

## Files Modified

| File | Change |
|---|---|
| New `src/utils/triplanarMaterial.ts` | Triplanar `MeshStandardMaterial` factory with `onBeforeCompile` |
| `src/components/tabs/DesignTab.tsx` | `Wall3D` uses triplanar material instead of inline `meshStandardMaterial` |
| `src/components/3d/TiledWall3D.tsx` | Use triplanar for PBR-textured tiled walls |
| `src/components/3d/FloorSlab3D.tsx` | Use triplanar for slab side faces |

