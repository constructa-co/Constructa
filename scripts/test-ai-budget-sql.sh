#!/usr/bin/env bash
# Stage 2G.3.2, candidate A: the AI usage budget for two features.
#
# Runs the migration in a throwaway local Postgres and proves that:
#   - it applies cleanly, with company.introduction switched off;
#   - no browser role can read or write the settings or the ledger, or call
#     either function;
#   - a reservation is refused, inserting nothing, when the feature is off,
#     a call is in flight, or an hourly, daily, token or global limit is
#     reached, each at exactly its boundary;
#   - the contractor's allowance is one pool across both features;
#   - every attempt counts: failed, rejected, in flight and abandoned. An
#     attempt whose usage is unknown is charged its whole reservation, and one
#     whose usage is known is charged what it used;
#   - an attempt is finished once, only by its own contractor, and can never
#     be changed afterwards;
#   - eight simultaneous reservations for one contractor give exactly one;
#   - the two advisory locks are taken in one place, global first.
#
# This budget covers profile.rewrite and company.introduction only. It is not
# an application-wide limit.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-ai-budget.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55454}"

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

INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000003'),
  ('dddddddd-0000-0000-0000-000000000004');

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

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261009090000_ai_generation_budget.sql" >/dev/null

"${PSQL[@]}" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set FP '''0123456789abcdef0123456789abcdef'''

-- Test helpers, owned by the superuser running the test.
-- Reserve and immediately finish, returning the reserve status.
CREATE FUNCTION t.spend(p_user uuid, p_feature text, p_reserve integer, p_outcome text, p_completion integer) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  r := public.ai_generation_reserve(p_user, p_feature, p_reserve, NULL);
  IF r->>'status' = 'reserved' THEN
    PERFORM public.ai_generation_finish(p_user, (r->>'attempt_id')::uuid, p_outcome, CASE WHEN p_completion IS NULL THEN NULL ELSE 100 END, p_completion, 'canned-model', 'test-v1');
  END IF;
  RETURN r->>'status';
END $$;
-- Moves a contractor's whole history back in time. Only an unfinished row may be updated
-- through the guard, so the guard is switched off for this, by the table owner, in the test only.
CREATE FUNCTION t.age(p_user uuid, p_by interval) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  ALTER TABLE public.ai_generation_attempts DISABLE TRIGGER ai_generation_attempts_guard;
  UPDATE public.ai_generation_attempts SET started_at = started_at - p_by, finished_at = finished_at - p_by WHERE user_id = p_user;
  ALTER TABLE public.ai_generation_attempts ENABLE TRIGGER ai_generation_attempts_guard;
END $$;
CREATE FUNCTION t.attempts(p_user uuid) RETURNS integer LANGUAGE sql AS $$ SELECT count(*)::integer FROM public.ai_generation_attempts WHERE user_id = p_user $$;

-- ── As seeded ────────────────────────────────────────────────────────────────
SELECT t.expect((SELECT enabled FROM public.ai_generation_features WHERE feature = 'company.introduction') = false, 'the interview''s AI wording is switched off as seeded');
SELECT t.expect((SELECT enabled AND max_reserve_output_tokens = 700 FROM public.ai_generation_features WHERE feature = 'profile.rewrite'), 'profile rewrite is on, capped at 700 output tokens a call');
SELECT t.expect((SELECT per_hour_attempts = 6 AND per_day_attempts = 20 AND per_day_output_tokens = 12000 FROM public.ai_generation_limits WHERE scope = 'contractor'), 'one contractor: 6 an hour, 20 a day, 12,000 output tokens a day');
SELECT t.expect((SELECT per_day_attempts = 2000 AND per_day_output_tokens = 1000000 FROM public.ai_generation_limits WHERE scope = 'global'), 'everyone together: 2,000 a day, 1,000,000 output tokens a day');
SELECT t.expect(t.fails($q$ INSERT INTO public.ai_generation_features VALUES ('brief.suggest', true, 500) $q$), 'only the two named features can be given a budget row');

-- ── Browser roles: nothing ───────────────────────────────────────────────────
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT t.expect(t.denied('SELECT 1 FROM public.ai_generation_attempts') AND t.denied('SELECT 1 FROM public.ai_generation_limits') AND t.denied('SELECT 1 FROM public.ai_generation_features'), 'a signed-in contractor cannot read the ledger or the settings');
SELECT t.expect(t.denied($q$ UPDATE public.ai_generation_limits SET per_day_attempts = 1000000 $q$), 'a contractor cannot raise a limit');
SELECT t.expect(t.denied($q$ UPDATE public.ai_generation_features SET enabled = true $q$), 'a contractor cannot switch a feature on');
SELECT t.expect(t.denied($q$ DELETE FROM public.ai_generation_attempts $q$), 'a contractor cannot clear the ledger');
SELECT t.expect(t.denied($q$ INSERT INTO public.ai_generation_attempts (user_id, feature, reserved_output_tokens) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 1) $q$), 'a contractor cannot write the ledger');
SELECT t.expect(t.denied($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700, NULL) $q$), 'a browser cannot reserve');
SELECT t.expect(t.denied($q$ SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'ok', 1, 1, 'm', 'v') $q$), 'a browser cannot finish');
RESET ROLE;
SET ROLE anon;
SELECT t.expect(t.denied('SELECT 1 FROM public.ai_generation_attempts') AND t.denied($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700, NULL) $q$), 'a signed-out visitor can do nothing');
RESET ROLE;
SELECT t.expect(NOT has_table_privilege('authenticated', 'public.ai_generation_attempts', 'SELECT, INSERT, UPDATE, DELETE')
  AND NOT has_table_privilege('authenticated', 'public.ai_generation_limits', 'SELECT, INSERT, UPDATE, DELETE')
  AND NOT has_table_privilege('authenticated', 'public.ai_generation_features', 'SELECT, INSERT, UPDATE, DELETE')
  AND NOT has_table_privilege('anon', 'public.ai_generation_attempts', 'SELECT, INSERT, UPDATE, DELETE'), 'the browser roles hold no privilege on any budget table');
SELECT t.expect((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.ai_generation_attempts'::regclass, 'public.ai_generation_limits'::regclass, 'public.ai_generation_features'::regclass)), 'row level security is on for all three tables');

SET ROLE service_role;

-- ── Disabled, unknown and malformed: no row ──────────────────────────────────
SELECT t.expect(public.ai_generation_reserve(:alpha, 'company.introduction', 500, :FP)->>'status' = 'disabled', 'the interview''s AI wording cannot reserve while it is off');
SELECT t.expect(public.ai_generation_reserve(:alpha, 'brief.suggest', 500, NULL)->>'status' = 'disabled', 'a feature with no budget row cannot reserve');
SELECT t.expect(public.ai_generation_reserve(:alpha, NULL, 500, NULL)->>'status' = 'disabled', 'no feature, no reservation');
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 701, NULL) $q$), 'more output than the feature allows cannot be reserved');
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 0, NULL) $q$) AND t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', NULL, NULL) $q$), 'a reservation must be for at least one token');
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve(NULL, 'profile.rewrite', 700, NULL) $q$), 'a reservation must be for a contractor');
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700, '0123456789abcdef0123456789abcdef') $q$), 'a rewrite carries no source fingerprint');
SELECT t.expect(t.attempts(:alpha) = 0, 'none of those refusals or errors left a row');

-- ── One in flight; finish once, by its owner, then immutable ─────────────────
SELECT public.ai_generation_reserve(:alpha, 'profile.rewrite', 700, NULL) AS first \gset
SELECT ((:'first'::jsonb)->>'attempt_id') AS first_id \gset
SELECT t.expect((:'first'::jsonb)->>'status' = 'reserved', 'a first call is reserved');
SELECT t.expect((SELECT charged_output_tokens FROM public.ai_generation_attempts WHERE id = :'first_id') = 700, 'a call in flight is charged its whole reservation');
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 700, NULL)->>'status' = 'in-flight', 'a second call cannot start while one is running');
SELECT t.expect(t.attempts(:alpha) = 1, 'the refused reservation left no row');
SELECT t.expect(t.fails($q$ INSERT INTO public.ai_generation_attempts (user_id, feature, reserved_output_tokens) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700) $q$), 'the schema itself refuses a second call in flight');

SELECT t.expect(public.ai_generation_finish(:beta, :'first_id', 'ok', 100, 50, 'm', 'v') = false, 'another contractor cannot finish it');
SELECT t.expect(t.fails(format($q$ SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', %L, 'refunded', 0, 0, 'm', 'v') $q$, :'first_id')), 'an outcome must be one of the known ones');
SELECT t.expect(t.fails(format($q$ SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', %L, 'abandoned', 0, 0, 'm', 'v') $q$, :'first_id')), 'a caller cannot mark its own call abandoned');
SELECT t.expect(t.fails(format($q$ SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', %L, 'ok', NULL, NULL, 'm', 'v') $q$, :'first_id')), 'a successful call must record what it used');
SELECT t.expect(t.fails(format($q$ SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', %L, 'ok', 10, -5, 'm', 'v') $q$, :'first_id')), 'usage cannot be negative');
SELECT t.expect(t.fails(format($q$ SELECT public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', %L, 'ok', 10, 1000001, 'm', 'v') $q$, :'first_id')), 'usage is bounded');
SELECT t.expect((SELECT finished_at IS NULL FROM public.ai_generation_attempts WHERE id = :'first_id'), 'none of those finished it');

SELECT t.expect(public.ai_generation_finish(:alpha, :'first_id', 'rejected:tripwire', 310, 120, repeat('m', 150), repeat('v', 90)), 'its own contractor finishes it');
SELECT t.expect((SELECT outcome = 'rejected:tripwire' AND prompt_tokens = 310 AND completion_tokens = 120 AND charged_output_tokens = 120 AND char_length(model) = 100 AND char_length(prompt_version) = 60 FROM public.ai_generation_attempts WHERE id = :'first_id'),
  'a rejected reply is recorded with the usage the provider reported, and is charged what it used; long labels are cut to their limits');
SELECT t.expect(public.ai_generation_finish(:alpha, :'first_id', 'ok', 1, 1, 'm', 'v') = false, 'it cannot be finished a second time');
SELECT t.expect((SELECT outcome FROM public.ai_generation_attempts WHERE id = :'first_id') = 'rejected:tripwire', 'and its outcome did not change');
SELECT t.expect(t.fails(format($q$ UPDATE public.ai_generation_attempts SET outcome = 'ok' WHERE id = %L $q$, :'first_id')), 'a finished attempt cannot be rewritten, even by the server');
SELECT t.expect(t.fails(format($q$ UPDATE public.ai_generation_attempts SET completion_tokens = 0 WHERE id = %L $q$, :'first_id')), 'nor can its usage be zeroed');
SELECT t.expect(t.fails(format($q$ UPDATE public.ai_generation_attempts SET finished_at = NULL, outcome = NULL WHERE id = %L $q$, :'first_id')), 'nor can it be reopened');

-- Unknown usage is charged in full; an open attempt's reservation cannot be shrunk.
SELECT public.ai_generation_reserve(:alpha, 'profile.rewrite', 700, NULL)->>'attempt_id' AS second_id \gset
SELECT t.expect(t.fails(format($q$ UPDATE public.ai_generation_attempts SET reserved_output_tokens = 1 WHERE id = %L $q$, :'second_id')), 'a reservation cannot be shrunk while the call is running');
SELECT t.expect(t.fails(format($q$ UPDATE public.ai_generation_attempts SET user_id = 'bbbbbbbb-0000-0000-0000-000000000002' WHERE id = %L $q$, :'second_id')), 'nor moved to another contractor');
SELECT t.expect(public.ai_generation_finish(:alpha, :'second_id', 'error', NULL, NULL, NULL, 'v'), 'a call that failed with nothing back is finished as an error');
SELECT t.expect((SELECT charged_output_tokens FROM public.ai_generation_attempts WHERE id = :'second_id') = 700, 'and is charged its whole reservation: there is no free failure');
SELECT t.expect((SELECT sum(charged_output_tokens) FROM public.ai_generation_attempts WHERE user_id = :alpha) = 820, 'known usage and unknown usage are charged differently: 120 + 700');
RESET ROLE;
SELECT t.age(:alpha, interval '2 days');
SET ROLE service_role;

-- ── Hourly limit, exactly, with failures counting ────────────────────────────
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'error', NULL) = 'reserved', 'call 1 of 6, failed');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'rejected:schema', 40) = 'reserved', 'call 2 of 6, reply rejected');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'rejected:tripwire', 40) = 'reserved', 'call 3 of 6, reply rejected');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'error', NULL) = 'reserved', 'call 4 of 6, failed');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'ok', 40) = 'reserved', 'call 5 of 6');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'error', NULL) = 'reserved', 'call 6 of 6 is allowed');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'ok', 40) = 'attempt-limit', 'call 7 in the hour is refused, though five of the six failed or were rejected');
SELECT t.expect(t.attempts(:alpha) = 8, 'the refusal left no row');
SELECT t.expect(t.spend(:beta, 'profile.rewrite', 100, 'ok', 40) = 'reserved', 'another contractor is unaffected');
-- Exactly an hour: 59 minutes ago still counts, 61 does not.
RESET ROLE;
SELECT t.age(:alpha, interval '59 minutes');
SET ROLE service_role;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 100, NULL)->>'status' = 'attempt-limit', 'at 59 minutes the hour is not over');
RESET ROLE;
SELECT t.age(:alpha, interval '2 minutes');
SET ROLE service_role;
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 100, 'ok', 40) = 'reserved', 'at 61 minutes it is');

-- ── Daily attempts, exactly ──────────────────────────────────────────────────
RESET ROLE;
DELETE FROM public.ai_generation_attempts;
INSERT INTO public.ai_generation_attempts (user_id, feature, started_at, finished_at, outcome, reserved_output_tokens, completion_tokens)
SELECT 'aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', now() - interval '3 hours' - n * interval '1 minute', now() - interval '3 hours', 'error', 10, NULL FROM generate_series(1, 19) n;
SET ROLE service_role;
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 10, 'ok', 5) = 'reserved', 'the 20th call in a day is allowed');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 10, 'ok', 5) = 'attempt-limit', 'the 21st is refused');
RESET ROLE;
SELECT t.age(:alpha, interval '21 hours');
SET ROLE service_role;
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 10, 'ok', 5) = 'reserved', 'attempts more than 24 hours old no longer count');

-- ── Daily output tokens, exactly, counting what is still in flight ───────────
RESET ROLE;
DELETE FROM public.ai_generation_attempts;
UPDATE public.ai_generation_limits SET per_hour_attempts = NULL, per_day_attempts = 1000 WHERE scope = 'contractor';
INSERT INTO public.ai_generation_attempts (user_id, feature, started_at, finished_at, outcome, reserved_output_tokens, completion_tokens)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', now() - interval '2 hours', now() - interval '2 hours', 'ok', 700, 11000);
SET ROLE service_role;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 701 - 1, NULL)->>'status' = 'reserved', '11,000 used and 700 reserved is 11,700: allowed');
SELECT t.expect(public.ai_generation_reserve(:beta, 'profile.rewrite', 700, NULL)->>'status' = 'reserved', '(another contractor has their own allowance)');
SELECT public.ai_generation_finish(:alpha, (SELECT id FROM public.ai_generation_attempts WHERE user_id = :alpha AND finished_at IS NULL), 'error', NULL, NULL, NULL, NULL);
SELECT t.expect((SELECT sum(charged_output_tokens) FROM public.ai_generation_attempts WHERE user_id = :alpha) = 11700, 'the failed call still holds its 700');
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 301, NULL)->>'status' = 'token-limit', '11,700 plus 301 is over 12,000: refused');
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 300, NULL)->>'status' = 'reserved', '11,700 plus 300 is exactly 12,000: allowed');
-- That one is still in flight. Its reservation already fills the allowance.
RESET ROLE;
SELECT t.age(:alpha, interval '3 minutes');
SET ROLE service_role;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 1, NULL)->>'status' = 'token-limit', 'an abandoned call keeps its whole reservation, so even one more token is refused');
SELECT t.expect((SELECT count(*) FROM public.ai_generation_attempts WHERE user_id = :alpha AND outcome = 'abandoned' AND charged_output_tokens = 300) = 1, 'the call that never reported back was closed as abandoned after two minutes, charged in full');

-- ── One pool across both features ────────────────────────────────────────────
RESET ROLE;
DELETE FROM public.ai_generation_attempts;
UPDATE public.ai_generation_limits SET per_hour_attempts = 6, per_day_attempts = 20 WHERE scope = 'contractor';
UPDATE public.ai_generation_features SET enabled = true WHERE feature = 'company.introduction';
SET ROLE service_role;
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'company.introduction', 500, NULL) $q$), 'interview wording must say which sources it was written from');
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'company.introduction', 500, 'not-a-fingerprint') $q$), 'and say it as a fingerprint');
SELECT t.expect(t.fails($q$ SELECT public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'company.introduction', 501, '0123456789abcdef0123456789abcdef') $q$), 'interview wording may reserve at most 500');
DO $$
DECLARE r jsonb;
BEGIN
  FOR i IN 1..3 LOOP
    PERFORM t.expect(t.spend('aaaaaaaa-0000-0000-0000-000000000001', 'profile.rewrite', 700, 'ok', 100) = 'reserved', 'rewrite call ' || i);
    r := public.ai_generation_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'company.introduction', 500, '0123456789abcdef0123456789abcdef');
    PERFORM t.expect(r->>'status' = 'reserved', 'interview call ' || i);
    PERFORM public.ai_generation_finish('aaaaaaaa-0000-0000-0000-000000000001', (r->>'attempt_id')::uuid, 'sources-moved', 200, 90, 'm', 'intro-ai-v1');
  END LOOP;
END $$;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 700, NULL)->>'status' = 'attempt-limit', 'three rewrites and three interview calls use up the hour: a seventh rewrite is refused');
SELECT t.expect(public.ai_generation_reserve(:alpha, 'company.introduction', 500, :FP)->>'status' = 'attempt-limit', 'and so is a seventh interview call: one cannot be used to get round the other');
SELECT t.expect((SELECT count(*) FROM public.ai_generation_attempts WHERE user_id = :alpha AND feature = 'company.introduction' AND source_fingerprint = :FP AND outcome = 'sources-moved' AND charged_output_tokens = 90) = 3, 'a reply discarded because its sources moved is recorded as that, with its fingerprint and its real usage');
-- Switching one feature off refuses it and leaves the other, and the shared pool, alone.
RESET ROLE;
UPDATE public.ai_generation_features SET enabled = false WHERE feature = 'company.introduction';
SELECT t.age(:alpha, interval '2 hours');
SET ROLE service_role;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'company.introduction', 500, :FP)->>'status' = 'disabled', 'switched off again, the interview cannot reserve');
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 700, 'ok', 100) = 'reserved', 'while rewrite carries on');

-- ── The global circuit breaker, exactly ──────────────────────────────────────
RESET ROLE;
DELETE FROM public.ai_generation_attempts;
UPDATE public.ai_generation_limits SET per_day_attempts = 3, per_day_output_tokens = 1500 WHERE scope = 'global';
SET ROLE service_role;
SELECT t.expect(t.spend(:alpha, 'profile.rewrite', 700, 'ok', 100) = 'reserved', 'global call 1');
SELECT t.expect(t.spend(:beta, 'profile.rewrite', 700, 'error', NULL) = 'reserved', 'global call 2, a different contractor, failed');
SELECT t.expect(t.spend('cccccccc-0000-0000-0000-000000000003', 'profile.rewrite', 700, 'ok', 100) = 'reserved', 'global call 3 of 3');
SELECT t.expect(t.spend('dddddddd-0000-0000-0000-000000000004', 'profile.rewrite', 700, 'ok', 100) = 'service-limit', 'a fourth contractor, who has used nothing, is refused: the service ceiling is reached');
SELECT t.expect(t.attempts('dddddddd-0000-0000-0000-000000000004') = 0, 'and nothing was recorded against them');
RESET ROLE;
UPDATE public.ai_generation_limits SET per_day_attempts = 1000 WHERE scope = 'global';
SET ROLE service_role;
-- 100 + 700 + 100 = 900 charged so far; the ceiling is 1,500.
SELECT t.expect(public.ai_generation_reserve('dddddddd-0000-0000-0000-000000000004', 'profile.rewrite', 601, NULL)->>'status' = 'service-limit', '900 plus 601 is over the service ceiling');
SELECT t.expect(public.ai_generation_reserve('dddddddd-0000-0000-0000-000000000004', 'profile.rewrite', 600, NULL)->>'status' = 'reserved', '900 plus 600 is exactly at it');
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 1, NULL)->>'status' = 'service-limit', 'another contractor''s unfinished reservation counts against the service ceiling');

-- ── Missing settings fail closed ─────────────────────────────────────────────
RESET ROLE;
DELETE FROM public.ai_generation_attempts;
DELETE FROM public.ai_generation_limits WHERE scope = 'global';
SET ROLE service_role;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 700, NULL)->>'status' = 'disabled', 'with no service ceiling configured, nothing can be reserved');
RESET ROLE;
INSERT INTO public.ai_generation_limits VALUES ('global', NULL, 2000, 1000000);
DELETE FROM public.ai_generation_limits WHERE scope = 'contractor';
SET ROLE service_role;
SELECT t.expect(public.ai_generation_reserve(:alpha, 'profile.rewrite', 700, NULL)->>'status' = 'disabled', 'with no contractor allowance configured, nothing can be reserved');
RESET ROLE;
INSERT INTO public.ai_generation_limits VALUES ('contractor', 6, 20, 12000);

-- ── Lock order is fixed, and in one place ────────────────────────────────────
SELECT t.expect((SELECT count(*) FROM pg_proc WHERE prosrc LIKE '%ai_generation:global%' OR prosrc LIKE '%ai_generation:contractor:%') = 1, 'exactly one function takes the budget locks');
SELECT t.expect((SELECT position('ai_generation:global' IN prosrc) > 0 AND position('ai_generation:global' IN prosrc) < position('ai_generation:contractor:' IN prosrc) FROM pg_proc WHERE proname = 'ai_generation_reserve'), 'and it takes the global lock before the contractor''s');
SELECT t.expect((SELECT prosrc NOT LIKE '%advisory%' FROM pg_proc WHERE proname = 'ai_generation_finish'), 'finishing takes no advisory lock');
SQL

# ── Eight simultaneous reservations for one contractor ────────────────────────
for i in 1 2 3 4 5 6 7 8; do
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.ai_generation_reserve('cccccccc-0000-0000-0000-000000000003', 'profile.rewrite', 700, NULL)->>'status';" | tail -n 1 > "$TEST_DIR/race.$i" &
done
wait
reserved="$(cat "$TEST_DIR"/race.* | grep -c '^reserved$' || true)"
in_flight="$(cat "$TEST_DIR"/race.* | grep -c '^in-flight$' || true)"
if [[ "$reserved" != "1" || "$in_flight" != "7" ]]; then
  echo "FAILED: eight simultaneous reservations gave $reserved reserved and $in_flight in flight; expected 1 and 7." >&2
  exit 1
fi

# ── Many contractors at once against the service ceiling ──────────────────────
"${PSQL[@]}" -q >/dev/null <<'SQL'
DELETE FROM public.ai_generation_attempts;
UPDATE public.ai_generation_limits SET per_day_attempts = 3 WHERE scope = 'global';
INSERT INTO auth.users SELECT ('eeeeeeee-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid FROM generate_series(1, 10) n;
SQL
for i in 01 02 03 04 05 06 07 08 09 10; do
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.ai_generation_reserve('eeeeeeee-0000-0000-0000-0000000000$i', 'profile.rewrite', 700, NULL)->>'status';" | tail -n 1 > "$TEST_DIR/global.$i" &
done
wait
reserved="$(cat "$TEST_DIR"/global.* | grep -c '^reserved$' || true)"
refused="$(cat "$TEST_DIR"/global.* | grep -c '^service-limit$' || true)"
if [[ "$reserved" != "3" || "$refused" != "7" ]]; then
  echo "FAILED: ten contractors at once against a service ceiling of 3 gave $reserved reserved and $refused refused; expected 3 and 7." >&2
  exit 1
fi

echo "ai budget: reservation, shared pool, exact limits, no free failures, immutable finish and isolation hold"
