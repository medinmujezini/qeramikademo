import { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCw, AlertCircle, Sparkles, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScrapeQueueList } from '@/components/admin/ScrapeQueueList';
import { ScrapeReviewDialog } from '@/components/admin/ScrapeReviewDialog';
import { ProductLinkPicker } from '@/components/admin/ProductLinkPicker';
import { SiteProfileManager } from '@/components/admin/SiteProfileManager';
import { 
  furnitureScraperApi, 
  ScrapeQueueItem, 
  ScrapeResult, 
  CategoryResult,
  BulkScrapeResult 
} from '@/lib/api/furnitureScraper';
import { siteProfilesApi, SiteProfile } from '@/lib/api/siteProfiles';

export default function FurnitureScraper() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [queue, setQueue] = useState<ScrapeQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ScrapeQueueItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Category picker state
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryResult, setCategoryResult] = useState<CategoryResult | null>(null);
  const [bulkScraping, setBulkScraping] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<BulkScrapeResult[]>([]);

  // Site profile state
  const [siteProfile, setSiteProfile] = useState<SiteProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const fetchQueue = async () => {
    setQueueLoading(true);
    const result = await furnitureScraperApi.getQueue();
    if (result.data) {
      setQueue(result.data);
    }
    setQueueLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Check for site profile when URL changes
  useEffect(() => {
    const checkProfile = async () => {
      if (!url.trim()) {
        setSiteProfile(null);
        return;
      }
      
      const domain = siteProfilesApi.getDomainFromUrl(url);
      if (!domain) {
        setSiteProfile(null);
        return;
      }

      setCheckingProfile(true);
      const profile = await siteProfilesApi.getByDomain(domain);
      setSiteProfile(profile);
      setCheckingProfile(false);
    };

    const debounce = setTimeout(checkProfile, 300);
    return () => clearTimeout(debounce);
  }, [url]);

  const handleScrape = async () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setLoading(true);
    setScrapeResult(null);
    setCategoryResult(null);

    try {
      const result = await furnitureScraperApi.scrape(url.trim());
      
      // Check if it's a category page
      if (result.success && 'type' in result && result.type === 'category') {
        const catResult = result as CategoryResult;
        setCategoryResult(catResult);
        setCategoryPickerOpen(true);
        setBulkProgress({ current: 0, total: 0 });
        setBulkResults([]);
        toast.info(`Found ${catResult.total_found} products on category page`);
        setUrl('');
      } else if (result.success && 'data' in result && result.data) {
        // Single product
        setScrapeResult(result as ScrapeResult);
        const saveResult = await furnitureScraperApi.saveToQueue(result.data);
        if (saveResult.success) {
          const method = (result as any).extraction_method || 'ai';
          toast.success(`Product scraped successfully! (${method})`);
          fetchQueue();
          setUrl('');
        } else {
          toast.error(saveResult.error || 'Failed to save to queue');
        }
      } else {
        const failedResult = result as ScrapeResult;
        setScrapeResult(failedResult);
        toast.error(failedResult.error || 'Failed to scrape product');
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast.error('An error occurred while scraping');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkScrape = async (urls: string[]) => {
    setBulkScraping(true);
    setBulkProgress({ current: 0, total: urls.length });
    setBulkResults([]);

    await furnitureScraperApi.scrapeBulk(urls, (current, total, result) => {
      setBulkProgress({ current, total });
      setBulkResults(prev => [...prev, result]);
    });

    setBulkScraping(false);
    fetchQueue();
    
    const successCount = bulkResults.filter(r => r.success).length + 
      (bulkResults.length === 0 ? urls.length : 0);
    toast.success(`Completed! ${successCount} products scraped`);
  };

  const handleReview = (item: ScrapeQueueItem) => {
    setSelectedItem(item);
    setReviewOpen(true);
  };

  const handleReviewComplete = () => {
    fetchQueue();
    setSelectedItem(null);
  };

  const handleCategoryPickerClose = (open: boolean) => {
    if (!bulkScraping) {
      setCategoryPickerOpen(open);
      if (!open) {
        setCategoryResult(null);
        setBulkResults([]);
        setBulkProgress({ current: 0, total: 0 });
      }
    }
  };

  const pendingCount = queue.filter(i => i.status === 'completed').length;
  const approvedCount = queue.filter(i => i.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Furniture Scraper</h1>
        <p className="text-muted-foreground mt-1">
          Extract furniture data from e-commerce product pages
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="scrape">
        <TabsList>
          <TabsTrigger value="scrape">Scrape Products</TabsTrigger>
          <TabsTrigger value="sites" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Site Profiles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scrape" className="space-y-6 mt-6">
          {/* Scrape Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Scrape Product
              </CardTitle>
              <CardDescription>
                Paste a product URL or category page URL — we'll detect which type it is
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="https://example-store.com/product/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                    disabled={loading}
                  />
                  
                  {/* Site profile indicator */}
                  {url.trim() && (
                    <div className="flex items-center gap-2 text-sm">
                      {checkingProfile ? (
                        <span className="text-muted-foreground">Checking site profile...</span>
                      ) : siteProfile ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="gap-1">
                            {siteProfile.has_json_ld ? '✓ JSON-LD' : siteProfile.has_open_graph ? '✓ OpenGraph' : '○ AI'}
                          </Badge>
                          <span className="text-muted-foreground">
                            Profile: {siteProfile.site_name || siteProfile.domain}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          New site — will analyze structure first
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Button onClick={handleScrape} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Scrape
                    </>
                  )}
                </Button>
              </div>

              {/* Error display */}
              {scrapeResult && !scrapeResult.success && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {scrapeResult.error || 'Failed to scrape the page.'}
                    {scrapeResult.hint && (
                      <span className="block text-xs mt-1 opacity-75">{scrapeResult.hint}</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Success preview */}
              {scrapeResult?.success && scrapeResult.data && (
                <Card className="mt-4 bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex gap-4">
                      {scrapeResult.data.extracted_images?.[0] && (
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-background">
                          <img
                            src={scrapeResult.data.extracted_images[0]}
                            alt="Product"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium">{scrapeResult.data.extracted_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {scrapeResult.data.extracted_brand && `${scrapeResult.data.extracted_brand} • `}
                          {scrapeResult.data.extracted_category}
                        </p>
                        <p className="text-sm mt-1">
                          {scrapeResult.data.extracted_dimensions.width !== null ? (
                            <>
                              {scrapeResult.data.extracted_dimensions.width} × 
                              {scrapeResult.data.extracted_dimensions.depth} × 
                              {scrapeResult.data.extracted_dimensions.height} cm
                            </>
                          ) : (
                            <span className="text-muted-foreground">Dimensions not found</span>
                          )}
                          {scrapeResult.data.extracted_price && (
                            <span className="ml-2 font-medium">
                              {scrapeResult.data.extracted_currency || '€'}{scrapeResult.data.extracted_price}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      ✓ Added to queue — review below to approve
                    </p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Queue */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Scrape Queue</CardTitle>
                <CardDescription>
                  {pendingCount} ready for review • {approvedCount} approved
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchQueue} disabled={queueLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${queueLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pending">
                <TabsList>
                  <TabsTrigger value="pending">Ready to Review ({pendingCount})</TabsTrigger>
                  <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
                  <TabsTrigger value="all">All ({queue.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-4">
                  <ScrapeQueueList
                    items={queue.filter(i => i.status === 'completed')}
                    onRefresh={fetchQueue}
                    onReview={handleReview}
                  />
                </TabsContent>
                <TabsContent value="approved" className="mt-4">
                  <ScrapeQueueList
                    items={queue.filter(i => i.status === 'approved')}
                    onRefresh={fetchQueue}
                    onReview={handleReview}
                  />
                </TabsContent>
                <TabsContent value="all" className="mt-4">
                  <ScrapeQueueList
                    items={queue}
                    onRefresh={fetchQueue}
                    onReview={handleReview}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="mt-6">
          <SiteProfileManager />
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <ScrapeReviewDialog
        item={selectedItem}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onComplete={handleReviewComplete}
      />

      {/* Category Product Picker */}
      {categoryResult && (
        <ProductLinkPicker
          open={categoryPickerOpen}
          onOpenChange={handleCategoryPickerClose}
          categoryUrl={categoryResult.category_url}
          categoryTitle={categoryResult.category_title}
          productLinks={categoryResult.product_links}
          onScrapeSelected={handleBulkScrape}
          isScraping={bulkScraping}
          scrapeProgress={bulkProgress}
          scrapeResults={bulkResults}
        />
      )}
    </div>
  );
}
