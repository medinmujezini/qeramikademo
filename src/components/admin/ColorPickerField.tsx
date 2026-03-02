import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorPickerFieldProps {
  value: string;
  onChange: (color: string) => void;
}

const presetColors = [
  '#8B4513', // Saddle Brown
  '#A0522D', // Sienna
  '#D2691E', // Chocolate
  '#F4A460', // Sandy Brown
  '#DEB887', // Burlywood
  '#D2B48C', // Tan
  '#BC8F8F', // Rosy Brown
  '#CD853F', // Peru
  '#2F4F4F', // Dark Slate Gray
  '#696969', // Dim Gray
  '#808080', // Gray
  '#A9A9A9', // Dark Gray
  '#C0C0C0', // Silver
  '#D3D3D3', // Light Gray
  '#FFFFFF', // White
  '#000000', // Black
  '#191970', // Midnight Blue
  '#483D8B', // Dark Slate Blue
  '#4169E1', // Royal Blue
  '#6495ED', // Cornflower Blue
  '#228B22', // Forest Green
  '#32CD32', // Lime Green
  '#8B0000', // Dark Red
  '#DC143C', // Crimson
];

const ColorPickerField = ({ value, onChange }: ColorPickerFieldProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-10 h-10 p-0 border-2"
            style={{ backgroundColor: value }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="grid grid-cols-6 gap-2 mb-3">
            {presetColors.map((color) => (
              <button
                key={color}
                className="w-8 h-8 rounded border-2 border-transparent hover:border-primary transition-colors"
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-10 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="flex-1 uppercase"
            />
          </div>
        </PopoverContent>
      </Popover>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1 uppercase font-mono"
      />
    </div>
  );
};

export default ColorPickerField;
