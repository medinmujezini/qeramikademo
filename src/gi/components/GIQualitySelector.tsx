import React from 'react';
import { GIQualityTier } from '../GIConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';

interface GIQualitySelectorProps {
  value: GIQualityTier;
  onChange: (tier: GIQualityTier) => void;
  disabled?: boolean;
}

export const GIQualitySelector: React.FC<GIQualitySelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="gi-quality" className="flex items-center gap-1.5 text-sm whitespace-nowrap">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        GI Quality
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as GIQualityTier)} disabled={disabled}>
        <SelectTrigger id="gi-quality" className="w-24 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default GIQualitySelector;
