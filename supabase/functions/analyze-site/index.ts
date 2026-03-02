const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeRequest {
  url: string;
}

interface SiteProfile {
  domain: string;
  site_name: string;
  has_json_ld: boolean;
  has_open_graph: boolean;
  has_microdata: boolean;
  json_ld_paths: Record<string, string>;
  css_selectors: Record<string, string>;
  dimension_patterns: {
    labels: string[];
    format: string;
    selector?: string;
  };
  default_currency: string;
  product_link_selector: string;
  product_link_pattern: string;
  sample_extraction: Record<string, any>;
}

interface JsonLdProduct {
  name?: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  brand?: { name?: string } | string;
  offers?: {
    price?: number | string;
    priceCurrency?: string;
  };
  additionalProperty?: Array<{
    name?: string;
    value?: string;
  }>;
}

// Extract JSON-LD structured data from HTML
function extractJsonLd(html: string): { found: boolean; data?: JsonLdProduct; paths?: Record<string, string> } {
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const matches = [...html.matchAll(regex)];
  
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      
      // Check for Product type directly
      if (data['@type'] === 'Product') {
        return {
          found: true,
          data: data as JsonLdProduct,
          paths: {
            name: '@.name',
            price: '@.offers.price',
            currency: '@.offers.priceCurrency',
            image: '@.image',
            sku: '@.sku',
            brand: '@.brand.name',
            description: '@.description',
          }
        };
      }
      
      // Check in @graph array
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        const productIndex = data['@graph'].findIndex((item: any) => item['@type'] === 'Product');
        if (productIndex >= 0) {
          return {
            found: true,
            data: data['@graph'][productIndex] as JsonLdProduct,
            paths: {
              name: `@graph[${productIndex}].name`,
              price: `@graph[${productIndex}].offers.price`,
              currency: `@graph[${productIndex}].offers.priceCurrency`,
              image: `@graph[${productIndex}].image`,
              sku: `@graph[${productIndex}].sku`,
              brand: `@graph[${productIndex}].brand.name`,
              description: `@graph[${productIndex}].description`,
            }
          };
        }
      }
    } catch (e) {
      console.log('Failed to parse JSON-LD block:', e);
    }
  }
  
  return { found: false };
}

// Extract OpenGraph meta tags
function extractOpenGraph(html: string): { found: boolean; data?: Record<string, string> } {
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
  
  return {
    found: Object.keys(ogData).length > 0,
    data: ogData
  };
}

// Detect dimension format patterns in content
function detectDimensionPatterns(markdown: string): { labels: string[]; format: string } {
  const labels: string[] = [];
  
  // Check for various language dimension labels
  const labelPatterns: Record<string, string[]> = {
    width: ['width', 'gjerësia', 'gjeresia', 'larghezza', 'breite', 'largeur', 'ancho'],
    height: ['height', 'lartësia', 'lartesia', 'altezza', 'höhe', 'hauteur', 'alto'],
    depth: ['depth', 'thellësia', 'thellesia', 'profondità', 'tiefe', 'profondeur', 'profundidad'],
  };
  
  for (const [dim, patterns] of Object.entries(labelPatterns)) {
    for (const pattern of patterns) {
      if (markdown.toLowerCase().includes(pattern)) {
        labels.push(pattern);
        break;
      }
    }
  }
  
  // Detect format
  let format = 'separate'; // default: dimensions listed separately
  if (/\d+\s*[xX×]\s*\d+\s*[xX×]\s*\d+\s*(?:cm|mm)/.test(markdown)) {
    format = 'WxDxH';
  } else if (/\d+\s*[xX×]\s*\d+\s*(?:cm|mm)/.test(markdown)) {
    format = 'WxD';
  }
  
  return { labels, format };
}

// Use AI to analyze CSS selectors for the page
async function analyzeSelectors(
  html: string, 
  lovableKey: string
): Promise<Record<string, string>> {
  const prompt = `Analyze this e-commerce product page HTML and identify the CSS selectors for key product information.

HTML (first 15000 chars):
${html.substring(0, 15000)}

Identify the most specific and reliable CSS selectors for:
1. Product name/title (usually h1 or .product-title)
2. Price (look for price classes, currency symbols)
3. Main product image (the large product photo)
4. Description (product details text)
5. Specifications/dimensions table (often a table or list with product specs)
6. Add to cart button (for verification it's a product page)

Return ONLY valid JSON with this format:
{
  "name": "h1.product-title",
  "price": ".price-box .price",
  "image": ".product-gallery img.main-image",
  "description": ".product-description",
  "specs": ".product-attributes table",
  "add_to_cart": ".add-to-cart-button"
}

Focus on selectors that are likely to work across all products on this site.
Return ONLY the JSON object, no explanations.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI selector analysis failed');
      return {};
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to analyze selectors:', e);
  }
  
  return {};
}

// Detect product link patterns and selectors for category pages
function detectProductLinkPatternAndSelector(
  html: string, 
  links: string[], 
  domain: string
): { pattern: string; selector: string } {
  let pattern = '';
  let selector = '';
  
  // Platform-specific detection
  const platformDetection = [
    { 
      indicator: 'ty-grid-list', 
      platform: 'cs-cart',
      selector: '.ty-grid-list__item a.product-title',
      patternRegex: /\/mobilje-[^/]+\/[^/]+-\d+/,
      patternTemplate: '/mobilje-{category}/{slug}-{id}'
    },
    { 
      indicator: 'woocommerce', 
      platform: 'woocommerce',
      selector: '.products .product a.woocommerce-loop-product__link',
      patternRegex: /\/product\/[^/]+/,
      patternTemplate: '/product/{slug}'
    },
    { 
      indicator: 'shopify', 
      platform: 'shopify',
      selector: '.product-card a',
      patternRegex: /\/products\/[^/]+/,
      patternTemplate: '/products/{slug}'
    },
    { 
      indicator: 'product-item-link', 
      platform: 'magento',
      selector: '.product-item a.product-item-link',
      patternRegex: /\/[^/]+\.html$/,
      patternTemplate: '/{slug}.html'
    },
  ];
  
  for (const platform of platformDetection) {
    if (html.includes(platform.indicator)) {
      console.log(`Detected ${platform.platform} platform`);
      selector = platform.selector;
      
      // Find matching links for pattern
      const matchingLinks = links.filter(link => platform.patternRegex.test(link));
      if (matchingLinks.length >= 2) {
        pattern = platform.patternTemplate;
      }
      break;
    }
  }
  
  // Fallback to generic pattern detection if no platform detected
  if (!pattern) {
    const genericPatterns = [
      { regex: /\/product\/[^/]+/, pattern: '/product/{slug}' },
      { regex: /\/produkt\/[^/]+/, pattern: '/produkt/{slug}' },
      { regex: /\/p\/[^/]+/, pattern: '/p/{slug}' },
      { regex: /\/item\/[^/]+/, pattern: '/item/{slug}' },
      { regex: /\/dp\/[A-Z0-9]+/, pattern: '/dp/{asin}' },
      { regex: /[?&]id=\d+/, pattern: '?id={id}' },
      { regex: /\/mobilje-[^/]+\/[^/]+-\d+/, pattern: '/mobilje-{category}/{slug}-{id}' },
      { regex: /-p-\d+/, pattern: '{name}-p-{id}' },
    ];
    
    for (const { regex, pattern: p } of genericPatterns) {
      const matchingLinks = links.filter(link => regex.test(link));
      if (matchingLinks.length >= 3) {
        pattern = p;
        break;
      }
    }
  }
  
  return { pattern, selector };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url }: AnalyzeRequest = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!firecrawlKey || !lovableKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'API keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse domain from URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    const urlObj = new URL(formattedUrl);
    const domain = urlObj.hostname.replace('www.', '');
    
    console.log('Analyzing site:', domain);

    // Step 1: Scrape a sample product page
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeResponse.ok || !scrapeData.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to scrape page for analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = scrapeData.data?.html || '';
    const markdown = scrapeData.data?.markdown || '';
    const links = scrapeData.data?.links || [];
    const metadata = scrapeData.data?.metadata || {};

    console.log('Page scraped, analyzing structure...');

    // Step 2: Extract structured data
    const jsonLdResult = extractJsonLd(html);
    const openGraphResult = extractOpenGraph(html);
    const dimensionPatterns = detectDimensionPatterns(markdown);
    
    console.log('JSON-LD found:', jsonLdResult.found);
    console.log('OpenGraph found:', openGraphResult.found);

    // Step 3: Analyze CSS selectors using AI (only if no JSON-LD)
    let cssSelectors: Record<string, string> = {};
    if (!jsonLdResult.found) {
      console.log('No JSON-LD, analyzing CSS selectors...');
      cssSelectors = await analyzeSelectors(html, lovableKey);
    }

    // Step 4: Detect product link patterns and selectors
    const { pattern: productLinkPattern, selector: productLinkSelector } = 
      detectProductLinkPatternAndSelector(html, links, domain);
    
    console.log('Product link detection:', { productLinkPattern, productLinkSelector });
    
    // Step 5: Detect default currency
    let defaultCurrency = 'EUR';
    if (markdown.includes('$') && !markdown.includes('€')) {
      defaultCurrency = 'USD';
    } else if (markdown.includes('Lek') || markdown.includes('ALL')) {
      defaultCurrency = 'ALL';
    } else if (markdown.includes('£')) {
      defaultCurrency = 'GBP';
    }

    // Step 6: Create sample extraction if JSON-LD found
    let sampleExtraction: Record<string, any> = {};
    if (jsonLdResult.found && jsonLdResult.data) {
      const product = jsonLdResult.data;
      sampleExtraction = {
        name: product.name,
        price: product.offers?.price,
        currency: product.offers?.priceCurrency,
        sku: product.sku,
        description: product.description?.substring(0, 200),
        image: Array.isArray(product.image) ? product.image[0] : product.image,
        brand: typeof product.brand === 'string' ? product.brand : product.brand?.name,
      };
    }

    // Build the site profile
    const profile: SiteProfile = {
      domain,
      site_name: metadata.title?.split(' - ')[0]?.split(' | ')[0] || domain,
      has_json_ld: jsonLdResult.found,
      has_open_graph: openGraphResult.found,
      has_microdata: html.includes('itemprop='),
      json_ld_paths: jsonLdResult.paths || {},
      css_selectors: cssSelectors,
      dimension_patterns: dimensionPatterns,
      default_currency: defaultCurrency,
      product_link_selector: productLinkSelector,
      product_link_pattern: productLinkPattern,
      sample_extraction: sampleExtraction,
    };

    console.log('Site analysis complete:', {
      domain: profile.domain,
      hasJsonLd: profile.has_json_ld,
      hasOpenGraph: profile.has_open_graph,
      currency: profile.default_currency,
    });

    // Save to database using upsert
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // First try to delete existing profile (to avoid duplicate key issues)
    await fetch(`${supabaseUrl}/rest/v1/site_profiles?domain=eq.${encodeURIComponent(profile.domain)}`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    
    // Then insert new profile
    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/site_profiles`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        domain: profile.domain,
        site_name: profile.site_name,
        has_json_ld: profile.has_json_ld,
        has_open_graph: profile.has_open_graph,
        has_microdata: profile.has_microdata,
        json_ld_paths: profile.json_ld_paths,
        css_selectors: profile.css_selectors,
        dimension_patterns: profile.dimension_patterns,
        default_currency: profile.default_currency,
        product_link_selector: profile.product_link_selector,
        product_link_pattern: profile.product_link_pattern,
        sample_url: formattedUrl,
        sample_extraction: profile.sample_extraction,
        analyzed_at: new Date().toISOString(),
      }),
    });

    if (!saveResponse.ok) {
      const saveError = await saveResponse.text();
      console.error('Failed to save profile:', saveError);
    } else {
      console.log('Profile saved to database');
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile,
        message: jsonLdResult.found 
          ? 'Found JSON-LD structured data - reliable extraction available!'
          : openGraphResult.found
            ? 'Found OpenGraph tags - good extraction available'
            : 'No structured data found - using CSS selector analysis',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analyze error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
