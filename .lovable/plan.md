

## Plan: Fix Reset View Camera Distance

### Problem
The current camera position formula `[roomW, roomW * 0.8, roomH]` places the camera too close to the room, resulting in a zoomed-in view that cuts off parts of the room.

### Solution
Pull the camera back by using a distance multiplier based on the room diagonal, ensuring the full room is always visible with comfortable padding.

### Changes — `src/components/tabs/DesignTab.tsx`

1. Calculate `maxDim = Math.max(roomW, roomH)` and use it to set a comfortable viewing distance:
   - `position = [roomW/2 + maxDim, maxDim * 0.9, roomH/2 + maxDim]`
   - `target = [roomW/2, 0, roomH/2]` (stays centered on room)
   
   This ensures the camera is always far enough back to see the entire room regardless of dimensions, with an isometric-ish angle.

2. Same formula applied in both the initial `<PerspectiveCamera>` position and the `handleResetView` callback.

No other files changed.

