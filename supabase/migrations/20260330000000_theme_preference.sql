ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system-c';
-- system-c = Option C (dark sidebar, light content) — the default
-- dark = full dark mode (Option A)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sales_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sales_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS accounts_email text;
