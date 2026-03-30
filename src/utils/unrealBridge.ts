/**
 * Unreal Engine WebUI Bridge
 * 
 * Provides communication between the Lovable web app and Unreal Engine
 * when running inside the WebUI plugin. Falls back gracefully when
 * running standalone in a browser.
 */

declare global {
  interface Window {
    ue5?: (event: string, data: string) => void;
    ue?: {
      interface: {
        broadcast: (event: string, data: string) => void;
      };
    };
  }
}

/**
 * Check if the app is running inside Unreal Engine's WebUI plugin.
 */
export function isInsideUnreal(): boolean {
  return typeof window.ue5 === 'function' || typeof window.ue?.interface?.broadcast === 'function';
}

/**
 * Send a command to Unreal Engine via WebUI.
 * No-op if not running inside UE.
 */
export function sendToUnreal(event: string, data: Record<string, unknown> = {}): boolean {
  const payload = JSON.stringify(data);

  if (typeof window.ue5 === 'function') {
    window.ue5(event, payload);
    return true;
  }

  if (typeof window.ue?.interface?.broadcast === 'function') {
    window.ue.interface.broadcast(event, payload);
    return true;
  }

  return false;
}

/**
 * Send the startWalkthrough command to Unreal Engine.
 * Includes the bundle path and manifest data.
 */
export function startUnrealWalkthrough(manifest: Record<string, unknown>, bundlePath?: string): boolean {
  return sendToUnreal('startWalkthrough', {
    bundlePath: bundlePath ?? '/Content/RoomBundles/room.glb',
    manifest,
  });
}

/**
 * Register a callback for when Unreal signals to exit walkthrough.
 * Returns a cleanup function.
 */
export function onExitWalkthrough(callback: () => void): () => void {
  const handler = (event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data?.event === 'exitWalkthrough') {
        callback();
      }
    } catch {
      // Ignore non-JSON messages
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
