
-- Create kitchen_models table for admin-uploaded GLB models
CREATE TABLE public.kitchen_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  block_type TEXT NOT NULL,
  model_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kitchen_models ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage kitchen models"
ON public.kitchen_models
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Publicly readable
CREATE POLICY "Kitchen models are publicly readable"
ON public.kitchen_models
FOR SELECT
USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_kitchen_models_updated_at
BEFORE UPDATE ON public.kitchen_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
