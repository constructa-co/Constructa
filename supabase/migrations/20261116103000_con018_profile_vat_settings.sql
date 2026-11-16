-- CON-018 — company VAT registration, default rate, default reverse charge on profiles.
-- DRAFT ONLY: apply in production only after operator readback; not applied by agents.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS default_vat_rate numeric(5, 2) NOT NULL DEFAULT 20
        CHECK (default_vat_rate >= 0 AND default_vat_rate <= 100),
    ADD COLUMN IF NOT EXISTS default_vat_reverse_charge boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.vat_registered IS 'Whether the company is VAT registered (CON-018).';
COMMENT ON COLUMN public.profiles.default_vat_rate IS 'Standard VAT % on proposals when registered (CON-018).';
COMMENT ON COLUMN public.profiles.default_vat_reverse_charge IS 'Default hint for new jobs: domestic reverse charge (CON-018).';