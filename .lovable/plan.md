

# Remove Tooltips & Continue UI Cleanup

## What's Changing

Remove all `Tooltip`/`TooltipProvider`/`TooltipContent`/`TooltipTrigger` usage across the app. Buttons already have visible labels or recognizable icons — tooltips add visual clutter and interfere with 3D interactions.

## Files to Modify

### 1. `src/App.tsx`
Remove the `<TooltipProvider>` wrapper from the app root. No longer needed.

### 2. `src/components/3d/FurnitureMiniToolbar.tsx`
Strip all `Tooltip`/`TooltipProvider` wrapping from the 6 buttons (Color, Rotate, Details, 3D View, Delete, Close). Keep the buttons as-is, just unwrap them.

### 3. `src/components/3d/FixtureMiniToolbar.tsx`
Same — strip tooltip wrappers from Rotate, Info, Delete, Close buttons.

### 4. `src/components/tabs/DesignTab.tsx`
Remove `TooltipProvider` block around the 4 camera preset buttons (Corner, Top Down, Eye Level, Birdseye). Keep the icon buttons.

### 5. `src/components/3d/FloorSurfaceDialog.tsx`
Remove tooltip around the "Scale" label — just show the label directly.

### 6. `src/components/floor-plan/CeilingPlanePanel.tsx`
Remove tooltip wrappers from the info badges.

### 7. `src/components/tiles/LeftoverFlowDiagram.tsx`
Remove tooltip wrappers from the header help icon and SVG nodes.

### 8. `src/components/floor-plan/PropertiesPanel.tsx`
Remove tooltip import (check if actually used in the component body).

### 9. `src/components/3d/RoomLightMarker.tsx`
Check and remove any tooltip usage.

## Approach
- For each file: remove `Tooltip`, `TooltipContent`, `TooltipTrigger`, `TooltipProvider` wrappers while keeping the inner content (buttons, labels, etc.) intact.
- Remove unused imports of tooltip components.
- The `tooltip.tsx` component file itself stays (no harm), but won't be imported anywhere.

