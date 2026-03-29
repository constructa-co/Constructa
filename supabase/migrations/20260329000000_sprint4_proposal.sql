-- Sprint 4: Proposal product improvements
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_email text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_phone text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS payment_schedule jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS payment_terms text;
