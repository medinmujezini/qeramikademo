

# Redesign Design Tab to Luxury Style

## What's Changing

The Design tab's floating toolbar, panels, and overlays need to match the black & cream-gold luxury aesthetic: refined borders, gold accent lines, uppercase tracked labels, and cleaner spacing.

## Changes

### 1. `src/index.css` — Luxury panel/toolbar styles (lines 766-827)

- `.glass-floating`: Add subtle gold top-border (`border-top: 1px solid hsl(var(--primary) / 0.25)`), slightly darker bg
- `.glass-toolbar`: Add gold top-border accent, increase padding slightly, use `border-radius: 4px` (sharper)
- `.glass-control`: Gold border accent
- `.panel-header`: Add gold bottom-border instead of plain border, use uppercase tracking-widest on title
- `.panel-header-title`: Add `text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.7rem; color: hsl(var(--primary) / 0.8)` — luxury label style

### 2. `src/components/tabs/DesignTab.tsx` — Toolbar & panels refinement

**Top toolbar** (line ~1711):
- Replace `glass-toolbar` with refined styling: add thin gold top-border, tighter layout
- Group controls into logical sections with gold dividers (`bg-primary/20` instead of `bg-border/50`)
- Make labels uppercase tracking-wider (luxury-label style) for "Enhanced", "Tiles", "Ceiling", "Plumbing"
- Badges: use `variant="outline"` with gold border instead of `secondary`
- Camera preset buttons: add subtle gold hover state

**Library panel** (line ~1988-1999):
- Panel header title "Library" → uppercase tracked gold text (handled by CSS changes)
- Already uses `glass-floating` so CSS update covers it

**Properties panel** (line ~2003-2026):
- Same as library — CSS update covers it

**Walkthrough overlay** (lines 2044-2075):
- Loading spinner: already uses `text-primary` ✓
- "Preparing walkthrough" heading: add `font-display` class for Outfit font
- Walkthrough prompt: style "Click to Enter" button with `luxury` variant
- WASD hint bar: already uses `glass-toolbar` ✓

**Render dialog** (lines 2112-2169):
- "Cinematic Render" title: ensure Outfit font via heading tag
- "AI Enhanced" badge: use gold accent (`bg-primary/80`) — already done ✓

**Drop zone indicator** (line 1702-1706):
- Change text from `glass-toolbar` to use gold border accent

### 3. `src/components/design/UnifiedLibrary.tsx` — Library tab styling

- Category tab buttons: use uppercase tracking, gold active state
- Item cards: subtle gold hover border
- "Plumbing" badge: keep distinct blue, rest follows gold theme

### 4. `src/components/design/DesignPropertiesPanel.tsx` — Properties styling

- Section labels: uppercase tracked gold
- Action buttons: use `luxury` variant for rotate/delete
- Dimension labels: muted gold tint

## Files Modified

| File | Change |
|---|---|
| `src/index.css` | Gold accents on panel/toolbar classes, luxury header styling |
| `src/components/tabs/DesignTab.tsx` | Gold dividers, luxury labels, refined toolbar |
| `src/components/design/UnifiedLibrary.tsx` | Gold active tabs, luxury item cards |
| `src/components/design/DesignPropertiesPanel.tsx` | Gold labels, luxury action buttons |

