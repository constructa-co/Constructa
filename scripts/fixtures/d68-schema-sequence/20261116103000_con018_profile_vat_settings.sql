-- CON-018 — company VAT registration, default rate, default reverse charge on profiles.
-- DRAFT ONLY: apply in production only after operator readback; not applied by agents.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS vat_registered boolean DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS default_vat_rate numeric(5, 2) DEFAULT 20
        CHECK (default_vat_rate IS NULL OR (default_vat_rate >= 0 AND default_vat_rate <= 100)),
    ADD COLUMN IF NOT EXISTS default_vat_reverse_charge boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.vat_registered IS 'NULL = legacy (treat as registered at default rate). false = not VAT registered. true = use default_vat_rate.';
COMMENT ON COLUMN public.profiles.default_vat_rate IS 'Standard VAT % on proposals when registered (CON-018).';
COMMENT ON COLUMN public.profiles.default_vat_reverse_charge IS 'Default hint for new jobs: domestic reverse charge (CON-018).';