/**
 * Floorplan → Geometry pipeline contracts.
 * AI is a raster preprocessor only. Geometry stages are deterministic.
 */

export interface Calibration {
  /** Two image-space points the user clicked */
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  /** Real-world distance between A and B, in METERS */
  realMeters: number;
  /** Derived */
  pixelsPerMeter: number;
}

/** Region returned by the AI to be erased (filled white in cleaned raster) */
export interface EraseRegion {
  x: number; y: number; width: number; height: number;
  kind: 'text' | 'door' | 'furniture' | 'fixture' | 'other';
}

/** Region returned by the AI for windows — filled BLACK (becomes solid wall) */
export interface FillRegion {
  x: number; y: number; width: number; height: number;
}

export interface CleanMasks {
  regionsToErase: EraseRegion[];
  windowsToFill: FillRegion[];
}

/** Trace stage output: orthogonalized closed SVG path */
export interface TracedPath {
  id: string;
  /** Closed SVG path data string (M ... Z) */
  d: string;
  /** Polygon points in image-pixel space (closed, but no duplicate end) */
  points: Array<{ x: number; y: number }>;
  /** Bounding box area for sorting / filtering */
  bboxArea: number;
  /** User toggle to include this path in extrusion */
  enabled: boolean;
}

export interface TraceOptions {
  /** Potrace turdsize — drop blobs smaller than this many px */
  turdsize: number;
  /** Snap any segment within this many degrees of an axis to that axis */
  snapToleranceDeg: number;
  /** Absorb segments shorter than this into neighbors */
  minSegmentLengthPx: number;
  /** RDP simplification epsilon */
  rdpEpsilonPx: number;
}

export const DEFAULT_TRACE_OPTIONS: TraceOptions = {
  turdsize: 20,
  snapToleranceDeg: 12,
  minSegmentLengthPx: 4,
  rdpEpsilonPx: 1.5,
};
