/**
 * Orthogonalization: snap nearly-axis-aligned polygon edges to true 0°/90°.
 *
 * Strategy:
 *   1. RDP-simplify the polygon (drop redundant near-collinear vertices).
 *   2. For each edge, if its angle is within ±SNAP_TOL of an axis, mark it
 *      as horizontal or vertical.
 *   3. Re-build the polygon by walking edges and forcing snapped edges to
 *      share the same x (vertical) or y (horizontal) as the previous vertex.
 *      Non-snapped edges retain their original endpoints (preserves diagonals).
 *   4. Drop edges shorter than minSegmentLengthPx by merging into neighbors.
 *   5. Close the polygon by connecting the last point back to the first if
 *      they're not already coincident.
 */
import simplify from 'simplify-js';

export interface OrthoOptions {
  snapToleranceDeg: number;
  minSegmentLengthPx: number;
  rdpEpsilonPx: number;
}

type Pt = { x: number; y: number };

/** Snap one polygon. Returns a new closed polygon (no duplicate end). */
export function orthogonalizePolygon(poly: Pt[], opt: OrthoOptions): Pt[] {
  if (poly.length < 3) return poly;

  // 1. RDP simplify (preserves first/last). simplify-js expects {x,y}.
  const simplified = simplify(poly as Array<{ x: number; y: number }>, opt.rdpEpsilonPx, true) as Pt[];
  if (simplified.length < 3) return simplified;

  // 2. Classify edges & snap
  const tolRad = (opt.snapToleranceDeg * Math.PI) / 180;
  const n = simplified.length;
  const out: Pt[] = [{ ...simplified[0] }];

  for (let i = 1; i < n; i++) {
    const prev = out[out.length - 1];
    const cur = simplified[i];
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const ang = Math.atan2(dy, dx); // -π..π

    // Distance from each axis (mod π)
    const distToHorizontal = Math.min(Math.abs(ang), Math.abs(Math.abs(ang) - Math.PI));
    const distToVertical = Math.abs(Math.abs(ang) - Math.PI / 2);

    let snapped: Pt;
    if (distToHorizontal < tolRad && distToHorizontal <= distToVertical) {
      // horizontal — keep x, lock y to previous
      snapped = { x: cur.x, y: prev.y };
    } else if (distToVertical < tolRad) {
      // vertical — keep y, lock x to previous
      snapped = { x: prev.x, y: cur.y };
    } else {
      snapped = { ...cur };
    }
    out.push(snapped);
  }

  // 3. Drop tiny segments by merging with neighbor
  const filtered: Pt[] = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const prev = filtered[filtered.length - 1];
    const dx = out[i].x - prev.x;
    const dy = out[i].y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len >= opt.minSegmentLengthPx) {
      filtered.push(out[i]);
    } else if (i === out.length - 1) {
      // keep last to allow close-up
      filtered.push(out[i]);
    }
  }

  // 4. Ensure closed (first == last conceptually; we don't duplicate)
  if (filtered.length >= 2) {
    const f = filtered[0];
    const l = filtered[filtered.length - 1];
    if (Math.hypot(f.x - l.x, f.y - l.y) < opt.minSegmentLengthPx) {
      filtered.pop();
    }
  }

  return filtered;
}

/** Convert a polygon back to an SVG path `d` string (closed). */
export function polygonToPath(poly: Pt[]): string {
  if (poly.length < 2) return '';
  const parts = [`M ${poly[0].x.toFixed(2)} ${poly[0].y.toFixed(2)}`];
  for (let i = 1; i < poly.length; i++) {
    parts.push(`L ${poly[i].x.toFixed(2)} ${poly[i].y.toFixed(2)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Bounding-box area of a polygon */
export function polygonBboxArea(poly: Pt[]): number {
  if (poly.length === 0) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return (maxX - minX) * (maxY - minY);
}
