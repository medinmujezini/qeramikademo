

# Plan: Add GLB Model Support for Curtains

## Overview
Replicate the furniture GLB model pipeline for curtains: database table → admin management page → model selection in CurtainDialog → GLB rendering in Curtain3D with fallback to current box geometry.

## Changes

### 1. Database: Create `curtain_models` table
New migration with:
- `id` (uuid, PK, default gen_random_uuid())
- `name` (text, not null)
- `type` (text, not null — one of panel/sheer/roman/roller/pleated)
- `model_url` (text, not null)
- `thumbnail_url` (text, nullable)
- `is_active` (boolean, default true)
- `sort_order` (integer, default 0)
- `created_at` / `updated_at` (timestamptz, default now())

RLS: publicly readable, admin-only for all mutations (same pattern as `furniture_templates`).

### 2. Type update: `src/types/floorPlan.ts`
Add `modelUrl?: string` to the `Curtain` interface (line ~519, after `rodVisible`).

### 3. Admin page: `src/pages/admin/CurtainModelManagement.tsx`
Follow `FurnitureManagement.tsx` structure:
- List curtain models from DB with search/filter by type
- Add/edit dialog with: name, type selector (5 types), `FileUploadField` for GLB (bucket: "models"), thumbnail upload
- Delete with confirmation
- Activity log on create/update/delete

### 4. Admin navigation + routing
- Add nav item in `AdminLayout.tsx` navItems array: `{ path: '/admin/curtain-models', label: 'Curtain Models', icon: Curtains }` (use a suitable Lucide icon like `Blinds`)
- Add route in `App.tsx` following existing pattern

### 5. CurtainDialog update: `src/components/3d/CurtainDialog.tsx`
- Fetch `curtain_models` filtered by selected type
- Show selectable model cards (thumbnail + name) above color/material options
- When selected, pass `modelUrl` in the `onConfirm` callback
- Optional: "No model (default)" option to use built-in geometry

### 6. Curtain3D update: `src/components/3d/Curtain3D.tsx`
- When `curtain.modelUrl` exists: load GLB via `useGLTF`, clone scene, override mesh material colors with `curtain.fabricColor`, scale to fit `curtainW × curtainH`, render in place of box geometry
- Wrap in `React.Suspense` with fallback (same as Furniture3D pattern)
- When no `modelUrl`: keep current box/plane geometry as-is

### 7. Hook for addCurtain: `src/hooks/useFloorPlan.ts`
Ensure `addCurtain` passes through the `modelUrl` field when present.

## Technical details

- **Files created**: `src/pages/admin/CurtainModelManagement.tsx`
- **Files modified**: migration SQL, `src/types/floorPlan.ts`, `src/components/admin/AdminLayout.tsx`, `src/App.tsx`, `src/components/3d/CurtainDialog.tsx`, `src/components/3d/Curtain3D.tsx`, `src/hooks/useFloorPlan.ts`
- **No seed data** — table starts empty; admin uploads models manually
- GLB loading uses `useGLTF` from `@react-three/drei` (already a dependency)
- Model scaling: compute bounding box, uniform scale to fit target width/height, same as `Furniture3D.tsx` GLTFModel

