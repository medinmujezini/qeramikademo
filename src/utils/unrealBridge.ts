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
 * Convert an ArrayBuffer to a base64 string (chunked to avoid stack overflow).
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

/**
 * Send the startWalkthrough command to Unreal Engine.
 * Includes the GLB scene as base64 and the manifest data.
 */
export function startUnrealWalkthrough(glbBase64: string, manifest: Record<string, unknown>): boolean {
  return sendToUnreal('startWalkthrough', {
    glbBase64,
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
