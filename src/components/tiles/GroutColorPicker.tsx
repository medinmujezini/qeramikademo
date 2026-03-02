/**
 * Grout Color Picker
 * 
 * A compact component for selecting grout colors from the database.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Paintbrush, Check } from 'lucide-react';
import { useGroutColors } from '@/hooks/useTemplatesFromDB';
import { cn } from '@/lib/utils';

// Fallback grout colors if none in database
const FALLBACK_GROUT_COLORS = [
  { id: 'white', name: 'White', hexColor: '#FFFFFF' },
  { id: 'light-gray', name: 'Light Gray', hexColor: '#d1d5db' },
  { id: 'medium-gray', name: 'Medium Gray', hexColor: '#9ca3af' },
  { id: 'dark-gray', name: 'Dark Gray', hexColor: '#4b5563' },
  { id: 'charcoal', name: 'Charcoal', hexColor: '#374151' },
  { id: 'black', name: 'Black', hexColor: '#1f2937' },
  { id: 'beige', name: 'Beige', hexColor: '#d4c4a8' },
  { id: 'brown', name: 'Brown', hexColor: '#8b7355' },
];

interface GroutColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  compact?: boolean;
}

export const GroutColorPicker: React.FC<GroutColorPickerProps> = ({
  value,
  onChange,
  label = 'Grout Color',
  compact = false,
}) => {
  const { data: groutColors, isLoading } = useGroutColors();
  
  // Use DB colors or fallback
  const colors = groutColors && groutColors.length > 0 ? groutColors : FALLBACK_GROUT_COLORS;
  
  const selectedColor = colors.find(c => c.hexColor === value);

  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      {label && (
        <Label className={cn("text-xs", compact && "text-[10px]")}>{label}</Label>
      )}
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className={cn(
              "w-full justify-start gap-2",
              compact && "h-7 text-xs"
            )}
          >
            <div 
              className={cn(
                "rounded border",
                compact ? "w-4 h-4" : "w-5 h-5"
              )}
              style={{ backgroundColor: value }}
            />
            <span className="truncate">
              {selectedColor?.name || 'Custom'}
            </span>
            <Paintbrush className={cn("ml-auto", compact ? "h-3 w-3" : "h-4 w-4")} />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-48 p-2" align="start">
          {isLoading ? (
            <div className="space-y-1">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {colors.map(color => (
                <button
                  key={color.id}
                  onClick={() => onChange(color.hexColor)}
                  className={cn(
                    "w-8 h-8 rounded border-2 transition-all hover:scale-110",
                    value === color.hexColor 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color.hexColor }}
                  title={color.name}
                >
                  {value === color.hexColor && (
                    <Check className={cn(
                      "h-4 w-4 mx-auto",
                      // Ensure check is visible on both light and dark backgrounds
                      color.hexColor.toLowerCase() === '#ffffff' || 
                      color.hexColor.toLowerCase() === '#fff' ||
                      parseInt(color.hexColor.slice(1), 16) > 0xaaaaaa
                        ? "text-gray-800"
                        : "text-white"
                    )} />
                  )}
                </button>
              ))}
            </div>
          )}
          
          {/* Custom color input */}
          <div className="mt-2 pt-2 border-t">
            <Label className="text-[10px] text-muted-foreground">Custom</Label>
            <div className="flex gap-1 mt-1">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 text-xs px-2 border rounded"
                placeholder="#RRGGBB"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default GroutColorPicker;
