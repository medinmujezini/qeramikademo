
ALTER TABLE public.furniture_templates
  ADD COLUMN IF NOT EXISTS price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;
