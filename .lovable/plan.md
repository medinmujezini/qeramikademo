

# Move Walkthrough to Dedicated Transparent Route

## Problem

When the WebUI plugin renders the web app inside Unreal Engine, the user sees a **black background** instead of the Unreal 3D scene behind it. This happens because:

1. The `/design` page has `bg-background` (near-black), `bg-card` header, tab bar, and the R3F `<Canvas>` — all opaque elements
2. Even with the `.unreal-transparent` CSS class, the page structure (header, tab bar, containers) still renders with solid backgrounds
3. Per the WebUI documentation, transparency works by sampling pixel alpha — pixels above `0.333` alpha are hit-testable, below are click-through. The entire page is currently opaque

## Solution

Create a new route `/walkthrough` that renders a **fully transparent page** with only:
- A minimal transparent header (logo + exit button only, with `bg-transparent`)
- The Unreal status badge (already has `bg-card/80` which is above the 0.333 threshold so it stays interactive)
- No Canvas, no tab bar, no panels, no particles, no backgrounds

When `enterWalkthrough` detects `isInsideUnreal()`, it navigates to `/walkthrough` instead of toggling state within `DesignTab`. When exiting (via Unreal message or Exit button), it navigates back to `/design`.

## Steps

### 1. Create `/walkthrough` page
**New file: `src/pages/WalkthroughPage.tsx`**

- Renders with `bg-transparent` on root div, no `bg-background` or `bg-card`
- Applies `unreal-transparent` class to `html` and `body` on mount, removes on unmount
- Minimal header: just the logo/brand text + "Exit" button, all with transparent backgrounds
- The "Running in Unreal Engine" status badge (green dot, text, exit button)
- Listens for `onExitWalkthrough` messages from Unreal to auto-navigate back
- No R3F Canvas, no 3D scene, no particles, no tab bar

### 2. Register the route
**File: `src/App.tsx`**

- Add `import WalkthroughPage from './pages/WalkthroughPage'`
- Add `<Route path="/walkthrough" element={<WalkthroughPage />} />`

### 3. Update DesignTab to navigate instead of toggling state
**File: `src/components/tabs/DesignTab.tsx`**

- In `enterWalkthrough`, when `isInsideUnreal()`: after exporting GLB + sending to Unreal, use `window.location.href = '/walkthrough'` (or React Router `navigate`) to go to the transparent page
- Remove the `unrealActive` state and its associated rendering logic from DesignTab (it moves to WalkthroughPage)
- Keep the non-Unreal browser walkthrough as-is (pointer lock, WASD, etc.)

### 4. Update CSS for full transparency
**File: `src/index.css`**

- Extend `.unreal-transparent` to also force `canvas` elements transparent and hide any remaining opaque containers
- Add `#root { background: transparent !important }` under `.unreal-transparent`

## Technical Detail

The WebUI transparency threshold is `0.333` — any pixel with alpha above this is interactive (receives mouse events), below is click-through to Unreal. The walkthrough page will:
- Use fully transparent backgrounds (alpha = 0) for the page body — click-through
- Keep the status badge and exit button with `bg-card/80` (alpha ≈ 0.8) — interactive
- The header brand text will be semi-transparent but positioned at the top edge, out of the way

## Files Modified

| File | Change |
|---|---|
| New `src/pages/WalkthroughPage.tsx` | Fully transparent page with minimal header + Unreal status badge |
| `src/App.tsx` | Add `/walkthrough` route |
| `src/components/tabs/DesignTab.tsx` | Navigate to `/walkthrough` when in Unreal, remove `unrealActive` UI |
| `src/index.css` | Strengthen transparent overrides |

