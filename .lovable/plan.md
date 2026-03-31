

# Luxury Redesign: Admin Panel + Design Tab

## Admin Layout (`src/components/admin/AdminLayout.tsx`)

Apply the same black & gold luxury aesthetic used on the Home page:

- **Sidebar**: Solid `bg-card` background, `rounded-none` on logo icon, gold border-right (`border-primary/15`), nav items use `rounded-none` with gold active state, add gradient orb in sidebar bottom
- **Logo area**: Use `font-display` (Outfit) for "Admin Panel", `uppercase tracking-[0.15em]`, gold icon container `rounded-none`
- **Nav items**: `rounded-none` instead of `rounded-lg`, active = `bg-primary/10 text-primary border-l-2 border-primary`, inactive hover = `hover:bg-primary/5 hover:text-primary`
- **Top bar**: Solid `bg-card` with gold bottom border, breadcrumb uses `font-display`, user avatar `rounded-none`
- **Background**: Add large gold gradient orb in bottom-left of main content area
- **Footer buttons**: Use `luxury` variant for "Back to App"

## Design Tab Panels (`src/components/tabs/DesignTab.tsx`)

- **Layer 3 toolbar** (line 1588): Solid `bg-card` background, gold bottom border (`border-primary/10`), remove transparency
- **Library panel** (line 1913): `rounded-none`, add gold glow shadow, add gradient orb divs inside, `panel-header` with gold bottom border
- **Properties panel** (line 1927): Same treatment — `rounded-none`, gold glow, gradient orbs
- **Glass control button** (line 1955): `rounded-none`
- **Drop zone overlay** (line 1897): Gold-tinted border instead of generic
- **Walkthrough overlay** (line 1966): Add gradient orb behind loading spinner

## Platform Header (`src/pages/EndUserPlatform.tsx`)

- **Layer 1**: Solid `bg-card`, gold border, "Design Studio" in `font-display uppercase tracking-[0.15em]`
- **Layer 2 tab bar**: Solid `bg-card`, gold bottom border
- **Quote tab**: Card icon container `rounded-none`, add gradient orbs to card

## CSS Updates (`src/index.css`)

- `.glass-floating`, `.glass-toolbar`, `.glass-control`: Force `border-radius: 0`, add gold glow shadow
- `.panel-header`: Gold bottom border (`hsl(var(--primary) / 0.15)`)
- `.glass-sidebar`: Solid `bg-card`, gold right border

## Files Modified

| File | Change |
|---|---|
| `src/components/admin/AdminLayout.tsx` | Black & gold sidebar, square corners, gold accents, gradient orbs, luxury typography |
| `src/components/tabs/DesignTab.tsx` | Square panels, gold glow, gradient orbs, solid toolbar bg |
| `src/pages/EndUserPlatform.tsx` | Solid headers, gold borders, luxury typography, quote card orbs |
| `src/index.css` | Force `border-radius: 0` on glass utilities, gold glow shadows |

