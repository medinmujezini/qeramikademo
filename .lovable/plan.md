

# Ultra-Luxury Page Overhaul

Based on 2026 luxury web design research (cinematic micro-interactions, layered depth, animated accents, whispered typography), here are the gaps and fixes across the entire design page experience.

## Current Issues Found

1. **Tab triggers** (`tabs.tsx`) — plain `text-sm font-medium`, no luxury typography
2. **Layer 2 tab nav** — bare `bg-card`, no gold accent line or gradient orb
3. **Layer 3 toolbars** — FloorPlan and Tiles use `bg-card/30` (semi-transparent) instead of solid luxury card
4. **Dividers** — basic `bg-primary/15`, could be animated or have more presence
5. **Search input** — functional but not elevated with gold focus ring glow
6. **Badges** — generic `variant="outline"`, no gold tint
7. **Library footer** — plain text, could have a gold accent line above
8. **Dialog components** — render dialog and walkthrough dialogs lack gold border treatment
9. **Walkthrough WASD hint** — uses `glass-toolbar` but no gold accent
10. **Crosshair** — plain `bg-foreground/50`, could be gold-tinted

## Changes

### 1. `src/components/ui/tabs.tsx` — Luxury tab triggers

- `TabsList`: add `bg-transparent` (remove default bg)
- `TabsTrigger`: change to `text-xs font-light uppercase tracking-[0.15em]` to match luxury button typography. Gold bottom border on active: `data-[state=active]:border-primary`. Add `transition-all duration-300`.

### 2. `src/pages/EndUserPlatform.tsx` — Elevated header & tab nav

- **Layer 1 header**: Add a second gradient orb bottom-left for symmetry
- **Layer 2 tab nav**: Add `relative overflow-hidden`, insert gradient orb. Add thin gold top accent line (`h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent`)
- **Quote tab**: Use `variant="luxury"` on the CTA button. Add gold particles to the empty state

### 3. `src/components/tabs/DesignTab.tsx` — Refined cinematic details

- **Layer 3 toolbar**: Add thin gold bottom accent line (1px `bg-gradient-to-r from-transparent via-primary/15 to-transparent`)  
- **Canvas crosshair**: Tint gold (`bg-primary/40` instead of `bg-foreground/50`)
- **WASD hint bar**: Add `border border-primary/10` for definition
- **Render dialog**: Add gold accent line at top of dialog content, use `font-display uppercase tracking-widest` on title
- **Panel toggle button**: Add `border border-primary/15` for visibility

### 4. `src/components/tabs/FloorPlanTab.tsx` & `TilesTab.tsx` — Consistent Layer 3

- Change `bg-card/30` to `bg-card` (solid, matching Design tab)
- Add the same subtle gold horizontal gradient as Design tab's toolbar
- Add `border-t` with gold color for visual separation

### 5. `src/index.css` — New luxury utilities

- **`.gold-accent-line`**: A reusable `h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent` class
- **`.luxury-search`**: Enhanced input focus with `box-shadow: 0 0 20px hsl(38 60% 68% / 0.08)` and gold border transition
- **Scrollbar styling**: Gold-tinted scrollbar thumbs globally (subtle)
- **Dialog gold border**: `.dialog-luxury` with top gold accent and inner glow

### 6. `src/components/design/UnifiedLibrary.tsx` — Richer library

- Category headers: Add gold left border thicker (3px instead of 2px) with more opacity
- Footer hint: Add gold accent line above (`w-12 h-px bg-primary/25 mx-auto mb-1`)
- Search input: Add `luxury-search` class

### 7. `src/components/design/DesignPropertiesPanel.tsx` — Gold refinements

- Section header gold lines: Increase border-left to 3px
- Add subtle gold inner glow to the panel background: `shadow-[inset_0_0_40px_hsl(38_60%_68%/0.03)]`

### 8. `src/components/ui/badge.tsx` — Luxury badge variant

- Add a `luxury` variant: `border-primary/20 bg-primary/5 text-primary/80` for gold-tinted badges
- Apply to count badges in the Design tab toolbar

## Files Modified

| File | Change |
|---|---|
| `src/components/ui/tabs.tsx` | Luxury uppercase typography on triggers, gold active border |
| `src/pages/EndUserPlatform.tsx` | Second header orb, tab nav gold accent line + orb, luxury quote CTA |
| `src/components/tabs/DesignTab.tsx` | Gold crosshair, toolbar accent line, luxury dialog, panel toggle border |
| `src/components/tabs/FloorPlanTab.tsx` | Solid bg-card toolbar, gold gradient, border-t |
| `src/components/tabs/TilesTab.tsx` | Same toolbar treatment as FloorPlan |
| `src/index.css` | Gold accent line utility, luxury-search, dialog-luxury, gold scrollbars |
| `src/components/design/UnifiedLibrary.tsx` | Thicker category borders, footer accent line, luxury search |
| `src/components/design/DesignPropertiesPanel.tsx` | Thicker section borders, inner glow |

