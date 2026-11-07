-- A059: authenticated writes to projects run the projects_working_pattern_valid
-- CHECK as the writing user, and QA refuses them with SQLSTATE 42501 on
-- public.valid_programme_working_pattern. The validator is SECURITY INVOKER,
-- immutable and reads nothing, so EXECUTE is the only thing missing.
--
-- SOURCE ONLY. Not applied to any database by this change. Operator note: a QA
-- apply needs Rob's own separate yes for this grant, and the AI ledger yes does
-- not cover it. Apply this one file only, never `supabase db push`, which would
-- also run every other pending migration. Do not replay the v1 or v2 migrations.
--
-- anon stays excluded on purpose: it writes no projects rows. No other function,
-- role, table, row policy or validation rule changes here.

BEGIN;

GRANT EXECUTE ON FUNCTION public.valid_programme_working_pattern(jsonb) TO authenticated;

COMMIT;
