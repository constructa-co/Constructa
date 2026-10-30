-- DRAFT - DO NOT APPLY. Rob must approve this before anyone applies it.
-- See docs/reviews/cq-costlib-policy-draft.md, including the live checks to
-- run first.
--
-- The live "Public Read System Items" policy is SELECT to public USING (true),
-- which exposes every row. Narrow it to genuine system rows: flagged
-- is_system_default AND unowned, matching select_system_cost_library_items.
-- The flag alone is not enough, because an owner able to write a row could set
-- it on their own row and publish that row to every reader.
--
-- Owners read their own rows through a separate policy. Writes are unchanged:
-- this migration adds no write policy and alters no grants, so if the Data API
-- grants are in place, owners stay read-only and anon stays blocked.

BEGIN;

-- Policies do nothing while RLS is off, and a historical migration disabled it.
ALTER TABLE public.cost_library_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read System Items"
  ON public.cost_library_items;
DROP POLICY IF EXISTS select_own_cost_library_items
  ON public.cost_library_items;

CREATE POLICY "Public Read System Items"
  ON public.cost_library_items
  FOR SELECT
  TO anon, authenticated
  USING (
    is_system_default IS TRUE
    AND user_id IS NULL
    AND tenant_id IS NULL
  );

CREATE POLICY select_own_cost_library_items
  ON public.cost_library_items
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR tenant_id = (SELECT auth.uid())
  );

COMMIT;
