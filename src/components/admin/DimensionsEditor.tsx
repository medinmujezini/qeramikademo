import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DimensionsEditorProps {
  width: number;
  depth: number;
  height: number;
  onChange: (dims: { width: number; depth: number; height: number }) => void;
  labels?: { width?: string; depth?: string; height?: string };
}

const DimensionsEditor = ({ 
  width, 
  depth, 
  height, 
  onChange,
  labels = { width: 'Width', depth: 'Depth', height: 'Height' }
}: DimensionsEditorProps) => {
  return (
    <div className="flex items-center gap-4">
      {/* Visual Preview */}
      <div className="w-24 h-24 relative flex items-center justify-center">
        <div 
          className="border-2 border-primary/50 bg-primary/10 rounded"
          style={{
            width: `${Math.min(80, Math.max(20, width / 3))}px`,
            height: `${Math.min(60, Math.max(15, depth / 3))}px`,
          }}
        />
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
        >
          {width}×{depth}
        </div>
      </div>

      {/* Input Fields */}
      <div className="flex-1 grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{labels.width} (W)</Label>
          <Input
            type="number"
            value={width}
            onChange={(e) => onChange({ width: parseInt(e.target.value) || 0, depth, height })}
            min={1}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{labels.depth} (D)</Label>
          <Input
            type="number"
            value={depth}
            onChange={(e) => onChange({ width, depth: parseInt(e.target.value) || 0, height })}
            min={1}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{labels.height} (H)</Label>
          <Input
            type="number"
            value={height}
            onChange={(e) => onChange({ width, depth, height: parseInt(e.target.value) || 0 })}
            min={1}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
};

export default DimensionsEditor;
