-- D101 / PR #176 ROLLBACK for supabase/migrations/20261115120000_d36_markup_method.sql
--
-- NOT a migration. Lives outside supabase/migrations so it can never run
-- automatically. Run by a human only after the verified preapply backup exists.
--
-- ORDER: run down-20261116140000-phase1-graph-rpc.sql FIRST. This script
-- refuses while the function body still references markup_method (dropping the
-- columns would otherwise break project creation at run time).
--
-- NON-DESTRUCTIVE BY CONSTRUCTION: it drops profiles.markup_method and
-- estimates.markup_method (and their check constraints) ONLY when doing so
-- loses nothing:
--   * no estimate has a stored markup_method (every row is NULL = legacy compound)
--   * no profile has markup_method other than the column default 'on_net'
--     (re-applying the migration restores exactly that default)
-- Otherwise it REFUSES and changes nothing. The supported rollback then is to
-- keep the additive columns: a pre-D36 application ignores them. There is no
-- force option and no archive-and-drop path in this drill.

BEGIN;

-- Take the locks BEFORE inspecting any stored choice and hold them through
-- COMMIT, so no writer can add a choice between the check and the DROP.
-- ACCESS EXCLUSIVE is what DROP COLUMN needs anyway. lock_timeout makes a busy
-- system fail safe (nothing changes) instead of waiting or deadlocking.
-- MAINTENANCE ASSUMPTION: during any real rollback no old or new application
-- instance may be writing; stop writers first. The lock enforces the guard
-- against stragglers; it is not a substitute for the maintenance window.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.profiles, public.estimates IN ACCESS EXCLUSIVE MODE;

DO $guard$
DECLARE
    v_n bigint;
    v_src text;
BEGIN
    SELECT p.prosrc INTO v_src
      FROM pg_catalog.pg_proc p
     WHERE p.oid = to_regprocedure('public.create_phase1_project_graph(uuid,jsonb,jsonb)');
    IF v_src IS NOT NULL AND position('markup_method' IN v_src) > 0 THEN
        RAISE EXCEPTION 'D101 column rollback refused: create_phase1_project_graph still references markup_method. Run the RPC rollback first.';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'markup_method') THEN
        EXECUTE 'SELECT count(*) FROM public.estimates WHERE markup_method IS NOT NULL' INTO v_n;
        IF v_n > 0 THEN
            RAISE EXCEPTION 'D101 column rollback refused: % estimate(s) hold a stored markup_method; dropping would destroy it. Keep the additive columns.', v_n;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'markup_method') THEN
        EXECUTE 'SELECT count(*) FROM public.profiles WHERE markup_method IS DISTINCT FROM ''on_net''' INTO v_n;
        IF v_n > 0 THEN
            RAISE EXCEPTION 'D101 column rollback refused: % profile(s) chose a non-default markup_method; dropping would destroy it. Keep the additive columns.', v_n;
        END IF;
    END IF;
END
$guard$;

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_markup_method_check;
ALTER TABLE public.profiles  DROP CONSTRAINT IF EXISTS profiles_markup_method_check;
ALTER TABLE public.estimates DROP COLUMN IF EXISTS markup_method;
ALTER TABLE public.profiles  DROP COLUMN IF EXISTS markup_method;

COMMIT;
