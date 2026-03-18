-- Sprint 1: Custom rate overrides per organisation
CREATE TABLE IF NOT EXISTS public.mom_item_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    mom_item_id UUID NOT NULL REFERENCES public.mom_items(id) ON DELETE CASCADE,
    custom_rate NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, mom_item_id)
);

ALTER TABLE public.mom_item_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "org_overrides_all" ON public.mom_item_overrides
FOR ALL USING (organization_id IN (SELECT public.get_my_organizations()))
WITH CHECK (organization_id IN (SELECT public.get_my_organizations()));

CREATE INDEX IF NOT EXISTS idx_overrides_org_item ON public.mom_item_overrides(organization_id, mom_item_id);
