-- D36: markup method. NOT APPLIED by this change; apply before deploying the code that reads it.
--
-- profiles.markup_method   the company's choice for NEW estimates. Default on_net.
-- estimates.markup_method  the method frozen on each estimate when it is created.
--                          NULL on every existing row, and the application reads
--                          NULL as 'compound' (how all existing estimates and
--                          proposals were calculated). Do NOT backfill or add a
--                          default here: that would re-price existing estimates.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS markup_method text NOT NULL DEFAULT 'on_net';

ALTER TABLE public.estimates
    ADD COLUMN IF NOT EXISTS markup_method text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_markup_method_check') THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_markup_method_check CHECK (markup_method IN ('on_net', 'compound'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'estimates_markup_method_check') THEN
        ALTER TABLE public.estimates
            ADD CONSTRAINT estimates_markup_method_check CHECK (markup_method IS NULL OR markup_method IN ('on_net', 'compound'));
    END IF;
END $$;
