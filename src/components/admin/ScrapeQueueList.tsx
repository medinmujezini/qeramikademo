import { useState } from 'react';
import { ExternalLink, Check, X, Trash2, Eye, Loader2, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ScrapeQueueItem, furnitureScraperApi } from '@/lib/api/furnitureScraper';

interface ScrapeQueueListProps {
  items: ScrapeQueueItem[];
  onRefresh: () => void;
  onReview: (item: ScrapeQueueItem) => void;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'outline', icon: <Clock className="w-3 h-3" /> },
  processing: { label: 'Processing', variant: 'secondary', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: 'Ready', variant: 'default', icon: <Eye className="w-3 h-3" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: <AlertCircle className="w-3 h-3" /> },
  approved: { label: 'Approved', variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
  rejected: { label: 'Rejected', variant: 'destructive', icon: <X className="w-3 h-3" /> },
};

export function ScrapeQueueList({ items, onRefresh, onReview }: ScrapeQueueListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    
    const result = await furnitureScraperApi.delete(deletingId);
    if (result.success) {
      toast.success('Item deleted');
      onRefresh();
    } else {
      toast.error(result.error || 'Failed to delete');
    }
    setDeletingId(null);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No items in queue</p>
        <p className="text-sm mt-1">Scrape a product URL to get started</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {items.map((item) => {
            const status = statusConfig[item.status] || statusConfig.pending;
            const firstImage = item.extracted_images?.[0];
            const dimensions = item.extracted_dimensions;

            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={item.extracted_name || 'Product'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Eye className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium truncate">
                            {item.extracted_name || 'Processing...'}
                          </h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {item.extracted_brand && `${item.extracted_brand} • `}
                            {item.extracted_category || 'Unknown category'}
                          </p>
                        </div>
                        <Badge variant={status.variant} className="flex-shrink-0 gap-1">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {dimensions && (
                          <span>
                            {dimensions.width}×{dimensions.depth}×{dimensions.height} cm
                          </span>
                        )}
                        {item.extracted_price && (
                          <span className="font-medium text-foreground">
                            {item.extracted_currency || '$'}{item.extracted_price}
                          </span>
                        )}
                      </div>

                      {item.error_message && (
                        <p className="text-sm text-destructive mt-2 truncate">
                          {item.error_message}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          asChild
                        >
                          <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Source
                          </a>
                        </Button>

                        {item.status === 'completed' && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => onReview(item)}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Review
                          </Button>
                        )}

                        {item.status === 'approved' && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Added to catalog
                          </span>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                          onClick={() => setDeletingId(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scrape item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this scraped item from the queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
