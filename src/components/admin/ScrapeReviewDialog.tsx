import { useState, useEffect } from 'react';
import { Check, X, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ScrapeQueueItem, furnitureScraperApi } from '@/lib/api/furnitureScraper';

interface ScrapeReviewDialogProps {
  item: ScrapeQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const categories = [
  { value: 'living', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'dining', label: 'Dining' },
  { value: 'office', label: 'Office' },
  { value: 'storage', label: 'Storage' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'outdoor', label: 'Outdoor' },
];

export function ScrapeReviewDialog({ item, open, onOpenChange, onComplete }: ScrapeReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [color, setColor] = useState('#8B4513');

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setName(item.extracted_name || '');
      setCategory(item.extracted_category || 'living');
      setWidth(String(item.extracted_dimensions?.width || 100));
      setDepth(String(item.extracted_dimensions?.depth || 100));
      setHeight(String(item.extracted_dimensions?.height || 100));
      setPrice(item.extracted_price ? String(item.extracted_price) : '');
      setCurrency(item.extracted_currency || 'USD');
      setColor('#8B4513');
      setCurrentImageIndex(0);
    }
  }, [item]);

  const images = item?.extracted_images || [];

  const handleApprove = async () => {
    if (!item) return;
    
    setLoading(true);
    
    const result = await furnitureScraperApi.approve(item.id, {
      name,
      category,
      dimensions: {
        width: parseFloat(width) || 100,
        depth: parseFloat(depth) || 100,
        height: parseFloat(height) || 100,
      },
      price: price ? parseFloat(price) : undefined,
      currency,
      color,
    });

    setLoading(false);

    if (result.success) {
      toast.success('Furniture added to catalog!');
      onOpenChange(false);
      onComplete();
    } else {
      toast.error(result.error || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    if (!item) return;
    
    setLoading(true);
    const result = await furnitureScraperApi.reject(item.id);
    setLoading(false);

    if (result.success) {
      toast.success('Item rejected');
      onOpenChange(false);
      onComplete();
    } else {
      toast.error(result.error || 'Failed to reject');
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Scraped Furniture</DialogTitle>
          <DialogDescription>
            Review and edit the extracted data before adding to your catalog.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-6">
            {/* Image Carousel */}
            {images.length > 0 && (
              <div className="relative">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={images[currentImageIndex]}
                    alt={`Product image ${currentImageIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                {images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={nextImage}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Source URL */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Source:</span>
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                {new URL(item.source_url).hostname}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="color">Default Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-9 p-1"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#8B4513"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="width">Width (cm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="depth">Depth (cm)</Label>
                <Input
                  id="depth"
                  type="number"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="price">Price</Label>
                <div className="flex gap-2">
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    id="price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            {item.extracted_description && (
              <div>
                <Label>Extracted Description</Label>
                <Textarea
                  value={item.extracted_description}
                  readOnly
                  className="mt-1 text-sm text-muted-foreground"
                  rows={3}
                />
              </div>
            )}

            {/* AI Confidence */}
            {item.ai_confidence && (
              <div className="text-sm text-muted-foreground">
                AI Confidence: {Math.round(item.ai_confidence * 100)}%
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="destructive" onClick={handleReject} disabled={loading}>
            <X className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button onClick={handleApprove} disabled={loading}>
            {loading ? (
              <>Processing...</>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Approve & Add to Catalog
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
