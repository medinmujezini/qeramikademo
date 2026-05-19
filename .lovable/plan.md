# Replace Blueprint Import with Deterministic Floorplan → Geometry Pipeline

## Goal
Replace the current Gemini-returns-JSON-walls flow with a pipeline where AI only **paints raster pixels** and geometry is produced deterministically via Potrace + orthogonalization + extrusion.

## One open decision
**Stage 03 AI backend**: start with **Gemini VLM + mask painting** (already wired, fastest to ship). The data contract between stages 03→04 is a pure binary raster, so we can swap in SAM/segmentation later without touching stages 04/05. I'll proceed with Gemini unless you say otherwise.

## Architecture

```text
[01 Upload] → ImageBitmap
   ↓
[02 Calibrate] → pixelsPerMeter (click A, click B, enter meters)
   ↓
[03 AI Clean] → 1-bit raster (walls=black, rest=white)   ← non-deterministic
   ↓  ImageData contract (same WxH, binary)
[04 Trace] → Potrace outline + orthogonalize → SVG paths  ← deterministic
   ↓  Array<{ d, bboxArea, id }>
[05 Walls] → THREE.Shape + ExtrudeGeometry                ← deterministic
```

## New wizard: `/floor-plan/import-v2` (replaces existing wizard route)

New step components under `src/components/floorplan-pipeline/`:
1. `UploadStep.tsx` — drop/select image, show intrinsic dims
2. `CalibrateStep.tsx` — canvas with two-click ruler + meters input → `pixelsPerMeter`
3. `CleanStep.tsx` — calls edge function, shows before/after, **manual paint/erase brush overlay**, "re-run cleanup" button
4. `TraceStep.tsx` — runs Potrace + orthogonalize in browser, renders SVG overlay, sliders for `snap_tolerance_deg` / `min_segment_length_px` / `turdsize`, per-path toggle list
5. `ExtrudeStep.tsx` — `wall_height_m` input, 3D preview, "Send to project" finalize → writes walls into existing `FloorPlanContext`

Wizard shell: `FloorplanPipelineWizard.tsx` with linear stepper.

## Files

### New
- `src/lib/floorplan-pipeline/types.ts` — `Calibration`, `CleanedRaster`, `TracedPath`, `PipelineState`
- `src/lib/floorplan-pipeline/calibration.ts` — click-to-distance math
- `src/lib/floorplan-pipeline/potrace.ts` — wrap `esm-potrace-wasm` with our options (turdsize 20, alphamax 0.6, opticurve false)
- `src/lib/floorplan-pipeline/orthogonalize.ts` — RDP simplify (epsilon 1.5px) + 90° snap (±12°) + absorb segments < 4px; outputs SVG path strings
- `src/lib/floorplan-pipeline/binarize.ts` — threshold helper; guarantees `walls=0, void=255` ImageData
- `src/lib/floorplan-pipeline/extrude.ts` — SVG path → `THREE.Shape` → `ExtrudeGeometry`; converts px→meters via `pixelsPerMeter`
- `src/lib/floorplan-pipeline/toFloorPlan.ts` — bridge: traced paths → app's `FloorPlan` walls (using existing `Wall`/`Point` types) so the rest of the app keeps working
- `src/components/floorplan-pipeline/*` — 5 step components + wizard shell
- `supabase/functions/clean-floorplan/index.ts` — **new** edge function: Gemini Vision identifies text/doors/windows/furniture regions, returns mask instructions; we render the cleaned binary raster server-side and return PNG (base64). Window openings re-filled with wall color.

### Modified
- `src/App.tsx` — route `/floor-plan/import` → new wizard
- `src/pages/...` wherever the old `BlueprintImportWizard` is mounted → point to new wizard
- `src/components/floor-plan/FloorPlanUploader.tsx` if it links to old wizard

### Deleted
- `src/components/blueprint/BlueprintImportWizard.tsx`
- `src/components/blueprint/steps/*` (all 6)
- `supabase/functions/analyze-floorplan/index.ts`

## Dependencies
- `esm-potrace-wasm` (Potrace tracing in browser)
- `simplify-js` (RDP for orthogonalize)

## Stage-03 edge function contract
**Request**: `{ imageBase64, mimeType }`
**Response**: `{ cleanedPngBase64, width, height }`

Prompt (Gemini 2.5 Flash) returns JSON:
```json
{ "regionsToErase": [{x,y,w,h, kind:"text|door|furniture"}],
  "windowsToFill":  [{x,y,w,h}] }
```
Edge function then renders the cleaned raster via `@napi-rs/canvas` (or Deno `imagescript`): start from grayscale-binarized original (walls black), white-fill erase regions, black-fill window regions, return as PNG. This keeps the contract pure: client always gets a clean binary image regardless of model.

## Manual override (stage 03 UI)
Brush tool (white/black, adjustable radius) painted onto the cleaned image canvas before stage 04. Trace re-runs reactively when the cleaned raster changes.

## Coordinate transform (stage 05)
```text
worldX = (px - imgWidth/2)  / pixelsPerMeter
worldZ = (py - imgHeight/2) / pixelsPerMeter   // image Y → world Z
worldY = 0 (floor) → wall_height_m (top)
```

## Skill
After implementation, save the spec + key code references at `.agents/skills/floorplan-to-geometry/SKILL.md` and apply via `skills--apply_draft`.

## Out of scope (per your "non_goals")
- No AI-generated geometry, paths, coordinates, or room semantics
- No centerline/skeletonization
- No door/window auto-detection in the final geometry (the cleaning step already eliminates them; doors = gaps that survive trace, windows = filled wall)

## Risks
- **Potrace WASM bundle size** (~200KB) — acceptable, lazy-loaded in TraceStep only
- **Edge function image rendering**: Deno `imagescript` works but is slower than canvas; if too slow we move the masking to the client and use the edge function purely for region detection
- **Loss of doors/windows as semantic objects** — current app treats them as `Door`/`Window` entities on walls. New pipeline only produces walls. Doors survive as physical gaps; windows become solid wall. If you want them back as entities, that's a separate pass (skipping per non_goals).
