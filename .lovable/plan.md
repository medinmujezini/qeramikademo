

# Fix: WalkthroughPage Black Background Over Unreal Engine View

## Problem
The `unreal-transparent` CSS class only overrides backgrounds on `html`, `body`, `#root`, `canvas`, and `.canvas-vignette`. Any intermediate wrapper divs with Tailwind classes like `bg-background`, `dark`, or `min-h-screen` still render with the dark theme's near-black (`hsl(0 0% 4%)`) background, blocking the Unreal Engine view behind the WebUI layer.

## Fix — Two files

### 1. `src/index.css` — Expand the transparency override
Add a wildcard descendant rule under `.unreal-transparent` that forces all child elements to have transparent backgrounds. This is aggressive but correct — in Unreal overlay mode, the entire page must be see-through except for explicitly styled UI elements (the status badge).

```css
.unreal-transparent *:not([data-unreal-opaque]) {
  background: transparent !important;
  background-color: transparent !important;
}
```

The `[data-unreal-opaque]` attribute exempts the status badge and exit button from being made transparent.

### 2. `src/pages/WalkthroughPage.tsx` — Mark the badge as opaque
Add `data-unreal-opaque` to the status badge container so it keeps its `bg-card/80` backdrop while everything else goes fully transparent.

## Files changed
- `src/index.css` — add wildcard transparency rule
- `src/pages/WalkthroughPage.tsx` — add `data-unreal-opaque` attribute to badge div

