ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS case_studies jsonb DEFAULT '[]'::jsonb;
