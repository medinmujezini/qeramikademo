

## Updated Plan: Unreal Engine Walkthrough Integration

### Change from previous plan
Remove all interactive object editing, selection, and semantic ID mapping from the walkthrough. The UE walkthrough is **view-only** — users design in Lovable, then walk through a static scene in Unreal. No furniture moving, no material swapping, no click-to-select during walkthrough.

### Simplified Architecture

```text
Lovable (design) → Export GLB + manifest → UE loads scene → First-person walkthrough (view only)
```

### Lovable Side (3 files)

**1. `src/utils/glbExporter.ts`** — Scene exporter
- Use Three.js `GLTFExporter` to serialize the current R3F scene (walls, floor, furniture, fixtures, tiles) into a single `.glb`
- Embed PBR textures (albedo, normal, roughness) into the binary
- No semantic IDs or interactive object metadata needed

**2. `src/utils/roomManifest.ts`** — Minimal manifest
```json
{
  "projectId": "uuid",
  "revision": 1,
  "sceneScale": 0.01,
  "spawnPoint": { "x": 150, "y": 160, "z": 200 },
  "spawnRotation": 0,
  "roomDimensions": { "width": 400, "depth": 300, "height": 280 },
  "collisionMode": "mesh"
}
```
- `spawnPoint` defaults to room center at eye height (160cm)
- No `interactiveObjects` array — removed since walkthrough is view-only

**3. `src/utils/unrealBridge.ts`** — WebUI bridge
- Detect UE environment (`window.ue5` exists)
- `sendToUnreal("startWalkthrough", { glbBase64, manifest })` — sends GLB inline as base64
- Listen for `exitWalkthrough` callback to restore Lovable UI
- No position sync or object selection callbacks needed

**4. `src/components/tabs/DesignTab.tsx`** — Automatic export on walkthrough
- **No manual export button** — GLB is generated automatically when user clicks "Walkthrough"
- Shows loading overlay ("Preparing walkthrough…") while generating
- If inside UE WebUI: converts GLB to base64, sends via `ue5("startWalkthrough", {...})`
- If standalone: proceeds with local WASD walkthrough
- Listens for UE `exitWalkthrough` callback to restore design mode

### Unreal Side (guidance only, not built by Lovable)

UE has exactly 4 jobs:
1. Receive `startWalkthrough` via WebUI OnBroadcast
2. Decode base64 GLB and load via glTFRuntime
3. Spawn imported meshes with mesh collision
4. Spawn/possess first-person pawn at manifest spawn point

No object selection, no material editing, no UI overlays during walkthrough. ESC exits back to Lovable UI.

### What was removed
- `interactiveObjects` from manifest
- Semantic mesh naming/IDs in GLB export
- Object click-to-select in UE
- Material swap callbacks
- Position sync from UE back to web UI
- Any bidirectional state during walkthrough
- Manual "Export GLB" button (replaced by automatic export on walkthrough)
