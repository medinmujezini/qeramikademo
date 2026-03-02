import { supabase } from '@/integrations/supabase/client';

export interface ScrapeResult {
  success: boolean;
  type?: 'product' | 'category';
  error?: string;
  hint?: string;
  data?: {
    source_url: string;
    extracted_name: string;
    extracted_brand?: string;
    extracted_category: string;
    extracted_dimensions: {
      width: number;
      depth: number;
      height: number;
    };
    extracted_price?: number;
    extracted_currency?: string;
    extracted_description?: string;
    extracted_images: string[];
    raw_markdown?: string;
    ai_confidence?: number;
  };
}

export interface CategoryResult {
  success: boolean;
  type: 'category';
  category_url: string;
  category_title: string;
  product_links: ProductLink[];
  total_found: number;
}

export interface ProductLink {
  url: string;
  title?: string;
  thumbnail?: string;
  price?: string;
}

export interface ScrapeQueueItem {
  id: string;
  source_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'approved' | 'rejected';
  extracted_name: string | null;
  extracted_category: string | null;
  extracted_dimensions: { width: number; depth: number; height: number } | null;
  extracted_price: number | null;
  extracted_currency: string | null;
  extracted_images: string[] | null;
  extracted_description: string | null;
  extracted_brand: string | null;
  raw_markdown: string | null;
  ai_confidence: number | null;
  error_message: string | null;
  model_url: string | null;
  model_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  furniture_template_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BulkScrapeResult {
  url: string;
  success: boolean;
  data?: ScrapeResult['data'];
  error?: string;
}

export const furnitureScraperApi = {
  /**
   * Scrape a furniture product URL - returns product data or category links
   */
  async scrape(url: string): Promise<ScrapeResult | CategoryResult> {
    const { data, error } = await supabase.functions.invoke('scrape-furniture', {
      body: { url },
    });

    if (error) {
      console.error('Scrape function error:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  /**
   * Scrape multiple product URLs in sequence
   */
  async scrapeBulk(
    urls: string[],
    onProgress?: (current: number, total: number, result: BulkScrapeResult) => void
  ): Promise<{ success: boolean; results: BulkScrapeResult[] }> {
    const results: BulkScrapeResult[] = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      try {
        const result = await this.scrape(url);
        
        if (result.success && 'data' in result && result.data) {
          const bulkResult: BulkScrapeResult = {
            url,
            success: true,
            data: result.data,
          };
          results.push(bulkResult);
          
          // Auto-save to queue
          await this.saveToQueue(result.data);
          
          onProgress?.(i + 1, urls.length, bulkResult);
        } else {
          const bulkResult: BulkScrapeResult = {
            url,
            success: false,
            error: 'error' in result ? result.error : 'Unknown error',
          };
          results.push(bulkResult);
          onProgress?.(i + 1, urls.length, bulkResult);
        }
      } catch (err) {
        const bulkResult: BulkScrapeResult = {
          url,
          success: false,
          error: err instanceof Error ? err.message : 'Failed to scrape',
        };
        results.push(bulkResult);
        onProgress?.(i + 1, urls.length, bulkResult);
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return {
      success: results.some(r => r.success),
      results,
    };
  },

  /**
   * Save scraped data to the queue
   */
  async saveToQueue(scrapeData: ScrapeResult['data']): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!scrapeData) {
      return { success: false, error: 'No data to save' };
    }

    const { data, error } = await supabase
      .from('furniture_scrape_queue')
      .insert({
        source_url: scrapeData.source_url,
        status: 'completed',
        extracted_name: scrapeData.extracted_name,
        extracted_category: scrapeData.extracted_category,
        extracted_dimensions: scrapeData.extracted_dimensions,
        extracted_price: scrapeData.extracted_price,
        extracted_currency: scrapeData.extracted_currency,
        extracted_description: scrapeData.extracted_description,
        extracted_images: scrapeData.extracted_images,
        extracted_brand: scrapeData.extracted_brand,
        raw_markdown: scrapeData.raw_markdown,
        ai_confidence: scrapeData.ai_confidence,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Save to queue error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  },

  /**
   * Get all items in the scrape queue
   */
  async getQueue(status?: string): Promise<{ data: ScrapeQueueItem[] | null; error: string | null }> {
    let query = supabase
      .from('furniture_scrape_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get queue error:', error);
      return { data: null, error: error.message };
    }

    return { data: data as ScrapeQueueItem[], error: null };
  },

  /**
   * Approve a scrape queue item and create furniture template
   */
  async approve(
    scrapeId: string,
    overrides?: {
      name?: string;
      category?: string;
      dimensions?: { width: number; depth: number; height: number };
      price?: number;
      currency?: string;
      color?: string;
      type_slug?: string;
    }
  ): Promise<{ success: boolean; template_id?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('approve-furniture-scrape', {
      body: {
        scrape_id: scrapeId,
        ...overrides,
      },
    });

    if (error) {
      console.error('Approve function error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: data.success,
      template_id: data.data?.template_id,
      error: data.error,
    };
  },

  /**
   * Reject a scrape queue item
   */
  async reject(scrapeId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('furniture_scrape_queue')
      .update({
        status: 'rejected',
        notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', scrapeId);

    if (error) {
      console.error('Reject error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Delete a scrape queue item
   */
  async delete(scrapeId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('furniture_scrape_queue')
      .delete()
      .eq('id', scrapeId);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },
};
