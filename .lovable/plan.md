

# Elevate Design Tab to Ultra-Luxury

Based on research into luxury web design (Chanel, Rolex, Bulgari patterns), the Design tab is missing several hallmarks of true luxury digital experiences:

1. **Animated gold shimmer lines** — thin animated gold lines that sweep across panel borders
2. **Particle/dust motes** — floating gold particles in the canvas background for ambient richness
3. **Micro-interactions** — buttons that pulse gold on hover with a slow fade
4. **Layered depth** — panels with inner shadow + outer glow creating a "floating above velvet" feel
5. **Cinematic overlays** — vignette darkening at canvas edges for photographic drama
6. **Typography hierarchy** — larger, thinner, more spaced-out headings with gold text-shadow
7. **Animated gradient borders** — panels with slowly rotating gold gradient borders instead of static lines

## Changes

### 1. `src/index.css` — New luxury effects

**Gold shimmer sweep on panel borders:**
```css
@keyframes shimmer-border {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.glass-floating::before {
  content: '';
  position: absolute; inset: 0;
  border: 1px solid transparent;
  background: linear-gradient(90deg, transparent, hsl(38 60% 68% / 0.3), transparent) border-box;
  background-size: 200% 100%;
  animation: shimmer-border 4s ease-in-out infinite;
  pointer-events: none; z-index: 1;
  mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
}
```

**Canvas vignette overlay:**
```css
.canvas-vignette::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 50%, hsl(0 0% 0% / 0.3) 100%);
  pointer-events: none; z-index: 1;
}
```

**Gold dust particle animation:**
```css
@keyframes float-particle {
  0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
}
.gold-particle {
  position: absolute;
  width: 2px; height: 2px;
  background: hsl(38 60% 68% / 0.4);
  border-radius: 50%;
  pointer-events: none;
  animation: float-particle var(--duration, 8s) var(--delay, 0s) infinite;
}
```

**Enhanced panel styling:**
- `glass-floating`: add `inner shadow inset 0 1px 0 hsl(38 60% 68% / 0.08)` for top edge highlight
- `panel-header`: subtle gold gradient background instead of flat `muted/0.5`
- `panel-header-title`: increase letter-spacing to `0.2em`, add stronger text-shadow

**Luxury hover glow for interactive elements:**
```css
.luxury-hover-glow {
  transition: box-shadow 0.4s ease, border-color 0.4s ease;
}
.luxury-hover-glow:hover {
  box-shadow: 0 0 20px hsl(38 60% 68% / 0.12), inset 0 1px 0 hsl(38 60% 68% / 0.1);
  border-color: hsl(38 60% 68% / 0.3);
}
```

### 2. `src/components/tabs/DesignTab.tsx` — Cinematic canvas

**Canvas wrapper (line ~1808):**
- Add `canvas-vignette` class to the canvas container for photographic edge darkening
- Add 5-6 `gold-particle` divs with staggered `--delay` and `--duration` CSS vars for ambient floating particles

**Layer 3 toolbar (line 1588):**
- Add subtle gold gradient background: `bg-gradient-to-r from-card via-card to-card` with a faint gold center glow
- Toolbar dividers: animate opacity with a slow pulse

**Library panel (line 1910-1922):**
- Panel gets the shimmer border automatically from CSS
- Add a second, smaller gradient orb at top-right for more depth

**Properties panel (line 1926-1949):**
- Same shimmer border treatment
- Add top-right gradient orb

**Walkthrough overlays (line 1968-2000):**
- Add gold particles behind the loading spinner
- "Walkthrough Mode" title: add gold text-shadow `0 0 40px hsl(38 60% 68% / 0.3)`

**Drop zone overlay (line 1896-1901):**
- Add pulsing gold border animation instead of static gradient
- "Drop here" text: add `animate-pulse` with gold glow

**Render dialog (line 2038-2094):**
- Image container: add inner gold glow shadow
- Buttons: use `luxury` variant for Download

### 3. `src/components/design/UnifiedLibrary.tsx` — Luxury items

**Library items:**
- Add `luxury-hover-glow` class for slow gold glow transition on hover
- Item thumbnail border: animate to gold on hover with 0.4s transition
- Active/selected items: persistent gold glow ring

**Tab triggers:**
- Add gold underline slide-in animation on active state (transform from left)

### 4. `src/components/design/DesignPropertiesPanel.tsx` — Rich details

**Selected item card:**
- Add thin gold top accent line (2px `bg-primary/40`)
- Dimension values: use `font-display` for numbers

**Scene summary cards:**
- Add `luxury-hover-glow` class
- Badge counts: gold tinted background

## Files Modified

| File | Change |
|---|---|
| `src/index.css` | Shimmer border animation, vignette, gold particles, luxury hover glow, enhanced panel headers |
| `src/components/tabs/DesignTab.tsx` | Vignette on canvas, gold particles, enhanced toolbar, richer overlays |
| `src/components/design/UnifiedLibrary.tsx` | Luxury hover glow on items, animated tab underlines |
| `src/components/design/DesignPropertiesPanel.tsx` | Gold accent lines, luxury hover cards, display font on values |

