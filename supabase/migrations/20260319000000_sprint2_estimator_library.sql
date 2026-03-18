-- Sprint 2: Connect Estimator to Cost Library
-- Add mom_item_id to estimate_lines (snapshot FK, nullable)
ALTER TABLE public.estimate_lines
  ADD COLUMN IF NOT EXISTS mom_item_id UUID REFERENCES public.mom_items(id) ON DELETE SET NULL;

-- Add mom_item_code for display (snapshot — stored at time of adding, not joined)
ALTER TABLE public.estimate_lines
  ADD COLUMN IF NOT EXISTS mom_item_code TEXT;

-- Helper function: returns effective rate for an org (override if exists, else base_rate)
CREATE OR REPLACE FUNCTION public.get_effective_rate(p_item_id UUID, p_org_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(
    (SELECT custom_rate FROM public.mom_item_overrides
     WHERE mom_item_id = p_item_id AND organization_id = p_org_id),
    (SELECT base_rate FROM public.mom_items WHERE id = p_item_id)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
