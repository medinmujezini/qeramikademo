/**
 * FurnitureDetailsDialog - Full details popup for power users
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Ruler, MapPin, RotateCcw, DollarSign } from 'lucide-react';
import type { FurnitureItem } from '@/data/furnitureLibrary';

interface FurnitureDetailsDialogProps {
  item: FurnitureItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  living: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  bedroom: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  dining: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  office: 'bg-green-500/10 text-green-700 border-green-500/20',
  outdoor: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  storage: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
};

const formatPrice = (price?: number, currency?: string): string => {
  if (price === undefined || price === null) return 'Not set';
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
  };
  const symbol = currencySymbols[currency || 'USD'] || '$';
  return `${symbol}${(price / 100).toFixed(2)}`;
};

export const FurnitureDetailsDialog: React.FC<FurnitureDetailsDialogProps> = ({
  item,
  open,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full border"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Category */}
          <div>
            <Badge 
              variant="outline" 
              className={CATEGORY_COLORS[item.category] || 'bg-muted'}
            >
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </Badge>
          </div>
          
          {/* Price */}
          <div className="flex items-start gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Price</div>
              <div className="text-sm text-muted-foreground">
                {formatPrice(item.price, item.currency)}
              </div>
            </div>
          </div>
          
          {/* Dimensions */}
          <div className="flex items-start gap-3">
            <Ruler className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Dimensions</div>
              <div className="text-sm text-muted-foreground">
                {item.dimensions.width} × {item.dimensions.depth} × {item.dimensions.height} cm
              </div>
            </div>
          </div>
          
          {/* Position */}
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Position</div>
              <div className="text-sm text-muted-foreground">
                X: {Math.round(item.position.x)} cm, Y: {Math.round(item.position.y)} cm
              </div>
            </div>
          </div>
          
          {/* Rotation */}
          <div className="flex items-start gap-3">
            <RotateCcw className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium">Rotation</div>
              <div className="text-sm text-muted-foreground">
                {item.rotation}°
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FurnitureDetailsDialog;
