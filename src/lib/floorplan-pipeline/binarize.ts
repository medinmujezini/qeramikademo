/**
 * Binarization + mask application.
 *
 * Stage 03 contract: produce a 1-bit raster where walls = 0 (black)
 * and everything else = 255 (white), at the same WxH as the input.
 *
 * We do this client-side to keep the edge function thin: the AI returns
 * mask regions only, and we render the cleaned image here. This guarantees
 * reproducibility from the same masks regardless of AI backend.
 */
import type { CleanMasks } from './types';

/** Load a File/Blob/dataURL into an HTMLImageElement */
export async function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    // revoke later via caller if blob
  }
}

/** Draw image to an offscreen canvas and return the 2D context. */
export function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Pure-black-and-white threshold of an image.
 * Walls (dark pixels) become 0, everything else 255.
 *
 * Uses a luminance threshold with a slight bias toward black so anti-aliased
 * wall edges stay solid.
 */
export function binarize(
  src: HTMLImageElement | HTMLCanvasElement,
  threshold = 160,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 'naturalWidth' in src ? src.naturalWidth : src.width;
  canvas.height = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Rec.601 luminance
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Apply AI-provided masks to a binarized canvas:
 *  - regionsToErase → fill WHITE (remove furniture/text/door swings)
 *  - windowsToFill  → fill BLACK (restore wall through window opening)
 *
 * Returns a NEW canvas; input is not mutated.
 */
export function applyMasks(
  binarizedCanvas: HTMLCanvasElement,
  masks: CleanMasks,
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = binarizedCanvas.width;
  out.height = binarizedCanvas.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(binarizedCanvas, 0, 0);

  // Erase regions → white
  ctx.fillStyle = '#ffffff';
  for (const r of masks.regionsToErase) {
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }

  // Window regions → black (solid wall)
  ctx.fillStyle = '#000000';
  for (const r of masks.windowsToFill) {
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }

  return out;
}

/** Convert a canvas to a PNG blob URL (for <img> previews) */
export function canvasToObjectURL(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('canvas.toBlob failed'));
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

/** Convert canvas to data URL (base64) — used to send to AI */
export function canvasToDataURL(canvas: HTMLCanvasElement, quality = 0.9): string {
  return canvas.toDataURL('image/jpeg', quality);
}
