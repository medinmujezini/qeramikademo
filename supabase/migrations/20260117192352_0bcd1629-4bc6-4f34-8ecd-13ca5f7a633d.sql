-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create furniture scrape queue table for admin-only e-commerce scraping
CREATE TABLE public.furniture_scrape_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  
  -- Extracted data
  extracted_name text,
  extracted_category text,
  extracted_dimensions jsonb,
  extracted_price numeric,
  extracted_currency text DEFAULT 'USD',
  extracted_images text[],
  extracted_description text,
  extracted_brand text,
  
  -- Processing metadata
  raw_markdown text,
  ai_confidence numeric,
  error_message text,
  
  -- 3D model (future Trellis integration)
  model_url text,
  model_status text DEFAULT 'none' NOT NULL,
  
  -- Admin workflow
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  
  -- Resulting furniture template
  furniture_template_id uuid REFERENCES public.furniture_templates(id),
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_scrape_queue_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'processing', 'completed', 'failed', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status value: %', NEW.status;
  END IF;
  IF NEW.model_status NOT IN ('none', 'queued', 'generating', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid model_status value: %', NEW.model_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_scrape_queue_status_trigger
  BEFORE INSERT OR UPDATE ON public.furniture_scrape_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_scrape_queue_status();

-- Create updated_at trigger
CREATE TRIGGER update_furniture_scrape_queue_updated_at
  BEFORE UPDATE ON public.furniture_scrape_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS - Admin only
ALTER TABLE public.furniture_scrape_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scrape queue"
  ON public.furniture_scrape_queue
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for status filtering
CREATE INDEX idx_scrape_queue_status ON public.furniture_scrape_queue(status);
CREATE INDEX idx_scrape_queue_created_at ON public.furniture_scrape_queue(created_at DESC);