
CREATE TABLE public.curtain_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  model_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.curtain_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Curtain models are publicly readable"
  ON public.curtain_models FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage curtain models"
  ON public.curtain_models FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_curtain_models_updated_at
  BEFORE UPDATE ON public.curtain_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
