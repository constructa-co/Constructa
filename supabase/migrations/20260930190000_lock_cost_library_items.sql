-- Restore least-privilege RLS after the historical "nuclear option" disabled
-- it. Phase 1 only reads the shared system catalogue from this legacy table.
-- Organization-owned custom rates use the newer MoM/rate tables; ambiguous
-- legacy tenant rows stay quarantined until schema reconciliation is complete.

BEGIN;

ALTER TABLE public.cost_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_user_and_system_cost_items
  ON public.cost_library_items;
DROP POLICY IF EXISTS insert_user_cost_items
  ON public.cost_library_items;
DROP POLICY IF EXISTS update_user_cost_items
  ON public.cost_library_items;
DROP POLICY IF EXISTS delete_user_cost_items
  ON public.cost_library_items;
DROP POLICY IF EXISTS "Users Manage Own Resources"
  ON public.cost_library_items;
DROP POLICY IF EXISTS "Public Read System Items"
  ON public.cost_library_items;
DROP POLICY IF EXISTS select_system_cost_library_items
  ON public.cost_library_items;

CREATE POLICY select_system_cost_library_items
  ON public.cost_library_items
  FOR SELECT
  TO authenticated
  USING (
    is_system_default IS TRUE
    AND user_id IS NULL
    AND tenant_id IS NULL
  );

REVOKE ALL ON public.cost_library_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cost_library_items TO authenticated;
GRANT ALL ON public.cost_library_items TO service_role;

COMMIT;
