

## Changes

### 1. Increase canvas min-height (line 1169)
Change `min-h-[120px]` → `min-h-[280px]` for a larger tile preview.

### 2. Make legend indicators bigger and clearer (lines 982-992)
- Increase font from `10px` → `13px bold`
- Draw colored square swatches (8×8px) instead of tiny `▪` unicode characters
- Add more spacing between legend items
- Move legend up slightly (from `height - 8` to `height - 12`) so it's not crammed at the bottom

