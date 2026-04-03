

# Fix: GLB Curtain Sticking Out Like Sliding Door

## Problems

From the screenshot, at 100% open the two curtain halves slide far outside the room boundaries like sliding doors. Two root causes:

1. **Z-depth forced to 3cm** (line 57: `scaleZ = 0.03 / size.z`): This crushes the GLB model flat, destroying all fabric texture and making it look like a colored slab/wall panel instead of a curtain.

2. **Open offset too large** (line 93: `openOffset = openAmount * (targetWidth / 2)`): At 100% open, each half slides outward by half the curtain width. Since the curtain is wider than the window, the halves extend way past the wall edges and stick out of the room.

## Fix — `src/components/3d/Curtain3D.tsx`

### Change 1: Preserve model's natural depth ratio
Instead of clamping Z to 3cm, scale Z proportionally with X (same scale factor). This keeps the curtain's natural folds and fabric look. Cap depth at a reasonable maximum (e.g. 15cm) to prevent excessively deep models.

```
const scaleX = size.x > 0 ? targetWidth / size.x : 1;
const scaleY = size.y > 0 ? targetHeight / size.y : 1;
const scaleZ = scaleX; // preserve proportions
// Cap max depth to 15cm
const maxDepth = 0.15;
const actualDepth = size.z * scaleZ;
if (actualDepth > maxDepth) scaleZ = maxDepth / size.z;
```

### Change 2: Reduce open offset — curtains bunch, not slide infinitely
Limit the maximum slide distance so curtains stay within the wall boundaries. Use `openAmount * targetWidth * 0.35` instead of `* 0.5`. This means at 100% open, each half moves 35% of width (revealing 70% of center) rather than sliding completely off.

### Change 3: Compress X when opening (gather effect)
As the curtain opens, slightly compress each half's X scale to simulate fabric bunching: `scaleX * (1 - openAmount * 0.3)`. This makes opened curtains narrower (gathered) rather than just sliding full-width panels.

## Result
- Curtain keeps its 3D fabric texture instead of looking like a flat slab
- At 100% open, halves stay within the wall area instead of protruding out of the room
- Gathered/bunched appearance when open

One file: `src/components/3d/Curtain3D.tsx`

