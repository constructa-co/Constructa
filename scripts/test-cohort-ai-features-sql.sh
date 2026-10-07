#!/usr/bin/env bash
# Cohort AI bounds: six features under one budget, four of them newly allowed
# and all four seeded off.
#
# Applies the four migrations in order (interview, AI budget, attempt binding,
# cohort features) in a throwaway local Postgres and proves that:
#   - rows written before the new migration survive it;
#   - exactly six feature names are allowed, and a seventh is refused;
#   - the four additions are disabled as seeded, company.introduction is still
#     disabled, profile.rewrite is unchanged, and neither allowance row moved;
#   - a disabled feature cannot reserve, and reserves nothing;
#   - once a test enables them, each reserves only up to its own output cap
#     and only without a source fingerprint;
#   - one contractor's allowance is a single pool across all six, also under
#     simultaneous calls from different features;
#   - no browser role holds any privilege on the budget's tables or can
#     execute any function in the chain, and no function was added or changed.
#
# This budget covers six named features. It is not an application-wide limit.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-cohort-ai.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55456}"

cleanup() {
  if [[ -f "$TEST_DIR/data/postmaster.pid" ]]; then
    "$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$TEST_DIR/data" --auth=trust --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -l "$TEST_DIR/postgres.log" \
  -o "-p $PORT -k $TEST_DIR" start >/dev/null

PSQL=("$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$TEST_DIR" -p "$PORT" -d postgres)

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_name text, capability_statement text, years_trading integer,
  accreditations text, insurance_details text, specialisms text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003');
INSERT INTO public.profiles (id, company_name, capability_statement, years_trading) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Builders', NULL, NULL),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Beta Joinery', 'Beta in its own words', 4),
  ('cccccccc-0000-0000-0000-000000000003', 'Gamma Roofing', NULL, NULL);

CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
CREATE FUNCTION t.expect(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', message; END IF;
END $$;
CREATE FUNCTION t.denied(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN insufficient_privilege THEN RETURN true;
END $$;
CREATE FUNCTION t.fails(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN OTHERS THEN RETURN true;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261008090000_company_interview.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261009090000_ai_generation_budget.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261010090000_company_narrative_ai_attempt.sql" >/dev/null

# Before the new migration: an attempt of each existing feature, finished and unfinished.
"${PSQL[@]}" >/dev/null <<'SQL'
UPDATE public.ai_generation_features SET enabled = true WHERE feature = 'company.introduction';
SET ROLE service_role;
SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001',
  (public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700, NULL)->>'attempt_id')::uuid, 'ok', 100, 80, 'model-a', 'profile-rewrite-v1');
SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001',
  (public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'company.introduction', 500, repeat('a', 32))->>'attempt_id')::uuid, 'rejected:tripwire', 100, 60, 'model-a', 'intro-ai-v1');
SELECT public.ai_generation_reserve('bbbbbbbb-0000-0000-0000-000000000002', 'profile.rewrite', 700, NULL);
RESET ROLE;
UPDATE public.ai_generation_features SET enabled = false WHERE feature = 'company.introduction';
CREATE TABLE t.before AS SELECT * FROM public.ai_generation_attempts;
CREATE TABLE t.functions_before AS
  SELECT p.oid::regprocedure::text AS signature, md5(p.prosrc) AS body
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND (p.proname LIKE 'company\_%' OR p.proname LIKE 'ai\_generation\_%');
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261011090000_cohort_ai_features.sql" >/dev/null

"${PSQL[@]}" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set gamma '''cccccccc-0000-0000-0000-000000000003'''

-- ── Old rows, functions and allowances are exactly as they were ──────────────
SELECT t.expect((SELECT count(*) FROM public.ai_generation_attempts) = 3
  AND NOT EXISTS (SELECT * FROM public.ai_generation_attempts EXCEPT SELECT * FROM t.before)
  AND NOT EXISTS (SELECT * FROM t.before EXCEPT SELECT * FROM public.ai_generation_attempts), 'attempts recorded before the migration are unchanged, finished and unfinished alike');
SELECT t.expect(NOT EXISTS (
  (SELECT p.oid::regprocedure::text, md5(p.prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (p.proname LIKE 'company\_%' OR p.proname LIKE 'ai\_generation\_%'))
  EXCEPT SELECT signature, body FROM t.functions_before)
  AND (SELECT count(*) FROM t.functions_before) = 7, 'no function was added, removed or changed: still the same seven');
SELECT t.expect((SELECT per_hour_attempts = 6 AND per_day_attempts = 20 AND per_day_output_tokens = 12000 FROM public.ai_generation_limits WHERE scope = 'contractor'), 'the contractor allowance row is untouched');
SELECT t.expect((SELECT per_hour_attempts IS NULL AND per_day_attempts = 2000 AND per_day_output_tokens = 1000000 FROM public.ai_generation_limits WHERE scope = 'global'), 'the service-wide row is untouched');
SELECT t.expect((SELECT count(*) FROM public.ai_generation_limits) = 2, 'no allowance row was added');

-- ── Six features, four new and off ───────────────────────────────────────────
SELECT t.expect((SELECT array_agg(feature ORDER BY feature) FROM public.ai_generation_features)
  = ARRAY['brief.suggest', 'case-studies.enhance', 'company.introduction', 'profile.rewrite', 'proposal.wording', 'schedule.programme-update'], 'exactly six features have a budget row');
SELECT t.expect((SELECT bool_and(NOT enabled) FROM public.ai_generation_features WHERE feature IN ('brief.suggest', 'proposal.wording', 'case-studies.enhance', 'schedule.programme-update')), 'all four additions are switched off as seeded');
SELECT t.expect((SELECT NOT enabled FROM public.ai_generation_features WHERE feature = 'company.introduction'), 'interview wording is still off');
SELECT t.expect((SELECT enabled AND max_reserve_output_tokens = 700 FROM public.ai_generation_features WHERE feature = 'profile.rewrite'), 'profile rewrite is as it was');
SELECT t.expect((SELECT jsonb_object_agg(feature, max_reserve_output_tokens) FROM public.ai_generation_features WHERE feature IN ('brief.suggest', 'proposal.wording', 'case-studies.enhance', 'schedule.programme-update'))
  = '{"brief.suggest":700,"proposal.wording":2000,"case-studies.enhance":1000,"schedule.programme-update":900}'::jsonb, 'each addition has its own output cap');
SELECT t.expect(t.fails($q$ INSERT INTO public.ai_generation_features VALUES ('costs.boq-import', true, 500) $q$), 'a seventh feature cannot be given a budget row');
SELECT t.expect(t.fails($q$ INSERT INTO public.ai_generation_features VALUES ('proposal.wording ', true, 500) $q$), 'nor a near-miss of a known name');

-- ── Browser roles: still nothing, across the chain ───────────────────────────
SELECT t.expect((SELECT bool_and(NOT has_table_privilege(r, tbl, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'))
  FROM unnest(ARRAY['authenticated', 'anon']) r, unnest(ARRAY['public.ai_generation_features', 'public.ai_generation_limits', 'public.ai_generation_attempts']) tbl), 'no browser role holds any privilege on any budget table');
SELECT t.expect((SELECT bool_and(NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') AND NOT has_function_privilege('anon', p.oid, 'EXECUTE'))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND (p.proname LIKE 'company\_%' OR p.proname LIKE 'ai\_generation\_%')), 'no browser role can execute any function in the chain');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT t.expect((SELECT bool_and(t.denied(format('SELECT public.ai_generation_reserve(%L, %L, 1, NULL)', 'aaaaaaaa-0000-0000-0000-000000000001', f)))
  FROM unnest(ARRAY['brief.suggest', 'proposal.wording', 'case-studies.enhance', 'schedule.programme-update', 'profile.rewrite', 'company.introduction']) f), 'a signed-in contractor cannot reserve for any of the six');
SELECT t.expect(t.denied($q$ UPDATE public.ai_generation_features SET enabled = true $q$), 'and cannot switch any of them on');
RESET ROLE;

-- ── Disabled: no reservation, no row ─────────────────────────────────────────
SET ROLE service_role;
SELECT t.expect((SELECT bool_and(public.ai_generation_reserve('cccccccc-0000-0000-0000-000000000003', f, 1, NULL)->>'status' = 'disabled')
  FROM unnest(ARRAY['brief.suggest', 'proposal.wording', 'case-studies.enhance', 'schedule.programme-update']) f), 'none of the four can reserve while it is off');
SELECT t.expect(public.ai_generation_reserve(:gamma, 'company.introduction', 500, repeat('a', 32))->>'status' = 'disabled', 'nor can interview wording');
SELECT t.expect((SELECT count(*) FROM public.ai_generation_attempts WHERE user_id = :gamma) = 0, 'and no row was written for any of those refusals');
RESET ROLE;

-- The test switches the four on for itself. The migration leaves them off.
UPDATE public.ai_generation_features SET enabled = true WHERE feature IN ('brief.suggest', 'proposal.wording', 'case-studies.enhance', 'schedule.programme-update');
SET ROLE service_role;

-- ── Each reserves up to its own cap, and without a fingerprint ───────────────
CREATE FUNCTION pg_temp.cap_holds(p_feature text, p_cap integer) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM t.expect(t.fails(format('SELECT public.ai_generation_reserve(%L, %L, %s, NULL)', 'cccccccc-0000-0000-0000-000000000003', p_feature, p_cap + 1)), p_feature || ' cannot reserve more than its cap');
  PERFORM t.expect(t.fails(format('SELECT public.ai_generation_reserve(%L, %L, %s, %L)', 'cccccccc-0000-0000-0000-000000000003', p_feature, p_cap, repeat('a', 32))), p_feature || ' carries no source fingerprint');
  r := public.ai_generation_reserve('cccccccc-0000-0000-0000-000000000003', p_feature, p_cap, NULL);
  PERFORM t.expect(r->>'status' = 'reserved', p_feature || ' reserves exactly its cap');
  PERFORM t.expect(public.ai_generation_finish('cccccccc-0000-0000-0000-000000000003', (r->>'attempt_id')::uuid, 'error', NULL, NULL, NULL, 'v1'), p_feature || ' finishes');
  PERFORM t.expect((SELECT charged_output_tokens FROM public.ai_generation_attempts WHERE id = (r->>'attempt_id')::uuid) = p_cap, p_feature || ' is charged its whole reservation when nothing came back');
END $$;
SELECT pg_temp.cap_holds('brief.suggest', 700);
SELECT pg_temp.cap_holds('proposal.wording', 2000);
SELECT pg_temp.cap_holds('case-studies.enhance', 1000);
SELECT pg_temp.cap_holds('schedule.programme-update', 900);
-- 700 + 2000 + 1000 + 900 = 4600 of the unchanged 12,000 a day; four of the unchanged six an hour.
SELECT t.expect((SELECT sum(charged_output_tokens) FROM public.ai_generation_attempts WHERE user_id = :gamma) = 4600, 'four failed calls hold 4,600 tokens of the allowance');

-- ── One pool across all six ──────────────────────────────────────────────────
SELECT t.expect(public.ai_generation_finish(:gamma, (public.ai_generation_reserve(:gamma, 'profile.rewrite', 700, NULL)->>'attempt_id')::uuid, 'ok', 10, 10, 'm', 'v'), 'a fifth call, from profile rewrite');
SELECT t.expect(public.ai_generation_finish(:gamma, (public.ai_generation_reserve(:gamma, 'brief.suggest', 700, NULL)->>'attempt_id')::uuid, 'rejected:tripwire', 10, 10, 'm', 'v'), 'a sixth, from the brief');
SELECT t.expect((SELECT bool_and(public.ai_generation_reserve('cccccccc-0000-0000-0000-000000000003', f, 1, NULL)->>'status' = 'attempt-limit')
  FROM unnest(ARRAY['brief.suggest', 'proposal.wording', 'case-studies.enhance', 'schedule.programme-update', 'profile.rewrite']) f), 'six calls across four features use up the hour for every feature');
SELECT t.expect((SELECT count(*) FROM public.ai_generation_attempts WHERE user_id = :gamma) = 6, 'the refusals wrote nothing');
-- The daily output allowance is shared too: six proposal rewordings at the cap would be 12,000.
RESET ROLE;
DELETE FROM public.ai_generation_attempts WHERE user_id = 'cccccccc-0000-0000-0000-000000000003';
UPDATE public.ai_generation_limits SET per_hour_attempts = NULL WHERE scope = 'contractor';
SET ROLE service_role;
DO $$
DECLARE r jsonb;
BEGIN
  FOR i IN 1..5 LOOP
    r := public.ai_generation_reserve('cccccccc-0000-0000-0000-000000000003', 'proposal.wording', 2000, NULL);
    PERFORM public.ai_generation_finish('cccccccc-0000-0000-0000-000000000003', (r->>'attempt_id')::uuid, 'error', NULL, NULL, NULL, NULL);
  END LOOP;
END $$;
SELECT t.expect(public.ai_generation_reserve(:gamma, 'schedule.programme-update', 900, NULL)->>'status' = 'reserved', '10,000 used: a 900-token programme update still fits');
SELECT public.ai_generation_finish(:gamma, (SELECT id FROM public.ai_generation_attempts WHERE user_id = :gamma AND finished_at IS NULL), 'error', NULL, NULL, NULL, NULL);
SELECT t.expect(public.ai_generation_reserve(:gamma, 'proposal.wording', 2000, NULL)->>'status' = 'token-limit', '10,900 used: another 2,000-token rewording does not');
SELECT t.expect(public.ai_generation_reserve(:gamma, 'brief.suggest', 700, NULL)->>'status' = 'reserved', 'but a 700-token brief suggestion does: it is one allowance, measured in tokens');
RESET ROLE;
UPDATE public.ai_generation_limits SET per_hour_attempts = 6 WHERE scope = 'contractor';
DELETE FROM public.ai_generation_attempts WHERE user_id = 'cccccccc-0000-0000-0000-000000000003';
SQL

# ── Eight simultaneous reservations for ONE contractor, from four different features ──
i=0
for feature in brief.suggest proposal.wording case-studies.enhance schedule.programme-update brief.suggest proposal.wording case-studies.enhance profile.rewrite; do
  i=$((i + 1))
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.ai_generation_reserve('cccccccc-0000-0000-0000-000000000003', '$feature', 500, NULL)->>'status';" | tail -n 1 > "$TEST_DIR/pool.$i" &
done
wait
reserved="$(cat "$TEST_DIR"/pool.* | grep -c '^reserved$' || true)"
in_flight="$(cat "$TEST_DIR"/pool.* | grep -c '^in-flight$' || true)"
if [[ "$reserved" != "1" || "$in_flight" != "7" ]]; then
  echo "FAILED: eight simultaneous reservations across features gave $reserved reserved and $in_flight in flight; expected 1 and 7." >&2
  exit 1
fi

# ── Many contractors at once, different features, against the service ceiling ──
"${PSQL[@]}" -q >/dev/null <<'SQL'
DELETE FROM public.ai_generation_attempts;
UPDATE public.ai_generation_limits SET per_day_attempts = 3 WHERE scope = 'global';
INSERT INTO auth.users SELECT ('eeeeeeee-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid FROM generate_series(1, 8) n;
SQL
i=0
for feature in brief.suggest proposal.wording case-studies.enhance schedule.programme-update profile.rewrite brief.suggest proposal.wording schedule.programme-update; do
  i=$((i + 1))
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.ai_generation_reserve('eeeeeeee-0000-0000-0000-00000000000$i', '$feature', 500, NULL)->>'status';" | tail -n 1 > "$TEST_DIR/global.$i" &
done
wait
reserved="$(cat "$TEST_DIR"/global.* | grep -c '^reserved$' || true)"
refused="$(cat "$TEST_DIR"/global.* | grep -c '^service-limit$' || true)"
if [[ "$reserved" != "3" || "$refused" != "5" ]]; then
  echo "FAILED: eight contractors at once against a service ceiling of 3 gave $reserved reserved and $refused refused; expected 3 and 5." >&2
  exit 1
fi

echo "cohort ai features: six features, four seeded off, allowances untouched, one shared pool, isolation holds"
