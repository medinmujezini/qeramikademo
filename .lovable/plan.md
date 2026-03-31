

# 3-Layer Header for All Tabs

Replace floating toolbars with a fixed 3-layer header structure. The canvas fills the remaining space below.

```text
┌──────────────────────────────────────────────────────┐
│ Layer 1: Brand header  (SD logo · Design Studio)  Cart │  ← already exists
├──────────────────────────────────────────────────────┤
│ Layer 2: Tab nav  (Room Layout │ Finishes │ 3D View │ Quote) │  ← already exists
├──────────────────────────────────────────────────────┤
│ Layer 3: Contextual toolbar  (per-tab tools/toggles)       │  ← NEW: fixed row
├──────────────────────────────────────────────────────┤
│                                                      │
│                 Canvas / Content area                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## What Changes

### 1. `src/pages/EndUserPlatform.tsx`
- Move the tab-specific toolbar content out of each tab and into a **Layer 3** bar rendered between the TabsList and TabsContent
- Layer 3: `h-10 border-b border-primary/12 bg-card/40 px-6 flex items-center gap-4` — thin, dark, with gold accent border
- Render different toolbar content based on `activeTab` value
- Pass necessary callbacks/state down to each tab (or keep them in the tab and lift only toolbar JSX)

### 2. `src/components/tabs/FloorPlanTab.tsx`
- **Remove** the floating `glass-toolbar` wrapper at `top-4 left-1/2` (lines 286-302)
- **Remove** the bottom-left `glass-control` layer controls panel (lines 304-339) — move those controls (Dims toggle, New Room, From Image) into Layer 3
- **Remove** the bottom-center drawing status hint (lines 353-360) — move into Layer 3 as a right-aligned status indicator
- **Export** toolbar state/controls so EndUserPlatform can render them, OR expose the toolbar JSX as a separate component
- Right-side Properties panel stays as a floating panel (it's contextual to selection)

### 3. `src/components/tabs/DesignTab.tsx`
- **Remove** the floating toolbar at `top-4 left-1/2 z-30` (lines 1710-1984) — all those controls (Enhanced toggle, Tiles toggle, Ceiling, Plumbing, camera presets, Render, Walkthrough, saved views) move to Layer 3
- Left Library panel and right Properties panel stay as floating overlays (they're canvas-appropriate)
- Drop zone indicator stays (it's a canvas overlay)

### 4. `src/components/tabs/TilesTab.tsx`
- Check for floating toolbar — move any top toolbar controls to Layer 3

### 5. Approach: Per-tab toolbar components

Create small toolbar components that each tab exports:

- `FloorPlanToolbar` — tool buttons (Select/Pan/Wall/Column/Door/Window), grid toggle, undo/redo, delete, reset, dims toggle, New Room, From Image
- `DesignToolbar` — Enhanced toggle, settings, Tiles/Ceiling/Plumbing toggles, Add Light, counts, Render, Reset View, camera presets, saved views, Walkthrough
- `TilesToolbar` — whatever controls the Tiles tab has at top
- Quote tab: no toolbar needed (or minimal)

Each toolbar is a plain `React.FC` that renders a flat row of buttons/switches — no glass wrapper, no absolute positioning. EndUserPlatform renders the active one inside the Layer 3 bar.

### 6. Layer 3 Styling
```
h-10 border-b bg-card/30 px-4 flex items-center gap-3
border-color: hsl(var(--primary) / 0.08)
```
- Thin, unobtrusive, matches luxury aesthetic
- Gold accent dividers between groups (`w-px h-4 bg-primary/15`)
- Labels: `text-xs uppercase tracking-wider text-muted-foreground`
- Buttons: `variant="ghost" size="sm" h-7`

### 7. Canvas area adjustment
- Each tab's canvas container changes from `h-full` to filling the remaining flex space (already works since tabs use `flex-1`)
- Remove `top-28` offsets on floating Library/Properties panels — they now start from `top-4` since there's no floating toolbar above them

## Files Modified

| File | Change |
|---|---|
| `src/pages/EndUserPlatform.tsx` | Add Layer 3 bar, render per-tab toolbar |
| `src/components/tabs/FloorPlanTab.tsx` | Extract toolbar to component, remove floating toolbar/layer controls |
| `src/components/floor-plan/Toolbar.tsx` | Adapt to render inline (no glass wrapper) |
| `src/components/tabs/DesignTab.tsx` | Extract toolbar to component, remove floating toolbar, adjust panel offsets |
| `src/components/tabs/TilesTab.tsx` | Extract any floating toolbar to Layer 3 |
| `src/pages/WorkerPlatform.tsx` | Same 3-layer pattern for worker platform |

