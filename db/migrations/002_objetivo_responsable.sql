-- Responsable del objetivo (usuario que lidera el objetivo).
ALTER TABLE public.objetivo ADD COLUMN IF NOT EXISTS responsable_id uuid REFERENCES public.usuario (id);

UPDATE public.objetivo SET responsable_id = creado_por WHERE responsable_id IS NULL;
