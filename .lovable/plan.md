

# Automatic GLB Export on Walkthrough — Plan

## What Changes

Remove the manual "Export GLB" button. When the user presses the Walkthrough button, the app automatically exports the scene as GLB, sends it to Unreal via WebUI, shows a loading overlay while generating, then transitions into walkthrough mode.

## Flow

```text
User clicks "Walkthrough" → Loading overlay appears → GLB generated from scene →
  If inside UE: send GLB as base64 + manifest via ue5("startWalkthrough", {...})
  If standalone: download GLB + manifest, then enter local walkthrough
→ UI fades out → Walkthrough active
```

## Changes

### 1. `src/utils/unrealBridge.ts` — Send GLB data inline

- Update `startUnrealWalkthrough` to accept a base64-encoded GLB string alongside the manifest
- Send as `ue5("startWalkthrough", { glbBase64, manifest })` so UE receives the scene data directly without needing filesystem access
- Add a helper `arrayBufferToBase64` for the conversion

### 2. `src/components/tabs/DesignTab.tsx` — Merge export into walkthrough flow

- **Remove** the "Export GLB" button (lines ~1690-1706) entirely
- **Modify `enterWalkthrough`** to become async:
  1. Set a new `isPreparingWalkthrough` state to `true`
  2. Show a fullscreen loading overlay (fade in with backdrop blur, spinner + "Preparing walkthrough...")
  3. Call `exportSceneToGLBBlob(scene)` and `generateRoomManifest(floorPlan)`
  4. If `isInsideUnreal()`: convert GLB blob to base64, call `startUnrealWalkthrough({ glbBase64, manifest })`
  5. If standalone: proceed with local walkthrough (set camera position, set viewMode to 'walkthrough')
  6. Set `isPreparingWalkthrough` to `false`
  7. On error: show toast, stay in design mode
- **Remove `handleExportForUnreal`** function (now merged into `enterWalkthrough`)
- **Remove `isExporting` state** (replaced by `isPreparingWalkthrough`)
- **Add loading overlay UI**: when `isPreparingWalkthrough` is true, show a fullscreen overlay with spinner and "Preparing walkthrough..." text, same z-index as the walkthrough overlays

### 3. `src/utils/unrealBridge.ts` — Listen for UE exit

- The existing `onExitWalkthrough` callback already handles UE signaling exit
- Wire it up in `DesignTab` via a `useEffect` that calls `exitWalkthrough` when UE broadcasts `exitWalkthrough`

## Technical Details

- GLB base64 encoding: `btoa(String.fromCharCode(...new Uint8Array(buffer)))` or chunked approach for large scenes
- The `ue5()` call has no practical payload size limit per WebUI plugin docs — it serializes to a JSON string internally
- For standalone mode (not inside UE), the walkthrough button still works as before (local WASD walkthrough) but now always regenerates the GLB in case the user later wants to use it in UE
- The `isExporting` state and the separate export button are fully removed — single entry point via walkthrough button

