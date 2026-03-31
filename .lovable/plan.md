

# Square Cards with Glow & Gradient Orbs

## Changes

### 1. `src/components/ui/card.tsx` — Remove rounded corners, add glow
- Change `rounded-md` to `rounded-none`
- Add gold glow: `shadow-[0_0_30px_hsl(38_60%_68%/0.08)]`
- Add `relative overflow-hidden` for orb containment

### 2. `src/components/ui/glass-card.tsx` — Same treatment
- Remove any `rounded-*` from the `.glass` usage, add `rounded-none`
- Enable `showOrbs` by default (change default from `false` to `true`)

### 3. `src/index.css` — Global card styling
- Update `.glass`, `.glass-card`, `.glass-sm`, `.glass-lg` to use `border-radius: 0`
- Add a gold glow box-shadow to all glass variants: `box-shadow: 0 0 30px hsl(var(--primary) / 0.06)`
- Ensure `.gradient-orbs` and `.orb` classes use gold-tinted colors (hsl 38) instead of any blue remnants
- Add a utility class `.card-glow` for `box-shadow: 0 0 30px hsl(var(--primary) / 0.08)` reuse

### 4. `src/components/home/RoleCard.tsx` — Add gradient orbs
- Add 2-3 absolute-positioned gradient orb divs inside the Card (small radial gold gradients at corners, low opacity ~6-10%)
- Wrap content in `relative z-10`
- Remove `rounded-md` from icon container (use `rounded-none`)

### 5. Other card usages — Search and fix
- `ExportTab.tsx`, `DesignPropertiesPanel.tsx`, `EstimateWizard.tsx`, `NodePropertiesPanel.tsx`, etc. all use `Card` or `GlassCard` — they inherit the base changes automatically
- Any component with explicit `rounded-*` overrides on cards: remove them

## Result
All cards become square-cornered with a subtle gold glow aura and animated gold gradient orbs inside, consistent with the luxury black & gold theme.

