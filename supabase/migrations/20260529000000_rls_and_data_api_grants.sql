-- ─────────────────────────────────────────────────────────────────────────────
-- 20260529000000_rls_and_data_api_grants.sql
--
-- Fixes GitHub issues #10 and #11:
--   #10  Supabase advisor flagged rls_disabled_in_public on several tables.
--   #11  Supabase Data API defaults change (2026-05-30 / 2026-10-30): new
--        tables stop being auto-exposed; the app must opt in explicitly via
--        GRANT statements per role.
--
-- Scope (verified against current supabase/migrations/ state):
--   Public-schema tables created without ENABLE ROW LEVEL SECURITY:
--     - estimate_dependencies   (project-scoped via owning estimates)
--     - api_usage_log           (internal — service_role only)
--     - programme_benchmarks    (anonymised reference data — read-only)
--     - project_benchmarks      (anonymised reference data — read-only)
--     - rate_benchmarks         (anonymised reference data — read-only)
--     - variation_benchmarks    (anonymised reference data — read-only)
--
-- Design notes:
--   * estimate_dependencies links estimates(id) -> estimates(id). Ownership
--     is project_id -> projects(id) -> projects.user_id. Both predecessor
--     and successor must belong to projects owned by auth.uid().
--   * Benchmarks are intentionally anonymised aggregates (no user_id, value
--     bands not exact figures). Per the original 20260409100000_sprint42_benchmarks
--     design they are service-role only — the only runtime readers are the
--     admin client at src/app/api/v1/benchmarks/route.ts and
--     src/app/admin/page.tsx. We therefore keep RLS on with no permissive
--     policy and REVOKE Data API access from anon + authenticated. Writes
--     happen via the SECURITY DEFINER trigger fn_benchmark_on_archive.
--   * api_usage_log carries per-key request metadata and is written/read
--     exclusively via the admin (service_role) client at
--     src/app/api/v1/benchmarks/route.ts and src/app/admin/page.tsx. We keep
--     it locked: RLS on, no permissive policy, no client grants.
--   * Explicit REVOKE on api_usage_log makes the Data API hide it even on
--     pre-2026-05-30 projects.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. estimate_dependencies ────────────────────────────────────────────────
ALTER TABLE public.estimate_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_estimate_dependencies ON public.estimate_dependencies;
CREATE POLICY select_own_estimate_dependencies
  ON public.estimate_dependencies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = estimate_dependencies.successor_id
        AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = estimate_dependencies.predecessor_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS insert_own_estimate_dependencies ON public.estimate_dependencies;
CREATE POLICY insert_own_estimate_dependencies
  ON public.estimate_dependencies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = successor_id
        AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = predecessor_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS update_own_estimate_dependencies ON public.estimate_dependencies;
CREATE POLICY update_own_estimate_dependencies
  ON public.estimate_dependencies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = estimate_dependencies.successor_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = successor_id
        AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = predecessor_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS delete_own_estimate_dependencies ON public.estimate_dependencies;
CREATE POLICY delete_own_estimate_dependencies
  ON public.estimate_dependencies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM estimates e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = estimate_dependencies.successor_id
        AND p.user_id = auth.uid()
    )
  );

-- Data API: authenticated users need full CRUD; anon stays out.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_dependencies TO authenticated;
GRANT ALL ON public.estimate_dependencies TO service_role;
REVOKE ALL ON public.estimate_dependencies FROM anon;


-- ── 2. api_usage_log (internal — service_role only) ─────────────────────────
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

-- No permissive policy: RLS on with no policy denies all non-service_role.
-- service_role bypasses RLS, which is what the admin client uses.

REVOKE ALL ON public.api_usage_log FROM anon;
REVOKE ALL ON public.api_usage_log FROM authenticated;
GRANT ALL ON public.api_usage_log TO service_role;


-- ── 3. Benchmark tables (service-role only, per original Sprint 42 design) ──
-- Writes happen via SECURITY DEFINER trigger fn_benchmark_on_archive only.
-- Reads happen via the admin (service_role) client only — see
-- src/app/api/v1/benchmarks/route.ts and src/app/admin/page.tsx.

ALTER TABLE public.project_benchmarks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_benchmarks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_benchmarks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_benchmarks  ENABLE ROW LEVEL SECURITY;

-- Drop any permissive SELECT policies left over from an earlier partial apply
-- of this migration (kept for re-runnability — there are no CREATE POLICY
-- statements for these tables anymore).
DROP POLICY IF EXISTS read_project_benchmarks    ON public.project_benchmarks;
DROP POLICY IF EXISTS read_programme_benchmarks  ON public.programme_benchmarks;
DROP POLICY IF EXISTS read_rate_benchmarks       ON public.rate_benchmarks;
DROP POLICY IF EXISTS read_variation_benchmarks  ON public.variation_benchmarks;

-- No permissive policy: RLS on with no policy denies all non-service_role.
-- service_role bypasses RLS, which is what the admin client uses.

REVOKE ALL ON public.project_benchmarks    FROM anon, authenticated;
REVOKE ALL ON public.programme_benchmarks  FROM anon, authenticated;
REVOKE ALL ON public.rate_benchmarks       FROM anon, authenticated;
REVOKE ALL ON public.variation_benchmarks  FROM anon, authenticated;

GRANT ALL ON public.project_benchmarks    TO service_role;
GRANT ALL ON public.programme_benchmarks  TO service_role;
GRANT ALL ON public.rate_benchmarks       TO service_role;
GRANT ALL ON public.variation_benchmarks  TO service_role;

COMMIT;
