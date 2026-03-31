

# Luxury UI Enhancement

Based on research into high-end web design (Chanel, Rolex, Bulgari-style sites), luxury digital experiences share these core principles:

1. **Generous whitespace** — content breathes, nothing feels cramped
2. **Refined typography** — larger headings, wide letter-spacing on labels, thinner body weight
3. **Subtle gold accents** — thin gold dividers, gold underlines, not heavy gold blocks
4. **Restrained animations** — slow, elegant fade-ins instead of bouncy effects
5. **Monogram/logo refinement** — a distinctive brand mark
6. **Thin borders, not thick** — hairline separators, not chunky borders
7. **Uppercase tracking on labels** — small caps with wide spacing signal prestige
8. **Hero imagery or dramatic empty space** — let the hero section command attention

## Changes

### 1. Home Page (`src/pages/Home.tsx`)
- Increase hero vertical padding significantly (py-24 to py-32)
- Make heading larger (text-5xl md:text-6xl) with tighter leading and wide letter-spacing
- Add a thin gold horizontal rule below the hero headline
- Subtitle: lighter weight, more muted, wider max-width
- Replace the blocky logo square with a gold monogram-style "SD" text mark
- Add "INTERIOR DESIGN" small-caps tracking-widest subtitle under brand name in header
- Footer: add thin gold divider line, wider letter-spacing
- Cards: more padding, subtle gold top-border accent line

### 2. RoleCard (`src/components/home/RoleCard.tsx`)
- Add a thin gold top-border (2px) as a luxury accent line
- Increase internal padding (p-8 instead of p-6)
- Make the subtitle tracking wider (tracking-[0.2em])
- Use a more elegant check mark — thin gold line instead of circle background
- CTA button: outline variant with gold border instead of solid gold block

### 3. Global Typography & Spacing (`src/index.css`)
- Add heading letter-spacing: -0.02em for larger sizes, tighter
- Add a `.luxury-label` utility: uppercase, tracking-[0.15em], text-xs, text-muted-foreground
- Add `.luxury-divider`: 1px gold line, 60px wide, centered, with opacity
- Increase base body line-height slightly (1.7)

### 4. Platform Headers (`EndUserPlatform.tsx`, `WorkerPlatform.tsx`)
- Add thin gold bottom-border accent (border-b border-primary/20) to header
- Brand text: add tracking-wider
- Slightly taller header (h-14 instead of h-12)

### 5. Button Refinements (`src/components/ui/button.tsx`)
- Default variant: reduce border-radius to rounded-sm for a more tailored look
- Add a new `luxury` variant: transparent bg, gold border, gold text, subtle hover glow

### 6. CSS Cleanup (`src/index.css`)
- Remove leftover glassmorphism code (glass-primary with blue rgba, orbs with blue/purple, glass-header hover with blue hsl)
- Update remaining hardcoded `hsl(217 91% 60%)` references to use `var(--primary)`
- Add smooth fade-in animation to body content

### 7. Card Component (`src/components/ui/card.tsx`)
- Slightly reduce border-radius (rounded-md instead of rounded-lg) for a sharper luxury feel

## Files Modified
| File | Change |
|---|---|
| `src/pages/Home.tsx` | Luxury hero, gold monogram, generous spacing |
| `src/components/home/RoleCard.tsx` | Gold accent line, wider padding, refined CTA |
| `src/index.css` | Luxury utilities, blue cleanup, body line-height |
| `src/pages/EndUserPlatform.tsx` | Header refinements |
| `src/pages/WorkerPlatform.tsx` | Header refinements |
| `src/components/ui/button.tsx` | Sharper radius, luxury variant |
| `src/components/ui/card.tsx` | Sharper radius |

