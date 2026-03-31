

# Apply Luxury Style to Design Tab & Platform Header

The Design tab's header layers and floating panels need to match the square-cornered, gold-glowing, orb-adorned card style used on the Home page.

## Changes

### 1. `src/pages/EndUserPlatform.tsx` — Luxury header styling

- **Layer 1 (brand header)**: Add gold glow shadow, gold bottom border (`hsl(var(--primary) / 0.15)`), remove `backdrop-blur-sm`, use solid `bg-card` background. Add "Design Studio" text with `font-display` (Outfit) and `uppercase tracking-[0.15em]`.
- **Layer 2 (tab nav)**: Gold bottom border, solid `bg-card` background. Tab triggers already use gold active state via `data-[state=active]:text-primary`.
- **Quote tab card**: Remove `rounded-xl` from icon container (use `rounded-none`), add gradient orbs inside the card.

### 2. `src/components/tabs/DesignTab.tsx` — Layer 3 toolbar & panels

- **Layer 3 toolbar** (line 1588): Solid `bg-card` background, gold bottom border (`hsl(var(--primary) / 0.12)`), remove transparency.
- **Floating Library panel** (line 1913): Change `rounded-xl` to `rounded-none`, add gold glow `shadow-[0_0_30px_hsl(38_60%_68%/0.08)]`, add gradient orb divs inside the panel wrapper.
- **Floating Properties panel** (line 1927): Same treatment — `rounded-none`, gold glow, gradient orbs.
- **Glass control button** (line 1955): `rounded-none` instead of default rounded.
- **Render dialog** (line 2037): Already uses `DialogContent` which inherits card styling.
- **Walkthrough overlay** (line 1966): Already fine with `bg-background/80`.

### 3. `src/components/toolbars/DesignToolbar.tsx` — No structural changes needed

The toolbar component renders inline content — it inherits the Layer 3 bar styling from the parent. No changes.

### 4. `src/index.css` — Glass panel updates

- `.glass-floating`: Set `border-radius: 0`, add `box-shadow: 0 0 30px hsl(var(--primary) / 0.06)`, solid dark background instead of transparent.
- `.glass-toolbar`: Set `border-radius: 0`.
- `.glass-control`: Set `border-radius: 0`.
- `.panel-header`: Ensure gold bottom border uses `hsl(var(--primary) / 0.15)`.

## Files Modified

| File | Change |
|---|---|
| `src/pages/EndUserPlatform.tsx` | Solid bg, gold borders, font-display title, orbs in Quote card |
| `src/components/tabs/DesignTab.tsx` | Square panels, gold glow, gradient orbs in Library/Properties |
| `src/index.css` | Force `border-radius: 0` and gold glow on glass utilities |

