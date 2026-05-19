/**
 * Potrace wrapper. Outline-traces a cleaned binary canvas into closed SVG paths.
 * This is NOT centerline / skeletonization — walls remain solid filled shapes.
 */

/**
 * Returns an SVG string from Potrace. We then parse out the <path d="..."/> values.
 * esm-potrace-wasm exports `potrace(blob|imageData, options) => Promise<string>`.
 */
export async function tracePotrace(
  canvas: HTMLCanvasElement,
  options: { turdsize: number },
): Promise<string[]> {
  // Lazy import — keeps WASM out of the initial bundle.
  const mod: any = await import('esm-potrace-wasm');
  const potrace = mod.potrace ?? mod.default ?? mod;

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
  });

  const svg: string = await potrace(blob, {
    turdsize: options.turdsize,
    alphamax: 0.6,
    opticurve: false,
    opttolerance: 0.2,
    pathonly: false,
    extractcolors: false,
  });

  return extractPathsFromSvg(svg);
}

/** Extract `d` attributes from a Potrace SVG string */
function extractPathsFromSvg(svg: string): string[] {
  const out: string[] = [];
  const re = /<path[^>]*\sd="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Convert an SVG path `d` string into one or more polygons (arrays of points).
 * Since we set `opticurve:false`, Potrace emits only M/L/Z commands (plus C in
 * some edge cases — we sample those as straight segments).
 *
 * A single `d` can contain multiple subpaths (e.g., outer + hole). Each subpath
 * becomes one polygon.
 */
export function pathToPolygons(d: string): Array<Array<{ x: number; y: number }>> {
  const polygons: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  // Tokenize: command letters and numbers
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';

  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    }
    switch (cmd) {
      case 'M': {
        const x = num(); const y = num();
        if (current.length > 1) polygons.push(current);
        current = [{ x, y }];
        cx = startX = x; cy = startY = y;
        cmd = 'L';
        break;
      }
      case 'm': {
        const x = cx + num(); const y = cy + num();
        if (current.length > 1) polygons.push(current);
        current = [{ x, y }];
        cx = startX = x; cy = startY = y;
        cmd = 'l';
        break;
      }
      case 'L': { const x = num(); const y = num(); current.push({ x, y }); cx = x; cy = y; break; }
      case 'l': { const x = cx + num(); const y = cy + num(); current.push({ x, y }); cx = x; cy = y; break; }
      case 'H': { const x = num(); current.push({ x, y: cy }); cx = x; break; }
      case 'h': { const x = cx + num(); current.push({ x, y: cy }); cx = x; break; }
      case 'V': { const y = num(); current.push({ x: cx, y }); cy = y; break; }
      case 'v': { const y = cy + num(); current.push({ x: cx, y }); cy = y; break; }
      case 'C': {
        // Cubic — sample endpoint only (we asked Potrace to disable curves but
        // be safe). Skip control points.
        num(); num(); num(); num();
        const x = num(); const y = num();
        current.push({ x, y }); cx = x; cy = y;
        break;
      }
      case 'c': {
        num(); num(); num(); num();
        const x = cx + num(); const y = cy + num();
        current.push({ x, y }); cx = x; cy = y;
        break;
      }
      case 'Z':
      case 'z': {
        if (current.length > 1) polygons.push(current);
        current = [];
        cx = startX; cy = startY;
        break;
      }
      default:
        // unknown — skip one number to avoid infinite loop
        i++;
        break;
    }
  }
  if (current.length > 1) polygons.push(current);
  return polygons;
}
