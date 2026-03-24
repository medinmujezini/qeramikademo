ALTER TABLE public.tile_templates
  ADD COLUMN material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  ADD COLUMN texture_scale_cm numeric(6,2);