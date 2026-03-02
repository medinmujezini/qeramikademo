/**
 * FurnitureColorPopup - Small color picker that appears below the toolbar
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FurnitureColorPopupProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

// Preset colors for furniture
const PRESET_COLORS = [
  // Neutrals
  '#ffffff', '#f5f5f4', '#d6d3d1', '#a8a29e',
  '#78716c', '#57534e', '#44403c', '#1c1917',
  // Warm colors
  '#fef3c7', '#fde68a', '#fbbf24', '#f59e0b',
  '#fed7aa', '#fdba74', '#fb923c', '#ea580c',
  // Cool colors
  '#dbeafe', '#bfdbfe', '#60a5fa', '#2563eb',
  '#d1fae5', '#a7f3d0', '#34d399', '#059669',
  // Accent colors
  '#fce7f3', '#f9a8d4', '#ec4899', '#be185d',
  '#ede9fe', '#c4b5fd', '#8b5cf6', '#6d28d9',
];

export const FurnitureColorPopup: React.FC<FurnitureColorPopupProps> = ({
  currentColor,
  onColorChange,
  onClose,
}) => {
  return (
    <div 
      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 animate-scale-in"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-2">
        <div className="grid grid-cols-8 gap-1">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              className={cn(
                "w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 flex items-center justify-center",
                currentColor.toLowerCase() === color.toLowerCase()
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-transparent hover:border-muted-foreground/30"
              )}
              style={{ backgroundColor: color }}
              onClick={() => onColorChange(color)}
            >
              {currentColor.toLowerCase() === color.toLowerCase() && (
                <Check 
                  className="h-3 w-3" 
                  style={{ 
                    color: isLightColor(color) ? '#000' : '#fff' 
                  }} 
                />
              )}
            </button>
          ))}
        </div>
        
        {/* Custom color input */}
        <div className="mt-2 pt-2 border-t flex items-center gap-2">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 p-0"
          />
          <span className="text-xs text-muted-foreground">Custom color</span>
        </div>
      </div>
    </div>
  );
};

// Helper to determine if a color is light (for contrast)
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export default FurnitureColorPopup;
