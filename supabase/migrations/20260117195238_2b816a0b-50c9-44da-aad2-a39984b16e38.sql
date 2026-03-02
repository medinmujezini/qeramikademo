-- Create site_profiles table for storing extraction patterns per domain
CREATE TABLE public.site_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  site_name TEXT,
  
  -- Structured data availability
  has_json_ld BOOLEAN DEFAULT false,
  has_open_graph BOOLEAN DEFAULT false,
  has_microdata BOOLEAN DEFAULT false,
  
  -- Extraction patterns (JSON paths for JSON-LD, CSS selectors, etc.)
  json_ld_paths JSONB DEFAULT '{}'::jsonb,
  css_selectors JSONB DEFAULT '{}'::jsonb,
  
  -- API endpoint if discovered
  api_endpoint TEXT,
  api_pattern JSONB,
  
  -- Dimension extraction patterns specific to this site
  dimension_patterns JSONB DEFAULT '{}'::jsonb,
  
  -- Currency info
  default_currency TEXT DEFAULT 'EUR',
  
  -- Category page patterns
  product_link_selector TEXT,
  product_link_pattern TEXT,
  
  -- Sample data for verification
  sample_url TEXT,
  sample_extraction JSONB,
  
  -- Stats
  extraction_success_count INTEGER DEFAULT 0,
  extraction_fail_count INTEGER DEFAULT 0,
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_profiles ENABLE ROW LEVEL SECURITY;

-- Admins can manage site profiles
CREATE POLICY "Admins can manage site profiles"
ON public.site_profiles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Site profiles are publicly readable (for edge functions)
CREATE POLICY "Site profiles are publicly readable"
ON public.site_profiles
FOR SELECT
USING (true);

-- Create index on domain for fast lookups
CREATE INDEX idx_site_profiles_domain ON public.site_profiles(domain);

-- Trigger for updated_at
CREATE TRIGGER update_site_profiles_updated_at
BEFORE UPDATE ON public.site_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();