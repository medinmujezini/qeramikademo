

## Plan: Add Minimize/Maximize Toggle to Tile Library Panel

### What
Add a collapsible toggle to the Tile Library panel (left side in Tiles tab), matching the pattern used by Preview/Calculations on the right side. When minimized, the panel collapses to a small icon button; clicking it restores the full panel.

### How

**File: `src/components/tabs/TilesTab.tsx`**

1. Add a `showTileLibrary` state (default `true`).
2. When `showTileLibrary` is `true`, render the current full Tile Library panel as-is, but add a minimize button (using `Minus` or `EyeOff` icon) in the panel header next to "Tile Library".
3. When `showTileLibrary` is `false`, render a small floating icon button (same position, `glass-control` styled) with `Grid3X3` icon that restores the panel on click.
4. This mirrors the right panel's toggle pattern — a button to show/hide, with smooth transitions.

### Changes

- **`src/components/tabs/TilesTab.tsx`** only:
  - Add `const [showTileLibrary, setShowTileLibrary] = useState(true);`
  - In the panel header div, add a close/minimize button (`X` or `Minus` icon) that sets `showTileLibrary` to `false`
  - When `showTileLibrary` is `false`, render a small `glass-control` button at `top-20 left-6` with `Grid3X3` icon that sets it back to `true`
  - No changes to `TileLibraryPanel.tsx` or other files

