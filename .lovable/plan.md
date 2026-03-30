

# Fix Admin Panel

## Problems Identified

1. **`glass-sidebar` CSS class is missing** — AdminLayout references it on the sidebar `<aside>` but it's never defined in `index.css`, so the sidebar has no glass/background styling and is likely transparent or invisible.

2. **`glass-header` has pill shape** — The top bar uses `glass-header` which has `border-radius: 100px`, making it a rounded pill instead of a full-width bar. Wrong for the admin header.

3. **Dark theme text contrast** — Several admin pages (Dashboard, management pages) use `Card` components that may have low-contrast text in dark mode. The cards, labels, and stat values need to use semantic tokens (`text-foreground`, `text-muted-foreground`).

## Changes

### 1. Add `glass-sidebar` class to `src/index.css`
Define a proper glass sidebar style with dark semi-transparent background, blur, subtle border highlight — similar to the existing glass classes but without border-radius, and full height.

### 2. Fix admin header in `src/components/admin/AdminLayout.tsx`
Replace `glass-header` (pill-shaped) with a standard class: `bg-card/80 backdrop-blur-lg border-b border-border/50`. Remove the 100px radius issue entirely.

### 3. Ensure text contrast in AdminLayout
- Sidebar nav text: already uses `text-muted-foreground` / `text-primary` — looks fine.
- Header breadcrumb and user email: already uses `text-foreground` / `text-muted-foreground` — fine.
- Main content area: the child pages use `Card` which inherits `bg-card text-card-foreground` — should be fine with the corrected CSS vars.

### 4. Verify card backgrounds
The `Card` component uses `bg-card` which maps to `223 47% 14%` in dark mode. This should render correctly. The `bg-muted/50` summary boxes should also work since `--muted` is defined.

## Files Modified
- `src/index.css` — add `.glass-sidebar` definition
- `src/components/admin/AdminLayout.tsx` — replace `glass-header` with a non-pill header class

