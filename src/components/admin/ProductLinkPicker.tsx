import { useState, useMemo } from 'react';
import { Check, Package, ExternalLink, Loader2, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProductLink, BulkScrapeResult } from '@/lib/api/furnitureScraper';
import { cn } from '@/lib/utils';

interface ProductLinkPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryUrl: string;
  categoryTitle: string;
  productLinks: ProductLink[];
  onScrapeSelected: (urls: string[]) => Promise<void>;
  isScraping: boolean;
  scrapeProgress: { current: number; total: number };
  scrapeResults: BulkScrapeResult[];
}

export function ProductLinkPicker({
  open,
  onOpenChange,
  categoryUrl,
  categoryTitle,
  productLinks,
  onScrapeSelected,
  isScraping,
  scrapeProgress,
  scrapeResults,
}: ProductLinkPickerProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const toggleUrl = (url: string) => {
    const newSet = new Set(selectedUrls);
    if (newSet.has(url)) {
      newSet.delete(url);
    } else {
      newSet.add(url);
    }
    setSelectedUrls(newSet);
  };

  const selectAll = () => {
    setSelectedUrls(new Set(productLinks.map(p => p.url)));
  };

  const deselectAll = () => {
    setSelectedUrls(new Set());
  };

  const handleScrape = async () => {
    if (selectedUrls.size === 0) return;
    await onScrapeSelected(Array.from(selectedUrls));
  };

  const handleClose = () => {
    if (!isScraping) {
      setSelectedUrls(new Set());
      onOpenChange(false);
    }
  };

  // Get result status for a URL
  const getResultForUrl = (url: string): BulkScrapeResult | undefined => {
    return scrapeResults.find(r => r.url === url);
  };

  const progressPercent = scrapeProgress.total > 0 
    ? (scrapeProgress.current / scrapeProgress.total) * 100 
    : 0;

  const successCount = scrapeResults.filter(r => r.success).length;
  const failCount = scrapeResults.filter(r => !r.success).length;

  const isComplete = isScraping && scrapeProgress.current === scrapeProgress.total && scrapeProgress.total > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Category Page Detected
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span>Found {productLinks.length} products on this page</span>
            <a 
              href={categoryUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-1"
            >
              {categoryTitle}
              <ExternalLink className="w-3 h-3" />
            </a>
          </DialogDescription>
        </DialogHeader>

        {/* Bulk Scrape Progress */}
        {isScraping && (
          <div className="space-y-3 py-3 border-y border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Scraping {scrapeProgress.current} of {scrapeProgress.total} products...
              </span>
              <span className="text-muted-foreground">
                {successCount > 0 && <span className="text-green-600">{successCount} ✓</span>}
                {failCount > 0 && <span className="text-destructive ml-2">{failCount} ✗</span>}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Completion Summary */}
        {isComplete && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Scraping Complete
            </h4>
            <p className="text-sm text-muted-foreground">
              Successfully scraped {successCount} products
              {failCount > 0 && `, ${failCount} failed`}
            </p>
            <Button onClick={handleClose} size="sm" className="mt-2">
              Close & View Queue
            </Button>
          </div>
        )}

        {/* Selection Controls */}
        {!isScraping && (
          <div className="flex items-center justify-between py-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedUrls.size} selected
            </span>
          </div>
        )}

        {/* Product Grid */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pb-4">
            {productLinks.map((product) => {
              const isSelected = selectedUrls.has(product.url);
              const result = getResultForUrl(product.url);
              const isProcessed = !!result;
              
              return (
                <div
                  key={product.url}
                  onClick={() => !isScraping && toggleUrl(product.url)}
                  className={cn(
                    'relative rounded-lg border p-3 cursor-pointer transition-all',
                    isSelected && !isScraping && 'ring-2 ring-primary border-primary',
                    !isSelected && !isScraping && 'border-border hover:border-primary/50',
                    isScraping && 'cursor-default',
                    isProcessed && result.success && 'border-green-500 bg-green-500/5',
                    isProcessed && !result.success && 'border-destructive bg-destructive/5',
                  )}
                >
                  {/* Checkbox / Status Icon */}
                  <div className="absolute top-2 right-2 z-10">
                    {!isScraping && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUrl(product.url)}
                        className="data-[state=checked]:bg-primary"
                      />
                    )}
                    {isProcessed && result.success && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {isProcessed && !result.success && (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="aspect-square rounded-md bg-muted mb-2 flex items-center justify-center overflow-hidden">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title || 'Product'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Title & Price */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium line-clamp-2 leading-tight min-h-[2rem]">
                      {product.title || 'Unknown Product'}
                    </p>
                    {product.price && (
                      <p className="text-xs text-primary font-medium">
                        {product.price}
                      </p>
                    )}
                  </div>

                  {/* Error message */}
                  {isProcessed && !result.success && (
                    <p className="text-xs text-destructive mt-1 line-clamp-1">
                      {result.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        {!isComplete && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClose} disabled={isScraping}>
              Cancel
            </Button>
            <Button
              onClick={handleScrape}
              disabled={selectedUrls.size === 0 || isScraping}
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Scrape {selectedUrls.size} Products
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
