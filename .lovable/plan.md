

# Elevate Design Header to Ultra-Luxury

## What's Changing

The 3-layer header (brand bar, tab nav, contextual toolbar) needs more visual drama — animated gold borders, richer typography, deeper layered depth, and cinematic accents.

## Changes

### 1. `src/pages/EndUserPlatform.tsx` — Layer 1 & Layer 2

**Layer 1 (brand header):**
- Add animated shimmer border on the bottom edge using `::after` pseudo-element
- Increase height from `h-14` to `h-16` for more breathing room
- "Design Studio" text: add gold text-shadow (`0 0 20px hsl(38 60% 68% / 0.3)`)
- Add a third gradient orb (center-top, larger, more diffuse) for ambient depth
- Sparkles icon: add `animate-pulse` for subtle life

**Layer 2 (tab nav):**
- Add a second gradient orb bottom-left for symmetry
- Tab triggers: add gold text-shadow on active state
- Increase nav height slightly for more luxury spacing (`h-12`)
- Add shimmer sweep animation on the bottom border (reuse `shimmer-border` keyframe)

### 2. `src/components/tabs/DesignTab.tsx` — Layer 3 toolbar

- Add animated shimmer on top border (`.shimmer-border-top` class)
- Add a gradient orb to the toolbar for ambient glow
- Dividers: use `bg-primary/25` with a subtle gold glow shadow
- "Enhanced" label: add gold text-shadow
- Increase toolbar height from `h-10` to `h-11`

### 3. `src/index.css` — New header luxury utilities

```css
/* Shimmer border bottom */
.shimmer-border-bottom::after {
  content: '';
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, hsl(38 60% 68% / 0.4), transparent);
  background-size: 200% 100%;
  animation: shimmer-border 3s ease-in-out infinite;
}

/* Header gold text shadow */
.gold-text-glow {
  text-shadow: 0 0 20px hsl(38 60% 68% / 0.25);
}
```

## Files Modified

| File | Change |
|---|---|
| `src/pages/EndUserPlatform.tsx` | Taller headers, shimmer borders, extra orbs, pulsing icon, gold text glow |
| `src/components/tabs/DesignTab.tsx` | Shimmer top border on toolbar, orb, glowing dividers, taller bar |
| `src/index.css` | `.shimmer-border-bottom`, `.gold-text-glow` utilities |

