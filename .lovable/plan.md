

# Hide Browser Walkthrough When Inside Unreal + UE Agent Prompt

## What changes

When `isInsideUnreal()` is true, the browser-side walkthrough UI (pointer lock prompt, crosshair, WASD overlay, minimap, joysticks) should be completely hidden. The app should only export the GLB + manifest to Unreal and then show a minimal "Running in Unreal" status. Unreal handles all navigation and rendering.

## Changes

### 1. Skip browser walkthrough when inside Unreal

**File: `src/components/tabs/DesignTab.tsx`**

In `enterWalkthrough`:
- After sending GLB + manifest to Unreal via `startUnrealWalkthrough()`, set a new state `unrealActive = true` and skip the camera repositioning, pointer lock setup, and `setViewMode('walkthrough')` — instead set `viewMode` back to `'design'` (or a new `'unreal'` mode).

In the JSX walkthrough overlay section (~lines 2205-2265):
- Wrap all walkthrough UI (pointer lock prompt, crosshair, WalkthroughOverlay, WASD hint, joystick zones) in `!isInsideUnreal()` guard so none of it renders when Unreal is active.
- Add a minimal Unreal-active indicator: small badge showing "Running in Unreal Engine" with an Exit button that calls `sendToUnreal('exitWalkthrough')` and resets state.

### 2. Add Unreal-active state management

**File: `src/components/tabs/DesignTab.tsx`**

- Add `const [unrealActive, setUnrealActive] = useState(false)`
- In `enterWalkthrough`: when `isInsideUnreal()`, set `unrealActive = true`, skip browser walkthrough setup
- In the existing `onExitWalkthrough` listener: set `unrealActive = false`
- In `exitWalkthrough`: if `unrealActive`, send exit command to Unreal, reset state

### 3. Hide design toolbar walkthrough button in Unreal mode

**File: `src/components/tabs/DesignTab.tsx`**

When `unrealActive`, hide or disable the walkthrough button in the toolbar to prevent re-entry.

---

## Unreal Engine Agent Prompt

Below is the prompt/specification to give to the Unreal side developer:

---

**Unreal Engine WebUI Walkthrough Integration Spec**

The web app communicates with Unreal Engine via the WebUI plugin's JavaScript bridge (`window.ue5()` or `window.ue.interface.broadcast()`). The web app sends JSON-serialized events; Unreal sends responses via `window.postMessage()`.

**Events FROM Web → Unreal:**

1. **`startWalkthrough`** — Begin first-person walkthrough
   ```json
   {
     "glbBase64": "<base64-encoded GLB file>",
     "manifest": {
       "projectId": "local",
       "revision": 1,
       "sceneScale": 0.01,
       "spawnPoint": { "x": 3.5, "y": 0.0, "z": 2.1 },
       "spawnRotation": 180,
       "roomDimensions": { "width": 7.0, "depth": 5.0, "height": 2.7 },
       "collisionMode": "mesh",
       "lights": [
         { "type": "point|spot|directional|rect", "position": {...}, "color": "#ffffff", "intensity": 1.0, "castShadow": true }
       ],
       "materials": [
         { "meshName": "wall_xxx", "type": "paint|tile|wallpaper", "color": "#E8E0D0", "pbrTextures": { "albedo": "url", "normal": "url", "roughness": "url", "ao": "url" } }
       ],
       "furniture": [
         { "id": "xxx", "templateId": "sofa_modern", "position": {...}, "rotation": 0, "dimensions": {...}, "color": "#..." }
       ],
       "emissiveLights": [
         { "position": { "x": 1.2, "y": 2.7, "z": 0.8 }, "intensity": 0.6, "color": "#FFF5E6", "radius": 8.0 }
       ]
     }
   }
   ```
   
   **Unreal should:**
   - Decode the base64 GLB and import it as a static mesh actor
   - Use the manifest to create UE light actors (PointLight, SpotLight, RectLight) at specified positions — do NOT rely on GLB lights
   - Swap materials on named meshes using the `materials` array — match by `meshName`
   - Place the player pawn at `spawnPoint` with `spawnRotation` (degrees, clockwise from +Z)
   - Set collision from the GLB mesh (`collisionMode: "mesh"`) or generate box colliders
   - Create emissive ceiling lights from the `emissiveLights` array as invisible PointLights
   - Enable first-person navigation (WASD + mouse look, eye height ~1.6m)

2. **`exitWalkthrough`** — Web app requests Unreal to stop walkthrough
   ```json
   {}
   ```

**Events FROM Unreal → Web (via `postMessage`):**

1. **`exitWalkthrough`** — User pressed Escape or Unreal wants to return control
   ```json
   { "event": "exitWalkthrough" }
   ```

**GLB Contents:**
- Wall meshes named `wall_<id>` with basic materials (colors embedded)
- Door meshes with frame + leaf geometry, named `door_<id>`
- Window meshes named `window_<id>`
- Floor mesh named `floor` or `floor_surface_*`
- Ceiling mesh named `ceiling`
- Furniture meshes named by template ID
- Point/spot/directional lights via `KHR_lights_punctual` extension
- RectAreaLight proxies as PointLights (intensity scaled by area)
- Editor-only objects (grid, helpers, gizmos) are stripped

**Scale:** All geometry is in meters (the web app converts from cm internally). `sceneScale: 0.01` is informational.

**Material Pipeline:** For high-quality rendering, use the manifest `materials` array to apply Unreal materials (Megascans, custom PBR) to the imported meshes by matching `meshName`. The GLB contains basic colors as fallback.

---

## Files Modified

| File | Change |
|---|---|
| `src/components/tabs/DesignTab.tsx` | Add `unrealActive` state, skip browser walkthrough when in UE, show minimal UE status badge |

