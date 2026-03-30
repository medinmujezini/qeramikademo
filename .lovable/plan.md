

# Full UI/UX Enhancement Plan

## Current Issues

1. **Headers** use glassmorphism pill styling (`glass glass-pill glass-shine-sweep` on Home, `header-tech` on platforms) — overly decorative, not traditional
2. **Animated tabs** use `glass glass-shine-sweep` with rounded-full pill shape and animated indicator — flashy, not professional
3. **Background orbs** (`gradient-orbs`, `orb-1` through `orb-4`) appear on every page — distracting animated blobs
4. **Home page** has excessive glass effects (shine sweeps, gradient overlays, caustics on RoleCards)
5. **RoleCard** uses `GlassCard variant="premium" showOrbs` with shine layers — over-designed
6. **Cornell/Raytracing demo links** clutter headers — these are dev demos, not user features
7. **"Worker Platform" / "Design Studio" branding** is confusing — just show the app name consistently

## Plan

### 1. Simplify Headers (Home, WorkerPlatform, EndUserPlatform)

**Home page header**: Replace glass pill with a clean flat bar using `bg-card border-b border-border`. Remove Cornell/Raytracing links from main nav (keep only in footer or remove entirely). Keep Admin link.

**WorkerPlatform header**: Already uses `header-tech` (clean). Remove Cornell/Raytracing links. Clean up the right side to just show Projects dropdown.

**EndUserPlatform header**: Same cleanup — flat `header-tech` bar, remove decorative elements.

### 2. Replace Animated Tabs with Standard Tabs

Replace `AnimatedTabsList`/`AnimatedTabsTrigger` usage in both platforms with standard `TabsList`/`TabsTrigger` from the existing `tabs.tsx` component. These already have a clean, traditional underline/highlight style. Remove the `animated-tabs.tsx` file or leave it unused.

### 3. Remove Background Orbs

Remove the `gradient-orbs` div from `Home.tsx`, `WorkerPlatform.tsx`, and `EndUserPlatform.tsx`. The radial gradient background on Home can stay (it's subtle), but the animated floating orbs go.

### 4. Simplify Home Page

- Replace glass pill header with flat `bg-card border-b` bar
- Replace `RoleCard` glass effects: use standard `Card` component instead of `GlassCard variant="premium"` with shine/orbs
- Remove gradient overlay divs and shine layers from RoleCard
- Keep the hero text and two-card layout — just make cards clean

### 5. Clean Up RoleCard

Rewrite to use `Card` from shadcn instead of `GlassCard`. Remove `glass-shine-sweep`, `shine-layer`, gradient overlays. Simple border hover effect.

### 6. Remove Demo Links from Headers

Cornell and Raytracing links removed from Home header and WorkerPlatform header. These are development tools. If user wants them, they can navigate directly. Keep `/admin` accessible.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Home.tsx` | Flat header, remove orbs, simplify layout |
| `src/pages/WorkerPlatform.tsx` | Remove orbs, replace AnimatedTabs with standard Tabs, remove demo links |
| `src/pages/EndUserPlatform.tsx` | Same as WorkerPlatform |
| `src/components/home/RoleCard.tsx` | Use `Card` instead of `GlassCard`, remove effects |
| `src/components/home/BackToHome.tsx` | No changes needed |

## What Stays

- `header-tech` CSS class (it's already clean/flat)
- Admin panel layout (already fixed previously)
- Glass floating panels inside canvas tabs (Design/Tiles/Plumbing) — those are appropriate for overlay UI on 3D canvas
- All functional features (floor plan, tiles, design, plumbing, estimate, projects, export)

