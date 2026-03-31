

# 12-Step Geometry & Export Improvement Roadmap

Focused on architectural geometry quality, export cleanliness, multi-floor support, and Unreal material pipeline.

---

## Step 1 — Proper 3D Door Geometry

**Current**: Doors are flat brown boxes (`boxGeometry args={[width, height, 0.03]}`) floating in front of the wall cutout. No frame, no handle, no panel detail.

**Improvement**:
- Create `Door3D.tsx` component with: frame extrusion (5cm wide trim around the opening), door panel with thickness matching wall, and a simple handle cylinder
- Support door types visually: hinged-left/right (show swing arc), sliding (offset panel), pocket (recessed), double (two panels)
- Use `meshPhysicalMaterial` with wood-grain roughness for the panel

**Files**: New `src/components/3d/Door3D.tsx`, update door rendering in `DesignTab.tsx` (lines 817-833)

---

## Step 2 — Proper 3D Window Geometry with Upload Support

**Current**: Windows are a blue transparent box + grey frame box. No glass refraction, no mullions, no ability to use custom window models.

**Improvement**:
- Create `Window3D.tsx` with: outer frame extrusion, glass pane using `meshPhysicalMaterial` with `transmission: 0.95, ior: 1.5, thickness: 0.5`, optional mullion grid (2×2 or 3×2 based on type)
- Add `modelUrl` field to the `Window` type so users can upload custom `.glb` window models via admin
- Add a bright exterior plane behind each window to simulate daylight

**Files**: New `src/components/3d/Window3D.tsx`, update `src/types/floorPlan.ts` (Window interface), update window rendering in `DesignTab.tsx` (lines 835-860)

---

## Step 3 — Wall-to-Wall Junction Geometry

**Current**: Wall meshes are independent extruded shapes. Where two walls meet at a corner, there's a visible gap or overlap depending on thickness.

**Improvement**:
- At export time (and optionally in preview), detect wall junctions where endpoints are shared
- Generate mitered corner geometry: extend each wall's extrusion to meet at the bisector angle
- For T-junctions: one wall butts into the face of another, trim the joining wall flush

**Files**: New `src/utils/wallJunctionGeometry.ts`, update `DesignTab.tsx` Wall3D or add a `WallJunction3D.tsx` component

---

## Step 4 — Double-Sided Ceiling / Roof Geometry

**Current**: Ceiling is a single `FrontSide` plane. When exported to UE and viewed from above (or in section), the ceiling is invisible from one side.

**Improvement**:
- Change `Ceiling3D.tsx` to render with `side={THREE.DoubleSide}` 
- Add roof geometry option: gabled, hip, flat parapet — as a new `roofType` field on the floor plan
- Roof meshes should have proper thickness (slab ~20cm) so they read as solid in UE
- Both inner ceiling face and outer roof face should export with materials

**Files**: Update `src/components/3d/Ceiling3D.tsx`, add roof type to `FloorPlan` interface, new `Roof3D.tsx` if complex

---

## Step 5 — Clean GLB Export (Strip Editor Artifacts)

**Current**: The exporter strips helpers/gizmos but still exports: selection highlight materials (emissive overrides), grid planes, plumbing debug spheres, spawn marker, furniture collision indicators, and drag plane meshes.

**Improvement**: Expand the cleanup in `glbExporter.ts` to also strip:
- Objects named `__drag_plane`, `__selection_*`, `__grid`, `__collision_indicator`
- Meshes with emissive-only materials (editor highlights)
- The spawn marker character mesh
- Main connection point spheres (plumbing debug)
- Any object with `userData.editorOnly = true` (new convention: tag editor-only objects)
- Reset all material emissive to black on export clone (removes selection glow artifacts)

**Files**: `src/utils/glbExporter.ts`, tag editor objects in `SpawnPointMarker.tsx`, `FurnitureScene.tsx`, `DesignTab.tsx`

---

## Step 6 — Multi-Floor Data Model

**Current**: Single-floor system. `FloorPlan` has one set of walls, points, fixtures.

**Improvement**:
- Add `floors: Floor[]` array to the project data model, where each `Floor` contains its own `FloorPlan` (walls, fixtures, furniture, finishes)
- Each floor has: `level: number` (0 = ground), `floorToFloorHeight: number` (default 300cm), `name: string`
- Add floor selector UI in the toolbar
- In 3D, stack floors vertically with floor slabs between them

**Files**: New `src/types/multiFloor.ts`, update `FloorPlanContext`, add floor selector to `DesignToolbar.tsx`

---

## Step 7 — Staircase System

**Current**: No stair support.

**Improvement**:
- Add stair types: straight run, L-shaped (quarter turn), U-shaped (half turn), spiral
- Stair parameters: total rise (floor-to-floor height), tread depth (25-30cm), width (80-120cm), railing style
- Auto-calculate number of treads from rise/tread-height
- Generate 3D geometry: individual tread meshes + stringer sides + railing posts
- Cut floor slab opening at the stair well location on the upper floor
- Stairs connect two `Floor` objects and appear in both floor views

**Files**: New `src/types/staircase.ts`, `src/components/3d/Staircase3D.tsx`, `src/utils/staircaseGeometry.ts`, add stair tool to toolbar

---

## Step 8 — Floor Slab Geometry

**Current**: Floor is a zero-thickness plane. When multi-floor is enabled, there's no visible slab between floors.

**Improvement**:
- Render floor as a solid slab with configurable thickness (default 20cm)
- Cut openings in the slab for stairwells
- Slab edges visible from below (important for UE export — floors need thickness)
- Material: concrete underside, finished top surface

**Files**: Update floor mesh in `DesignTab.tsx`, new `FloorSlab3D.tsx` component

---

## Step 9 — Enhanced Export Materials for Unreal

**Current**: `enhanceExportMaterials()` does basic roughness tweaks by name/color detection. No PBR texture embedding, no material metadata in the manifest.

**Improvement**:
- Embed PBR textures (albedo, normal, roughness, metallic) into the GLB when available (they already exist on wall/floor materials)
- Add `materials[]` array to `RoomManifest` listing each unique material with: name, type (wall/floor/door/window), PBR texture URLs, roughness/metalness values
- On the UE side: BP_WalkthroughLoader can use manifest material data to swap GLB materials with higher-quality UE material instances (e.g., M_Wall_Paint parameterized by color)
- Add `extras` metadata to glTF nodes (furniture name, category, dimensions) so UE can identify and optionally replace with native assets

**Files**: Update `src/utils/glbExporter.ts`, `src/utils/roomManifest.ts`

---

## Step 10 — Window/Door Model Upload System

**Current**: Doors and windows are hardcoded geometry. No way to upload custom models.

**Improvement**:
- Add `modelUrl?: string` and `frameModelUrl?: string` to Door and Window types
- Admin panel: upload `.glb` models for door/window styles, stored in Supabase storage
- In 3D: if `modelUrl` exists, load the GLB model instead of procedural geometry
- Scale/orient the uploaded model to fit the opening dimensions
- These models export naturally in the GLB (they're already Three.js meshes)

**Files**: Update `src/types/floorPlan.ts`, new admin management page, `Door3D.tsx` and `Window3D.tsx` model loading

---

## Step 11 — Furniture Metadata in Manifest

**Current**: Furniture is exported as anonymous meshes in the GLB. UE has no way to know what each mesh represents.

**Improvement**:
- Add `furniture[]` array to `RoomManifest` with: id, name, category, type, position (x,y,z in meters), rotation, dimensions, color, modelUrl
- Tag each furniture group in the Three.js scene with `userData = { furnitureId, category, type }` — these propagate to glTF extras
- UE can then: show product info overlays, swap with HD assets, apply UE materials

**Files**: Update `src/utils/roomManifest.ts`, tag objects in `Furniture3D.tsx` and `Fixture3D.tsx`

---

## Step 12 — UE-Side Material Instance System

**Current**: UE loads raw glTF materials which look flat compared to native UE materials.

**Improvement (UE Blueprint side — guidance only)**:
- Create parameterized Material Instances in UE: `MI_Wall` (color, roughness), `MI_Floor` (texture, roughness, normal intensity), `MI_Glass` (tint, opacity, IOR), `MI_Wood` (grain texture, color)
- In `BP_WalkthroughLoader`: after spawning the glTF actor, traverse its mesh components and match material slot names to manifest `materials[]`
- Replace each material with the corresponding UE Material Instance, applying parameters from the manifest (color → Vector Parameter, roughness → Scalar Parameter)
- This gives UE-native rendering quality (Nanite, Lumen, ray-traced reflections) while using the web app's design choices

**Files**: No web code changes — this is UE Blueprint/C++ work. Web side is prepared by Steps 9 and 11.

---

## Implementation Priority

| Priority | Steps | Theme |
|---|---|---|
| **High — immediate quality** | 1, 2, 4, 5 | Door/window geometry, ceiling export, clean GLB |
| **Medium — architecture** | 3, 6, 7, 8 | Wall junctions, multi-floor, stairs, slabs |
| **UE pipeline** | 9, 10, 11, 12 | Materials, uploads, manifest enrichment, UE swaps |

Steps 1-5 can be done independently. Steps 6-8 are sequential (multi-floor → stairs → slabs). Steps 9-12 are the UE material pipeline and build on each other.

