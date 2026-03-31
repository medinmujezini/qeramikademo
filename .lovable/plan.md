

# Luxury Design Tab Enhancement

## Current Issues
- Library items use generic `rounded-md border-border/60 bg-card` cards — plain, no luxury feel
- Properties panel has basic `bg-muted/30` background — feels flat
- Layer 3 toolbar is just a plain `bg-card` bar with no visual refinement
- Category headers are plain text with no gold accents
- Search input is generic
- Tab triggers have no luxury styling
- Footer hint is basic text
- Drop zone overlay is plain
- Render dialog uses `rounded-lg` and generic styling
- Walkthrough overlay lacks luxury refinement
- No gold accent lines, shimmer effects, or gradient orbs in the working panels

## Changes

### 1. `src/components/design/UnifiedLibrary.tsx` — Luxury library

**LibraryItem component (line 96-131):**
- Replace `rounded-md border-border/60` with `rounded-none border-primary/10`
- Add gold glow on hover: `hover:shadow-[0_0_15px_hsl(38_60%_68%/0.08)]`
- Thumbnail container: `rounded-none` instead of `rounded-md`, `border border-primary/10`
- Item name: add `font-display` for luxury feel
- Add thin gold top accent line via `border-t-2 border-t-primary/20` on hover

**Header (line 276-287):**
- Add gold underline below "Item Library" title
- Search input: `rounded-none border-primary/15 focus:border-primary/40 focus:shadow-[0_0_15px_hsl(38_60%_68%/0.06)]`

**Tabs (line 290-300):**
- Tab triggers: `rounded-none`, gold active underline via `data-[state=active]:border-b-2 data-[state=active]:border-primary`

**Category headers (line 313):**
- Add gold left accent: `border-l-2 border-primary/30 pl-2`

**Footer (line 392-394):**
- Add gold top border: `border-primary/10`, use `uppercase tracking-widest` text

### 2. `src/components/design/DesignPropertiesPanel.tsx` — Luxury properties

**Both states (line 43, 128):**
- Replace `bg-muted/30` with `bg-card/50`
- Section headers: add gold left accent line `border-l-2 border-primary/25 pl-2`
- Card components within: add `shadow-[0_0_12px_hsl(38_60%_68%/0.04)]` for subtle glow
- Color swatch: `rounded-none` instead of `rounded`
- "Properties" header: add thin gold underline `border-b border-primary/15`

**Actions section (line 182-205):**
- Rotate button: use `luxury` variant instead of `outline`
- Delete button: keep destructive but add subtle glow

**Tips section (line 210-216):**
- Gold bullet points instead of plain `•`: use `text-primary/40` for the dots

### 3. `src/components/tabs/DesignTab.tsx` — Toolbar & overlays

**Layer 3 toolbar (line 1588):**
- Add thin gold accent line at top: `border-t border-primary/8`
- Gold dividers (`bg-primary/15`) already present — keep

**Badges (line 1651-1652):**
- Add `border-primary/20` instead of default outline for gold tint

**Drop zone (line 1897-1901):**
- Replace `bg-primary/5` with gradient: `bg-gradient-to-b from-primary/5 to-transparent`
- Drop text: add `font-display` and gold glow shadow

**Render dialog (line 2038-2094):**
- Image container: `rounded-none` instead of `rounded-lg`
- "AI Enhanced" badge: `rounded-none`
- "Original" badge: `rounded-none`
- Dialog title: `font-display`

**Walkthrough overlays (line 1968-1998):**
- Loading overlay: add gradient orb behind spinner
- "Click to Enter" button: already uses `luxury` — keep
- WASD hint (line 2023): add `font-display`

### 4. `src/index.css` — Additional luxury utilities

Add `.panel-header-title` enhancement:
- `letter-spacing: 0.15em` (increase from current)
- Add a subtle gold text-shadow: `text-shadow: 0 0 20px hsl(38 60% 68% / 0.15)`

Add `.luxury-search` class for gold-accented inputs:
```css
.luxury-search {
  border-radius: 0;
  border-color: hsl(var(--primary) / 0.15);
  background: hsl(var(--card));
}
.luxury-search:focus {
  border-color: hsl(var(--primary) / 0.4);
  box-shadow: 0 0 15px hsl(var(--primary) / 0.06);
}
```

## Files Modified

| File | Change |
|---|---|
| `src/components/design/UnifiedLibrary.tsx` | Square library items with gold glow, luxury search, gold category accents |
| `src/components/design/DesignPropertiesPanel.tsx` | Gold section headers, luxury action buttons, refined cards |
| `src/components/tabs/DesignTab.tsx` | Gold toolbar accent, luxury drop zone, square render dialog elements |
| `src/index.css` | Luxury search class, enhanced panel-header-title |

