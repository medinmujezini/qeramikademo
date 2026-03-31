

# Luxury Button Redesign

## Changes

### `src/components/ui/button.tsx`

**Base class:**
- `rounded-sm` → `rounded-none` (sharp, architectural)
- `text-sm font-medium` → `text-xs font-light uppercase tracking-[0.15em]` (refined luxury typography)

**Variants:**

| Variant | New styling |
|---|---|
| `default` | Gold bg, dark text, subtle inner glow, hover intensifies glow: `bg-primary text-primary-foreground shadow-[inset_0_1px_0_hsl(38_60%_78%/0.3)] hover:shadow-[inset_0_1px_0_hsl(38_60%_78%/0.3),0_0_20px_hsl(38_60%_68%/0.2)]` |
| `luxury` | Transparent, double gold border effect via box-shadow inset + border, shimmer hover: `bg-transparent border border-primary/25 text-primary hover:bg-primary/5 hover:border-primary/50 hover:shadow-[inset_0_0_20px_hsl(38_60%_68%/0.06),0_0_25px_hsl(38_60%_68%/0.12)]` |
| `outline` | Thin gold border, gold text, hover fills subtly: `border border-primary/20 text-primary/80 hover:bg-primary/5 hover:border-primary/40 hover:text-primary` |
| `glow` | Stronger gold aura: `shadow-[0_0_20px_hsl(38_60%_68%/0.25)] hover:shadow-[0_0_40px_hsl(38_60%_68%/0.4)]` |
| `ghost` | Add gold tint on hover: `hover:bg-primary/5 hover:text-primary` |
| `secondary` | Gold-tinted bg: `bg-primary/8 text-primary hover:bg-primary/12` |
| `destructive` | Keep red, add subtle glow |

**Sizes:**
- All sizes: `rounded-none` instead of `rounded-md`
- `lg`: wider padding `px-8`, `tracking-[0.2em]`
- `sm`: `tracking-widest`

### `src/index.css` — Shimmer animation

Add a CSS class for a gold shine sweep on hover:
```css
.btn-shimmer {
  position: relative;
  overflow: hidden;
}
.btn-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, hsl(38 60% 68% / 0.1) 50%, transparent 100%);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}
.btn-shimmer:hover::after {
  transform: translateX(100%);
}
```

### `src/components/home/RoleCard.tsx`

Update CTA button to use the new `luxury` variant with `btn-shimmer` class — remove manual border/hover overrides that now duplicate the variant.

## Files

| File | Change |
|---|---|
| `src/components/ui/button.tsx` | Square corners, uppercase tracking, luxury typography, gold glow variants |
| `src/index.css` | Shimmer sweep animation class |
| `src/components/home/RoleCard.tsx` | Use `luxury` variant + `btn-shimmer`, remove redundant overrides |

