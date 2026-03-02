const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  url: string;
}

interface ExtractedFurniture {
  name: string;
  brand?: string;
  category: string;
  dimensions: {
    width: number | null;
    depth: number | null;
    height: number | null;
  } | null;
  price?: number;
  currency?: string;
  description?: string;
  image_urls: string[];
  sku?: string;
}

interface ProductLink {
  url: string;
  title?: string;
  thumbnail?: string;
  price?: string;
}

interface SiteProfile {
  domain: string;
  has_json_ld: boolean;
  has_open_graph: boolean;
  json_ld_paths: Record<string, string>;
  css_selectors: Record<string, string>;
  dimension_patterns: { labels: string[]; format: string };
  default_currency: string;
  product_link_selector: string;
  product_link_pattern: string;
}

// Check if URL is a product URL (not category/filter/utility)
function isProductUrl(url: string): boolean {
  const excludePatterns = [
    /\/category\/?$/i,
    /\/categories\//i,
    /\?.*features_hash=/i,
    /\?.*filter=/i,
    /\/page\/\d+/i,
    /\/tag\//i,
    /\/search\?/i,
    /\/cart/i,
    /\/checkout/i,
    /\/account/i,
    /\/login/i,
    /\/wishlist/i,
    // CS-Cart utility URLs - these are NOT product pages
    /dispatch=product_features\./i,
    /dispatch=products\.ut2_select/i,
    /dispatch=categories\./i,
    /dispatch=auth\./i,
    /dispatch=checkout/i,
    /dispatch=compare/i,
    /index\.php\?dispatch=(?!products\.view)/i,  // Allow only products.view
  ];
  return !excludePatterns.some(p => p.test(url));
}

// Heuristic extraction of product links from category page HTML
function extractProductLinksFromHtml(
  html: string, 
  links: string[], 
  domain: string,
  siteProfile: SiteProfile | null
): ProductLink[] {
  const products: ProductLink[] = [];
  const seenUrls = new Set<string>();
  
  console.log('Running heuristic product link extraction...');
  
  // PRIORITY 1: Platform-specific patterns
  const platformPatterns: Array<{
    name: string;
    containerRegex: RegExp;
    linkRegex: RegExp;
    titleRegex: RegExp;
    priceRegex: RegExp;
    indicator: string;
  }> = [
    // CS-Cart (75mall.com)
    {
      name: 'cs-cart',
      indicator: 'ty-grid-list',
      containerRegex: /<div[^>]*class="[^"]*ty-grid-list__item[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*ty-grid-list__item|$)/gi,
      linkRegex: /<a[^>]+href="([^"]+)"[^>]*class="[^"]*product-title[^"]*"/i,
      titleRegex: /class="[^"]*ty-grid-list__item-name[^"]*"[^>]*>([^<]+)</i,
      priceRegex: /<span[^>]*class="[^"]*ty-price[^"]*"[^>]*>([^<]*€[^<]*|€[^<]*)<\/span>/i,
    },
    // WooCommerce
    {
      name: 'woocommerce',
      indicator: 'woocommerce',
      containerRegex: /<li[^>]*class="[^"]*product[^"]*type-product[^"]*"[^>]*>([\s\S]*?)(?=<li[^>]*class="[^"]*product|<\/ul>)/gi,
      linkRegex: /<a[^>]+href="([^"]+)"[^>]*class="[^"]*woocommerce-loop-product__link/i,
      titleRegex: /<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([^<]+)</i,
      priceRegex: /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([^<]+)</i,
    },
    // Generic product cards
    {
      name: 'generic-cards',
      indicator: 'product-card',
      containerRegex: /<(?:div|article)[^>]*class="[^"]*product-card[^"]*"[^>]*>([\s\S]*?)(?=<(?:div|article)[^>]*class="[^"]*product-card|$)/gi,
      linkRegex: /<a[^>]+href="([^"]+)"/i,
      titleRegex: /class="[^"]*(?:product-title|product-name|title)[^"]*"[^>]*>([^<]+)</i,
      priceRegex: /€[\d.,]+|[\d.,]+\s*€|\$[\d.,]+/i,
    },
  ];
  
  // Detect platform and extract
  for (const platform of platformPatterns) {
    if (html.includes(platform.indicator)) {
      console.log(`Detected ${platform.name} platform structure`);
      
      let match;
      while ((match = platform.containerRegex.exec(html)) !== null) {
        const cardHtml = match[1];
        
        // Extract link
        let linkMatch = cardHtml.match(platform.linkRegex);
        if (!linkMatch) {
          // Fallback: try generic link extraction
          const genericLink = cardHtml.match(/<a[^>]+href="([^"]+)"/i);
          if (!genericLink) continue;
          linkMatch = genericLink;
        }
        
        let url = linkMatch[1];
        
        // Make absolute URL
        try {
          if (url.startsWith('/')) {
            url = `https://${domain}${url}`;
          } else if (!url.startsWith('http')) {
            url = `https://${domain}/${url}`;
          }
        } catch {
          continue;
        }
        
        // Skip if already seen or not a product URL
        if (seenUrls.has(url) || !isProductUrl(url)) continue;
        seenUrls.add(url);
        
        // Extract title
        const titleMatch = cardHtml.match(platform.titleRegex);
        const title = titleMatch?.[1]?.trim();
        
        // Extract price
        const priceMatch = cardHtml.match(platform.priceRegex);
        const price = priceMatch?.[1] || priceMatch?.[0];
        
        products.push({
          url,
          title: title || undefined,
          price: price?.trim() || undefined,
        });
      }
      
      if (products.length > 0) {
        console.log(`${platform.name} extracted ${products.length} products`);
        return products;
      }
    }
  }
  
  // PRIORITY 2: Use site profile's product_link_pattern if available
  if (siteProfile?.product_link_pattern) {
    console.log('Using site profile pattern:', siteProfile.product_link_pattern);
    
    // Convert pattern to regex
    const patternRegex = new RegExp(
      siteProfile.product_link_pattern
        .replace(/{[^}]+}/g, '[^/]+')
        .replace(/\//g, '\\/'),
      'i'
    );
    
    for (const link of links) {
      if (patternRegex.test(link) && !seenUrls.has(link) && isProductUrl(link)) {
        seenUrls.add(link);
        products.push({ url: link });
      }
    }
    
    if (products.length > 0) {
      console.log(`Pattern matched ${products.length} products`);
      return products;
    }
  }
  
  // PRIORITY 3: Filter raw links by common product URL patterns (clean URLs only)
  console.log('Trying URL pattern matching...');
  const productUrlPatterns = [
    /\/product\/[^/?]+\/?$/i,        // /product/product-name/
    /\/products\/[^/?]+\/?$/i,       // /products/product-name/
    /\/p\/[^/?]+\/?$/i,              // /p/product-name/
    /\/item\/[^/?]+\/?$/i,           // /item/product-name/
    // Albanian e-commerce: require at least 2 path segments under /mobilje and product-like slug
    /\/mobilje[^/]*\/[^/?]+-(?:kend|divan|fotele|karrige|tavoline|komode|shtrat|dollap|rafe|banjo|pasqyre|llambe)[^/?]*\/?$/i,
    /-p-\d+\.html?$/i,               // Trendyol style: product-p-123.html
    /\/dp\/[A-Z0-9]+\/?$/i,          // Amazon style: /dp/B00ABC123/
  ];
  
  // Also check for CS-Cart product patterns with alphanumeric slugs
  const csCartProductPattern = /\/mobilje[^/]*\/[a-z0-9]+-[a-z0-9]+-[a-z0-9]+[^/]*\/?$/i;
  
  for (const link of links) {
    // Skip index.php URLs and query string URLs for pattern matching
    if (link.includes('index.php') || link.includes('dispatch=')) continue;
    
    const matchesPatterns = productUrlPatterns.some(p => p.test(link)) || csCartProductPattern.test(link);
    
    // Extra validation: exclude category-style URLs ending in -al/
    const looksLikeCategory = /-al\/?$/i.test(link) || /-and-[^/]+\/?$/i.test(link);
    
    if (matchesPatterns && !looksLikeCategory && !seenUrls.has(link) && isProductUrl(link)) {
      seenUrls.add(link);
      products.push({ url: link });
    }
  }
  
  if (products.length > 0) {
    console.log(`URL patterns matched ${products.length} products`);
  }
  
  return products;
}

// Extract JSON-LD Product data from HTML
function extractJsonLdProduct(html: string): ExtractedFurniture | null {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(regex)];
  
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      
      let product = null;
      if (data['@type'] === 'Product') {
        product = data;
      } else if (data['@graph'] && Array.isArray(data['@graph'])) {
        product = data['@graph'].find((item: any) => item['@type'] === 'Product');
      }
      
      if (product) {
        console.log('Found JSON-LD Product:', product.name);
        
        // Parse dimensions from additionalProperty if available
        let dimensions: ExtractedFurniture['dimensions'] = null;
        if (product.additionalProperty && Array.isArray(product.additionalProperty)) {
          let width: number | null = null;
          let depth: number | null = null;
          let height: number | null = null;
          for (const prop of product.additionalProperty) {
            const name = (prop.name || '').toLowerCase();
            const value = parseFloat(prop.value) || null;
            if (name.includes('width') || name.includes('gjerësia')) width = value;
            if (name.includes('depth') || name.includes('thellësia')) depth = value;
            if (name.includes('height') || name.includes('lartësia')) height = value;
          }
          if (width || depth || height) {
            dimensions = { width, depth, height };
          }
        }
        
        return {
          name: product.name || '',
          brand: typeof product.brand === 'string' ? product.brand : product.brand?.name,
          category: 'living', // Will be refined later
          dimensions,
          price: product.offers?.price ? parseFloat(product.offers.price) : undefined,
          currency: product.offers?.priceCurrency || 'EUR',
          description: product.description,
          image_urls: Array.isArray(product.image) ? product.image : product.image ? [product.image] : [],
          sku: product.sku,
        };
      }
    } catch (e) {
      console.log('Failed to parse JSON-LD block');
    }
  }
  
  return null;
}

// Extract OpenGraph data
function extractOpenGraph(html: string): Partial<ExtractedFurniture> {
  const ogData: Record<string, string> = {};
  
  const patterns = [
    /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["']/gi,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:([^"']+)["']/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (pattern.source.startsWith('<meta[^>]+property')) {
        ogData[match[1]] = match[2];
      } else {
        ogData[match[2]] = match[1];
      }
    }
  }
  
  // Also check product-specific meta tags
  const priceMatch = html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']*)["']/i);
  const currencyMatch = html.match(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']*)["']/i);
  
  return {
    name: ogData['title'],
    description: ogData['description'],
    image_urls: ogData['image'] ? [ogData['image']] : [],
    price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
    currency: currencyMatch ? currencyMatch[1] : undefined,
  };
}

// Fetch site profile from database
async function getSiteProfile(domain: string): Promise<SiteProfile | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/site_profiles?domain=eq.${encodeURIComponent(domain)}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return data[0] as SiteProfile;
      }
    }
  } catch (e) {
    console.error('Failed to fetch site profile:', e);
  }
  
  return null;
}

// Update extraction stats
async function updateExtractionStats(domain: string, success: boolean): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // First get current stats
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/site_profiles?domain=eq.${encodeURIComponent(domain)}&select=extraction_success_count,extraction_fail_count`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      if (data && data.length > 0) {
        const current = data[0];
        await fetch(
          `${supabaseUrl}/rest/v1/site_profiles?domain=eq.${encodeURIComponent(domain)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              extraction_success_count: success ? (current.extraction_success_count || 0) + 1 : current.extraction_success_count,
              extraction_fail_count: !success ? (current.extraction_fail_count || 0) + 1 : current.extraction_fail_count,
            }),
          }
        );
      }
    }
  } catch (e) {
    console.error('Failed to update extraction stats:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url }: ScrapeRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    // Extract domain
    const urlObj = new URL(formattedUrl);
    const domain = urlObj.hostname.replace('www.', '');

    console.log('Scraping URL:', formattedUrl);
    console.log('Domain:', domain);

    // Check for existing site profile
    const siteProfile = await getSiteProfile(domain);
    console.log('Site profile found:', !!siteProfile, siteProfile?.has_json_ld ? '(JSON-LD)' : '');

    // Step 1: Scrape with Firecrawl
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'links', 'html'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: scrapeData.error || 'Failed to scrape page',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = scrapeData.data?.markdown || '';
    const html = scrapeData.data?.html || '';
    const metadata = scrapeData.data?.metadata || {};
    const links = scrapeData.data?.links || [];
    
    console.log('Scraped content length:', markdown.length);

    // Step 2: Classify page type - use quick heuristics first, then AI as fallback
    let pageType: 'product' | 'category' = 'product'; // Default to product
    
    // Quick heuristics for product page detection
    const hasAddToCart = html.includes('add-to-cart') || html.includes('add_to_cart') || 
                         html.includes('addtocart') || html.includes('buy-now') ||
                         markdown.toLowerCase().includes('add to cart') || 
                         markdown.toLowerCase().includes('buy now');
    const hasSinglePrice = (markdown.match(/€[\d.,]+|[\d.,]+\s*€|\$[\d.,]+/g) || []).length <= 3;
    const hasProductSpecs = html.includes('product-block') || html.includes('product-detail') ||
                            html.includes('ty-product-block') || // CS-Cart
                            markdown.includes('Gjerësia') || markdown.includes('Dimensions') ||
                            markdown.includes('Specifications');
    const hasProductGallery = html.includes('product-gallery') || html.includes('product-image') ||
                              html.includes('cm-image-previewer');
    
    // Count product-like indicators
    const productIndicators = [hasAddToCart, hasSinglePrice, hasProductSpecs, hasProductGallery]
      .filter(Boolean).length;
    
    // Check for category indicators
    const hasProductGrid = html.includes('product-grid') || html.includes('products-grid') ||
                           html.includes('ty-subcategories') || html.includes('category-products');
    const manyProductLinks = links.filter((l: string) => 
      l.includes('/product/') || l.includes('/mobilje-') || l.includes('-p-')
    ).length > 5;
    
    console.log('Product indicators:', productIndicators, 'hasAddToCart:', hasAddToCart, 
                'hasSpecs:', hasProductSpecs, 'hasGallery:', hasProductGallery);
    
    // Decide based on heuristics
    if (productIndicators >= 2) {
      pageType = 'product';
      console.log('Classified as PRODUCT page via heuristics');
    } else if (hasProductGrid || manyProductLinks) {
      pageType = 'category';
      console.log('Classified as CATEGORY page via heuristics');
    } else {
      // Fall back to AI classification only when uncertain
      console.log('Uncertain classification, using AI...');
      const classificationPrompt = `Is this a SINGLE PRODUCT page or a CATEGORY page with multiple products?

URL: ${formattedUrl}
TITLE: ${metadata.title || 'Unknown'}

Look for:
- PRODUCT page: Has "Add to Cart" button, single main price, product specifications, one main image gallery
- CATEGORY page: Shows multiple products in a grid, each with its own price and link

CONTENT:
${markdown.substring(0, 5000)}

Return ONLY: {"page_type": "product"} or {"page_type": "category"}`;

      const classifyResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: classificationPrompt }],
          temperature: 0.1,
          max_tokens: 100,
        }),
      });

      const classifyData = await classifyResponse.json();
      const classifyContent = classifyData.choices?.[0]?.message?.content || '';
      
      try {
        const classMatch = classifyContent.match(/\{[\s\S]*\}/);
        if (classMatch) {
          const classification = JSON.parse(classMatch[0]);
          pageType = classification.page_type === 'category' ? 'category' : 'product';
        }
      } catch {
        console.log('Could not parse AI classification, keeping default: product');
      }
    }

    console.log('Page type detected:', pageType);

    // ============ CATEGORY PAGE HANDLING ============
    if (pageType === 'category') {
      console.log('Processing category page...');
      
      const domainOrigin = urlObj.origin;
      let productLinks: ProductLink[] = [];
      let extractionMethod = 'heuristic';
      
      // PRIORITY 1: Heuristic extraction from HTML (fast, no AI)
      productLinks = extractProductLinksFromHtml(html, links, domain, siteProfile);
      
      // PRIORITY 2: Fall back to AI only if heuristics fail
      if (productLinks.length === 0) {
        console.log('Heuristics found nothing, falling back to AI...');
        extractionMethod = 'ai';
        
        const linkExtractionPrompt = `This is an e-commerce category/listing page. Find ALL product links.

PAGE URL: ${formattedUrl}
DOMAIN: ${domainOrigin}

ALL LINKS ON PAGE:
${JSON.stringify(links.slice(0, 200), null, 2)}

VISIBLE PAGE CONTENT (product names and prices):
${markdown.substring(0, 20000)}

Find product URLs (NOT category pages). Product URLs often contain product IDs, SKUs, or product name slugs.

For EACH product found, extract:
- url: The FULL product URL
- title: Product name if visible
- price: Price as shown

Return ONLY valid JSON:
{"products": [{"url": "https://...", "title": "Product Name", "price": "€99"}, ...]}`;

        const linksResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: linkExtractionPrompt }],
            temperature: 0.1,
            max_tokens: 4000,
          }),
        });

        const linksData = await linksResponse.json();
        const linksContent = linksData.choices?.[0]?.message?.content || '';

        try {
          const jsonMatch = linksContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            productLinks = (parsed.products || []).map((p: any) => ({
              url: p.url,
              title: p.title || undefined,
              price: p.price || undefined,
            }));
          }
        } catch (parseError) {
          console.error('Failed to parse AI product links:', parseError);
        }
      }

      // Deduplicate and validate URLs
      const seenUrls = new Set<string>();
      const validProducts = productLinks.filter(p => {
        if (!p.url || seenUrls.has(p.url)) return false;
        try {
          new URL(p.url, domainOrigin);
          seenUrls.add(p.url);
          return true;
        } catch {
          return false;
        }
      });

      console.log(`Category extraction complete: ${validProducts.length} products via ${extractionMethod}`);

      return new Response(
        JSON.stringify({
          success: true,
          type: 'category',
          extraction_method: extractionMethod,
          category_url: formattedUrl,
          category_title: metadata.title || 'Category',
          product_links: validProducts,
          total_found: validProducts.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ PRODUCT PAGE HANDLING ============
    let extractedData: ExtractedFurniture | null = null;
    let extractionMethod = 'ai';

    // PRIORITY 1: Try JSON-LD extraction (most reliable)
    if (siteProfile?.has_json_ld || !siteProfile) {
      console.log('Attempting JSON-LD extraction...');
      extractedData = extractJsonLdProduct(html);
      if (extractedData && extractedData.name) {
        extractionMethod = 'json-ld';
        console.log('JSON-LD extraction successful:', extractedData.name);
      }
    }

    // PRIORITY 2: Try OpenGraph as supplement
    if (!extractedData || !extractedData.name) {
      console.log('Trying OpenGraph extraction...');
      const ogData = extractOpenGraph(html);
      if (ogData.name) {
        extractedData = {
          name: ogData.name || '',
          category: 'living',
          dimensions: null,
          image_urls: ogData.image_urls || [],
          description: ogData.description,
          price: ogData.price,
          currency: ogData.currency,
        };
        extractionMethod = 'opengraph';
        console.log('OpenGraph extraction:', extractedData.name);
      }
    }

    // PRIORITY 3: Fall back to AI extraction
    if (!extractedData || !extractedData.name) {
      console.log('Using AI extraction...');
      
      // Build dimension labels hint from site profile
      const dimensionLabels = siteProfile?.dimension_patterns?.labels?.join(', ') || 
        'width, gjerësia, depth, thellësia, height, lartësia';
      
      const extractionPrompt = `You are a furniture data extraction expert. Extract product information from this page.

PAGE URL: ${formattedUrl}
PAGE TITLE: ${metadata.title || 'Unknown'}

PAGE CONTENT:
${markdown.substring(0, 25000)}

DIMENSION LABELS TO LOOK FOR: ${dimensionLabels}

PRICE FORMATS (extract the ACTUAL price shown on page, not an example):
- €XX.XX or XX,XX € → EUR
- $XX.XX → USD
- XX Lek → ALL
- Look for price near "Çmimi", "Price", or "Add to cart" sections

Return JSON:
{
  "name": "Complete product name",
  "brand": "Brand if visible",
  "category": "living|bedroom|dining|office|storage|bathroom|outdoor",
  "dimensions": { "width": number or null, "depth": number or null, "height": number or null },
  "price": number (no symbols),
  "currency": "EUR|USD|ALL|GBP",
  "description": "Brief description",
  "image_urls": ["url1", "url2"],
  "sku": "SKU if visible"
}

CRITICAL: Extract the COMPLETE name. Parse ACTUAL dimensions from content, don't default to 100x100x100.
Return ONLY valid JSON.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: extractionPrompt }],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content || '';
        
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[0]);
            extractionMethod = 'ai';
          }
        } catch (parseError) {
          console.error('Failed to parse AI response');
        }
      }
    }

    // PRIORITY 4: Regex-based dimension extraction fallback
    if (extractedData && (!extractedData.dimensions || 
        (extractedData.dimensions.width === null && extractedData.dimensions.depth === null && extractedData.dimensions.height === null))) {
      console.log('Attempting regex dimension extraction...');
      
      // Get dimension labels from site profile AND add hardcoded Albanian/English fallbacks
      const profileLabels = siteProfile?.dimension_patterns?.labels || [];
      
      // Default labels for width, depth, height in Albanian and English
      const defaultWidthLabels = ['gjerësia', 'gjeresia', 'width', 'w:', 'largeur', 'breite'];
      const defaultDepthLabels = ['thellësia', 'thellesia', 'depth', 'd:', 'profondeur', 'tiefe'];
      const defaultHeightLabels = ['lartësia', 'lartesia', 'height', 'h:', 'hauteur', 'höhe'];
      
      // Combine profile labels with defaults (profile takes precedence)
      const profileWidthLabels = profileLabels.filter(l => l.toLowerCase().includes('gjerës') || l.toLowerCase().includes('width'));
      const profileDepthLabels = profileLabels.filter(l => l.toLowerCase().includes('thellës') || l.toLowerCase().includes('depth'));
      const profileHeightLabels = profileLabels.filter(l => l.toLowerCase().includes('lartës') || l.toLowerCase().includes('height'));
      
      const allWidthLabels = [...new Set([...profileWidthLabels, ...defaultWidthLabels])];
      const allDepthLabels = [...new Set([...profileDepthLabels, ...defaultDepthLabels])];
      const allHeightLabels = [...new Set([...profileHeightLabels, ...defaultHeightLabels])];
      
      let width: number | null = null;
      let depth: number | null = null;
      let height: number | null = null;
      
      // PRIORITY 1: Try labeled dimensions FIRST (most reliable)
      console.log('Trying labeled dimension extraction...');
      for (const label of allWidthLabels) {
        const match = markdown.match(new RegExp(label + '[:\\s]*([\\d.,]+)\\s*(?:cm|mm)?', 'i'));
        if (match) {
          width = parseFloat(match[1].replace(',', '.'));
          console.log(`Width found via "${label}":`, width);
          break;
        }
      }
      for (const label of allDepthLabels) {
        const match = markdown.match(new RegExp(label + '[:\\s]*([\\d.,]+)\\s*(?:cm|mm)?', 'i'));
        if (match) {
          depth = parseFloat(match[1].replace(',', '.'));
          console.log(`Depth found via "${label}":`, depth);
          break;
        }
      }
      for (const label of allHeightLabels) {
        const match = markdown.match(new RegExp(label + '[:\\s]*([\\d.,]+)\\s*(?:cm|mm)?', 'i'));
        if (match) {
          height = parseFloat(match[1].replace(',', '.'));
          console.log(`Height found via "${label}":`, height);
          break;
        }
      }
      
      // PRIORITY 2: Only use combined pattern (e.g., "200x150") as FALLBACK if labeled didn't find width/depth
      if (width === null && depth === null) {
        console.log('No labeled dimensions, trying combined pattern...');
        const combinedMatch = markdown.match(/(\d{2,4})\s*[xX×]\s*(\d{2,4})\s*(?:cm|mm)?/);
        if (combinedMatch) {
          width = parseInt(combinedMatch[1]);
          depth = parseInt(combinedMatch[2]);
          console.log('Found combined WxD:', width, 'x', depth);
        }
      }
      
      if (width || depth || height) {
        extractedData.dimensions = { width, depth, height };
        console.log('Regex extracted dimensions:', extractedData.dimensions);
      }
    }
    // PRIORITY 5: Regex-based price extraction - ALWAYS run to verify/override AI prices
    if (extractedData) {
      console.log('Attempting regex price extraction...');
      console.log('Current AI price:', extractedData.price, extractedData.currency);
      
      // Price patterns ordered by reliability - EUR patterns first (most common for EU sites)
      const pricePatterns = [
        // European formats with € symbol (most reliable)
        { regex: /(\d{1,5})[.,](\d{2})\s*€/, currency: 'EUR' },
        { regex: /€\s*(\d{1,5})[.,](\d{2})/, currency: 'EUR' },
        // EUR text label
        { regex: /(\d{1,5})[.,](\d{2})\s*EUR\b/i, currency: 'EUR' },
        // Albanian price label with Çmimi (often appears near the real price)
        { regex: /[Çç]mimi[:\s]*€?\s*(\d{1,5})[.,](\d{2})/i, currency: 'EUR' },
        // USD/GBP
        { regex: /\$\s*(\d{1,5})[.,](\d{2})/, currency: 'USD' },
        { regex: /£\s*(\d{1,5})[.,](\d{2})/, currency: 'GBP' },
        // Price without decimals (€ only)
        { regex: /€\s*(\d{1,5})(?![.,\d])/, currency: 'EUR', noDecimals: true },
        // Albanian Lek - only match if explicitly stated (lower priority)
        { regex: /(\d{1,6})[.,](\d{2})\s*Lek\b/i, currency: 'ALL' },
      ];
      
      let regexPrice: number | null = null;
      let regexCurrency: string | null = null;
      
      for (const { regex, currency, noDecimals } of pricePatterns) {
        const match = markdown.match(regex);
        if (match) {
          let price: number;
          if (noDecimals) {
            price = parseInt(match[1]);
          } else {
            price = parseFloat(`${match[1]}.${match[2]}`);
          }
          
          // Sanity check: price should be reasonable for furniture (10-50000)
          if (price >= 10 && price <= 50000) {
            regexPrice = price;
            regexCurrency = currency;
            console.log(`Price found via regex: ${price} ${currency}`);
            break;
          }
        }
      }
      
      // Use regex price if found, otherwise keep AI price
      if (regexPrice !== null) {
        extractedData.price = regexPrice;
        extractedData.currency = regexCurrency || extractedData.currency || 'EUR';
        console.log(`Final price (regex): ${extractedData.price} ${extractedData.currency}`);
      } else {
        console.log(`Keeping AI price: ${extractedData.price} ${extractedData.currency}`);
      }
    }

    if (!extractedData || !extractedData.name) {
      await updateExtractionStats(domain, false);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract furniture data from this page',
          hint: 'Make sure you paste a URL to a single product page.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract additional images from HTML - focus on product images
    const imageUrls: string[] = [...(extractedData.image_urls || [])];
    
    // Exclusion patterns for non-product images
    const excludePatterns = [
      'logo', 'icon', 'favicon', 'sprite', 'menu', 'background', 'nav',
      'banner', 'header', 'footer', 'avatar', 'payment', 'social',
      'shipping', 'cart', 'main_menu', 'placeholder', 'loading'
    ];
    
    const isProductImage = (url: string): boolean => {
      const lowerUrl = url.toLowerCase();
      // Exclude non-product images
      if (excludePatterns.some(pattern => lowerUrl.includes(pattern))) return false;
      // Prefer product-related paths
      if (lowerUrl.includes('/product') || lowerUrl.includes('/item') || 
          lowerUrl.includes('/detailed') || lowerUrl.includes('/images/detailed')) {
        return true;
      }
      // Accept images with reasonable dimensions in filename (product photos often have size)
      if (/\d{3,4}x\d{3,4}/.test(url) || /\d{3,4}\./.test(url)) return true;
      // Accept images from common product image paths
      if (lowerUrl.includes('cdn') || lowerUrl.includes('media') || 
          lowerUrl.includes('gallery')) return true;
      return true; // Default accept, we'll filter more below
    };
    
    // Extract from product gallery section first (use CSS selector from profile)
    const gallerySelector = siteProfile?.css_selectors?.image;
    if (gallerySelector && html.includes('cm-image-previewer')) {
      // CS-Cart specific: look for detailed images
      const detailedImgRegex = /href=["'](https?:\/\/[^\s"']*\/detailed\/[^\s"']+)["']/gi;
      let match;
      while ((match = detailedImgRegex.exec(html)) !== null) {
        if (isProductImage(match[1]) && !imageUrls.includes(match[1])) {
          imageUrls.unshift(match[1]); // Add to front (higher priority)
        }
      }
    }
    
    // Generic image extraction with filtering
    const imgPatterns = [
      /data-ca-image=["'](https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi, // CS-Cart
      /data-src=["'](https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
      /src=["'](https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    ];
    
    for (const pattern of imgPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const imgUrl = match[1];
        if (isProductImage(imgUrl) && !imageUrls.includes(imgUrl)) {
          imageUrls.push(imgUrl);
        }
      }
    }
    
    // Remove duplicates and limit
    const uniqueImages = [...new Set(imageUrls)]
      .filter(isProductImage)
      .slice(0, 10);

    // Determine currency
    let finalCurrency = extractedData.currency || siteProfile?.default_currency || 'EUR';
    if (!extractedData.currency) {
      if (markdown.includes('€') || markdown.includes('EUR')) finalCurrency = 'EUR';
      else if (markdown.includes('Lek') || markdown.includes('ALL')) finalCurrency = 'ALL';
      else if (markdown.includes('$')) finalCurrency = 'USD';
      else if (markdown.includes('£')) finalCurrency = 'GBP';
    }

    // Validate dimensions - don't accept 100x100x100 as real
    let finalDimensions = extractedData.dimensions;
    if (finalDimensions && 
        finalDimensions.width === 100 && 
        finalDimensions.depth === 100 && 
        finalDimensions.height === 100) {
      finalDimensions = null; // Reset fake dimensions
    }

    // Update extraction stats
    await updateExtractionStats(domain, true);

    // Prepare result
    const result = {
      success: true,
      type: 'product',
      extraction_method: extractionMethod,
      data: {
        source_url: formattedUrl,
        extracted_name: extractedData.name || metadata.title || 'Unknown Product',
        extracted_brand: extractedData.brand,
        extracted_category: extractedData.category || 'living',
        extracted_dimensions: finalDimensions || { width: null, depth: null, height: null },
        extracted_price: extractedData.price,
        extracted_currency: finalCurrency,
        extracted_description: extractedData.description,
        extracted_images: uniqueImages,
        extracted_sku: extractedData.sku,
        raw_markdown: markdown.substring(0, 10000),
        ai_confidence: extractionMethod === 'json-ld' ? 0.98 : extractionMethod === 'opengraph' ? 0.85 : 0.75,
      }
    };

    console.log('Extraction complete:', result.data.extracted_name, `(${extractionMethod})`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
