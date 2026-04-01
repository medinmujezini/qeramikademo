# Verdict: Approve with revisions

## What's good
- Clean interface design with sensible defaults
- Following existing patterns (room lights) for CRUD
- 5 distinct curtain types with unique 3D geometry
- Fabric material affecting roughness is a nice touch

## Revisions needed

### (1) Type definition — Minor fix
- Add `mountHeight?: number` (cm from floor, default = wall height) — curtains aren't always ceiling-mounted
- Add `rodVisible?: boolean` (default true) — curtain rod/track visibility
- `openAmount` should only apply to panel/sheer types (roman/roller/pleated have different open mechanics). Consider renaming to `openPercent` and documenting per-type behavior

### (2) CRUD — Approve as-is
Pattern matches room lights exactly. No issues.

### (3) CurtainDialog — Minor revision
- 20 color presets is excessive for a dialog. Use 12 presets (neutrals + key accents) plus a custom hex input — same pattern as `ColorPickerField.tsx` already in the project
- Add a small preview swatch showing fabric color + opacity together

### (4) Placement mode — Revision needed
- Don't just "click a wall" — curtains should only be placeable on walls that have **windows**. Auto-detect windows on the clicked wall and pre-fill width to match window width. Allow override.
- If wall has no windows, show a toast: "Curtains can only be placed on walls with windows"

### (5) Curtain3D — Approve with scope note
- The 5 geometry types are well-specified. However, this is the most complex part. Suggest implementing **panel and sheer first** (they share similar geometry — flat plane with folds), then roman/roller/pleated as a follow-up. This keeps the first PR reviewable.
- Sine wave folds on panel: use a simple `PlaneGeometry` with vertex displacement along X. Don't overcomplicate with cloth simulation.
- Sheer: same as panel but with `transparent: true, opacity: fabricOpacity`

### (6) Properties panel — Minor revision  
- Reuse the existing properties panel pattern from `PropertiesPanel.tsx` rather than creating a standalone panel. Add a "Curtain" section that appears when a curtain is selected, same as wall/door/window sections.

## Recommended implementation order
1. Types + CRUD (steps 1-2)
2. Panel + Sheer 3D geometry (step 5 partial)
3. Placement mode + dialog (steps 3-4)
4. Properties panel (step 6)
5. Roman/Roller/Pleated geometry (step 5 remainder)

## Scope concern
This is a **large feature** (~500-700 lines across 4-5 files). Recommend splitting into 2 phases:
- **Phase 1**: Types, CRUD, panel+sheer curtains, basic dialog, placement on windows
- **Phase 2**: Roman/roller/pleated geometry, full properties panel, rod visibility toggle
