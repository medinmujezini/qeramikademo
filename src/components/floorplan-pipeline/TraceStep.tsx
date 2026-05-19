import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { tracePotrace, pathToPolygons } from '@/lib/floorplan-pipeline/potrace';
import { orthogonalizePolygon, polygonToPath, polygonBboxArea } from '@/lib/floorplan-pipeline/orthogonalize';
import type { TracedPath } from '@/lib/floorplan-pipeline/types';
import { DEFAULT_TRACE_OPTIONS } from '@/lib/floorplan-pipeline/types';

interface Props {
  cleanedCanvas: HTMLCanvasElement;
  onComplete: (paths: TracedPath[]) => void;
  onBack: () => void;
}

export const TraceStep: React.FC<Props> = ({ cleanedCanvas, onComplete, onBack }) => {
  const [turdsize, setTurdsize] = useState(DEFAULT_TRACE_OPTIONS.turdsize);
  const [snapTol, setSnapTol] = useState(DEFAULT_TRACE_OPTIONS.snapToleranceDeg);
  const [minSeg, setMinSeg] = useState(DEFAULT_TRACE_OPTIONS.minSegmentLengthPx);
  const [tracing, setTracing] = useState(false);
  const [paths, setPaths] = useState<TracedPath[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runTrace = useCallback(async () => {
    setTracing(true);
    setError(null);
    try {
      const rawPaths = await tracePotrace(cleanedCanvas, { turdsize });
      const out: TracedPath[] = [];
      for (const d of rawPaths) {
        const polys = pathToPolygons(d);
        for (const poly of polys) {
          const ortho = orthogonalizePolygon(poly, {
            snapToleranceDeg: snapTol,
            minSegmentLengthPx: minSeg,
            rdpEpsilonPx: DEFAULT_TRACE_OPTIONS.rdpEpsilonPx,
          });
          if (ortho.length < 3) continue;
          const bboxArea = polygonBboxArea(ortho);
          if (bboxArea < 25) continue;
          out.push({
            id: uuidv4(),
            d: polygonToPath(ortho),
            points: ortho,
            bboxArea,
            enabled: true,
          });
        }
      }
      out.sort((a, b) => b.bboxArea - a.bboxArea);
      setPaths(out);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setTracing(false);
    }
  }, [cleanedCanvas, turdsize, snapTol, minSeg]);

  useEffect(() => { runTrace(); /* eslint-disable-line */ }, [cleanedCanvas]);

  const togglePath = (id: string) => {
    setPaths((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  };

  const svgViewBox = `0 0 ${cleanedCanvas.width} ${cleanedCanvas.height}`;
  const enabledCount = paths.filter((p) => p.enabled).length;

  // Background data URL of the cleaned canvas for context behind the SVG
  const bgUrl = useMemo(() => cleanedCanvas.toDataURL('image/png'), [cleanedCanvas]);

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
      <div className="text-sm text-muted-foreground">
        Outline-traced and orthogonalized. Adjust thresholds, or toggle individual paths to reject false positives.
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs">turdsize ({turdsize})</Label>
          <Slider min={0} max={100} step={1} value={[turdsize]} onValueChange={(v) => setTurdsize(v[0])} />
        </div>
        <div>
          <Label className="text-xs">snap tolerance ({snapTol}°)</Label>
          <Slider min={0} max={30} step={1} value={[snapTol]} onValueChange={(v) => setSnapTol(v[0])} />
        </div>
        <div>
          <Label className="text-xs">min segment ({minSeg}px)</Label>
          <Slider min={1} max={20} step={1} value={[minSeg]} onValueChange={(v) => setMinSeg(v[0])} />
        </div>
      </div>

      <div className="flex gap-3 min-h-0 flex-1">
        <div className="flex-1 bg-muted/30 rounded-lg overflow-hidden relative flex items-center justify-center">
          {tracing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${cleanedCanvas.width} / ${cleanedCanvas.height}` }}>
            <img src={bgUrl} className="block max-w-full max-h-full opacity-30" alt="" />
            <svg
              viewBox={svgViewBox}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 w-full h-full"
            >
              {paths.map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill={p.enabled ? 'hsl(38 90% 60% / 0.45)' : 'transparent'}
                  stroke={p.enabled ? 'hsl(38 90% 60%)' : 'hsl(0 0% 50%)'}
                  strokeWidth={Math.max(1, cleanedCanvas.width / 600)}
                  strokeDasharray={p.enabled ? '' : '4 4'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
        </div>

        <div className="w-56 border rounded-lg overflow-y-auto">
          <div className="p-2 text-xs text-muted-foreground sticky top-0 bg-background border-b">
            {enabledCount} / {paths.length} enabled
          </div>
          <ul className="p-2 space-y-1">
            {paths.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 text-xs">
                <Checkbox checked={p.enabled} onCheckedChange={() => togglePath(p.id)} />
                <span className="font-mono">#{i + 1}</span>
                <span className="text-muted-foreground ml-auto">{Math.round(p.bboxArea)}</span>
              </li>
            ))}
            {paths.length === 0 && !tracing && (
              <li className="text-xs text-muted-foreground text-center py-4">No paths detected</li>
            )}
          </ul>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={() => onComplete(paths)} disabled={tracing || enabledCount === 0}>
          Continue
        </Button>
      </div>
    </div>
  );
};
