#!/usr/bin/env bash
# Stage 2G.2: company import drafts keep their provenance, budget and tenancy.
#
# Runs the migration in a throwaway local Postgres and proves that:
#   - it applies cleanly;
#   - a signed-in contractor can read their own drafts and do nothing else:
#     no forged draft, no edited suggestion, no faked approval, no deletion,
#     no direct call to any of the server-only functions;
#   - another contractor and a signed-out visitor can do nothing at all;
#   - the fetch budget is reserved before a read, counts failed reads, allows
#     six an hour and one at a time, and holds under simultaneous calls;
#   - an approval changes the profile and records itself together or not at
#     all, never overwrites a value that changed, never writes a column
#     outside the import's list, never crosses tenants, and is refused once
#     the draft has expired.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-company-import.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55452}"

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
  company_name text, website text, company_number text, vat_number text,
  specialisms text, phone text, sales_email text, address text,
  capability_statement text
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
INSERT INTO public.profiles (id, company_name, phone, specialisms, capability_statement) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Builders', '01000 000001', '', 'Alpha in its own words'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Beta Joinery', '02000 000002', NULL, NULL),
  ('cccccccc-0000-0000-0000-000000000003', 'Gamma Roofing', '03000 000003', NULL, NULL);
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261007120000_company_import_drafts.sql" >/dev/null

# Shared helpers, created as ordinary functions so every session can use them.
"${PSQL[@]}" >/dev/null <<'SQL'
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO anon, authenticated, service_role;
CREATE FUNCTION t.expect(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', message; END IF;
END $$;
-- True when the statement is refused for lack of privilege or by a policy.
CREATE FUNCTION t.denied(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION
  WHEN insufficient_privilege THEN RETURN true;
END $$;
CREATE FUNCTION t.fails(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated, service_role;
SQL

# ── Budget: reserved before a read, failed reads counted, six an hour ─────────
"${PSQL[@]}" >/dev/null <<'SQL'
SET ROLE service_role;
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''

SELECT public.company_import_reserve_attempt(:alpha) AS first \gset
SELECT t.expect((:'first'::jsonb)->>'status' = 'reserved', 'the first read is reserved');
SELECT t.expect(public.company_import_reserve_attempt(:alpha)->>'status' = 'in-flight', 'a second read cannot start while one is running');
SELECT t.expect(public.company_import_reserve_attempt(:beta)->>'status' = 'reserved', 'another contractor is not held up');

-- The read fails. It still counts.
SELECT public.company_import_finish_attempt(:alpha, ((:'first'::jsonb)->>'attempt_id')::uuid, 'failed:unavailable');
SELECT t.expect((SELECT outcome FROM public.company_import_attempts WHERE id = ((:'first'::jsonb)->>'attempt_id')::uuid) = 'failed:unavailable', 'a failed read is recorded');

-- Someone else's attempt cannot be closed.
SELECT public.company_import_finish_attempt(:alpha, (SELECT id FROM public.company_import_attempts WHERE user_id = :beta), 'hijack');
SELECT t.expect((SELECT finished_at IS NULL FROM public.company_import_attempts WHERE user_id = :beta), 'an attempt can only be closed for its own contractor');

DO $$
DECLARE r jsonb;
BEGIN
  FOR i IN 2..6 LOOP
    r := public.company_import_reserve_attempt('aaaaaaaa-0000-0000-0000-000000000001');
    PERFORM t.expect(r->>'status' = 'reserved', format('read %s of 6 is allowed', i));
    PERFORM public.company_import_finish_attempt('aaaaaaaa-0000-0000-0000-000000000001', (r->>'attempt_id')::uuid, 'failed:timeout');
  END LOOP;
END $$;
SELECT t.expect(public.company_import_reserve_attempt(:alpha)->>'status' = 'rate-limited', 'the seventh read in an hour is refused, though all six failed');
SELECT t.expect((SELECT count(*) FROM public.company_import_attempts WHERE user_id = :alpha) = 6, 'a refused read reserves nothing');

-- An hour later the budget is back.
UPDATE public.company_import_attempts SET started_at = started_at - interval '61 minutes', finished_at = finished_at - interval '61 minutes' WHERE user_id = :alpha;
SELECT t.expect(public.company_import_reserve_attempt(:alpha)->>'status' = 'reserved', 'the budget returns after an hour');

-- A read that never reported back stops blocking after two minutes, and still counts.
SELECT t.expect(public.company_import_reserve_attempt(:beta)->>'status' = 'in-flight', 'a running read blocks');
UPDATE public.company_import_attempts SET started_at = now() - interval '3 minutes' WHERE user_id = :beta;
SELECT t.expect(public.company_import_reserve_attempt(:beta)->>'status' = 'reserved', 'an abandoned read stops blocking');
SELECT t.expect((SELECT count(*) FROM public.company_import_attempts WHERE user_id = :beta AND outcome = 'abandoned') = 1, 'the abandoned read is recorded');
SELECT t.expect(t.fails($q$ INSERT INTO public.company_import_attempts (user_id) VALUES ('bbbbbbbb-0000-0000-0000-000000000002') $q$), 'the schema itself refuses a second read in flight');
SQL

# ── Budget under simultaneous calls ───────────────────────────────────────────
for i in 1 2 3 4 5 6 7 8; do
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.company_import_reserve_attempt('cccccccc-0000-0000-0000-000000000003')->>'status';" > "$TEST_DIR/race.$i" &
done
wait
reserved="$(cat "$TEST_DIR"/race.* | grep -c '^reserved$' || true)"
in_flight="$(cat "$TEST_DIR"/race.* | grep -c '^in-flight$' || true)"
if [[ "$reserved" != "1" || "$in_flight" != "7" ]]; then
  echo "FAILED: eight simultaneous reservations gave $reserved reserved and $in_flight in flight; expected 1 and 7." >&2
  exit 1
fi

# ── Drafts, forging and approval ──────────────────────────────────────────────
"${PSQL[@]}" >/dev/null <<'SQL'
\set alpha '''aaaaaaaa-0000-0000-0000-000000000001'''
\set beta  '''bbbbbbbb-0000-0000-0000-000000000002'''
\set ITEMS '''[{"field":"phone","proposed":"01999 999999","existing":"01000 000001","sourceUrl":"https://www.alphabuilders.co.uk/","excerpt":"Phone link","basis":"contact-link","status":"pending","appliedAt":null},{"field":"website","proposed":"https://www.alphabuilders.co.uk","existing":null,"sourceUrl":"https://www.alphabuilders.co.uk/","excerpt":"Confirmed","basis":"confirmed-address","status":"pending","appliedAt":null},{"field":"specialisms","proposed":"Extensions, Lofts","existing":"","sourceUrl":"https://www.alphabuilders.co.uk/services","excerpt":"Headings","basis":"page-heading","status":"pending","appliedAt":null},{"field":"capability_statement","proposed":"FORGED STORY","existing":null,"status":"pending"}]'''

SET ROLE service_role;
-- A draft needs a reserved read of the same contractor.
SELECT t.expect(t.fails($q$ SELECT public.company_import_save_draft('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'https://www.alphabuilders.co.uk/', 'https://www.alphabuilders.co.uk', now(), now(), '[]', '[]') $q$), 'a draft cannot be saved without a reserved read');
SELECT t.expect(t.fails(format($q$ SELECT public.company_import_save_draft('bbbbbbbb-0000-0000-0000-000000000002', %L, 'https://x.co.uk/', 'https://x.co.uk', now(), now(), '[]', '[]') $q$, (SELECT id FROM public.company_import_attempts WHERE user_id = :alpha AND finished_at IS NULL))), 'a draft cannot be saved against another contractor''s read');

SELECT public.company_import_save_draft(
  :alpha, (SELECT id FROM public.company_import_attempts WHERE user_id = :alpha AND finished_at IS NULL),
  'https://www.alphabuilders.co.uk/', 'https://www.alphabuilders.co.uk', now(), now(),
  '["https://www.alphabuilders.co.uk/"]', :ITEMS::jsonb) AS saved \gset
SELECT ((:'saved'::jsonb)->>'id') AS draft_id \gset
SELECT t.expect((:'saved'::jsonb)->>'user_id' = :alpha, 'the draft belongs to the contractor it was read for');
SELECT t.expect(((:'saved'::jsonb)->>'expires_at')::timestamptz BETWEEN now() + interval '23 hours' AND now() + interval '25 hours', 'a draft is good for a day');
SELECT t.expect((SELECT outcome FROM public.company_import_attempts WHERE user_id = :alpha ORDER BY started_at DESC LIMIT 1) = 'drafted', 'saving the draft closes the read');
SELECT t.expect((SELECT phone FROM public.profiles WHERE id = :alpha) = '01000 000001', 'saving a draft does not change the profile');
SELECT t.expect(t.fails($q$ SELECT public.company_import_save_draft('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'file:///etc/passwd', 'https://x.co.uk', now(), now(), '[]', '[]') $q$), 'only http and https sources are recorded');
SELECT t.expect(t.fails(format($q$ UPDATE public.company_import_drafts SET source_url = 'https://elsewhere.co.uk/' WHERE id = %L $q$, :'draft_id')), 'the source address is fixed, even for the server');
SELECT t.expect(t.fails(format($q$ UPDATE public.company_import_drafts SET expires_at = now() + interval '10 years' WHERE id = %L $q$, :'draft_id')), 'the expiry is fixed, even for the server');
SELECT t.expect(t.fails(format($q$ UPDATE public.company_import_drafts SET fetched_at = now() WHERE id = %L $q$, :'draft_id')), 'the fetch time is fixed, even for the server');
RESET ROLE;

-- The owner, from a browser: read only.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT t.expect((SELECT count(*) FROM public.company_import_drafts) = 1, 'the owner can read their draft');
SELECT t.expect(t.denied($q$ INSERT INTO public.company_import_drafts (user_id, source_url, website, permission_confirmed_at, fetched_at, items)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'https://www.alphabuilders.co.uk/', 'https://www.alphabuilders.co.uk', now(), now(),
  '[{"field":"phone","proposed":"0900 FORGED","status":"pending"}]') $q$), 'the owner cannot forge a draft from a browser');
SELECT t.expect(t.denied($q$ UPDATE public.company_import_drafts SET items = jsonb_set(items, '{0,proposed}', '"0900 FORGED"') $q$), 'the owner cannot rewrite a suggested value');
SELECT t.expect(t.denied($q$ UPDATE public.company_import_drafts SET items = jsonb_set(items, '{0,sourceUrl}', '"https://forged.co.uk/"') $q$), 'the owner cannot rewrite where a suggestion came from');
SELECT t.expect(t.denied($q$ UPDATE public.company_import_drafts SET items = jsonb_set(items, '{0,status}', '"applied"') $q$), 'the owner cannot fake an approval');
SELECT t.expect(t.denied($q$ DELETE FROM public.company_import_drafts $q$), 'the owner cannot delete a draft');
SELECT t.expect(t.denied($q$ SELECT 1 FROM public.company_import_attempts $q$), 'the owner cannot read the budget');
SELECT t.expect(t.denied($q$ DELETE FROM public.company_import_attempts $q$), 'the owner cannot clear the budget');
SELECT t.expect(t.denied($q$ INSERT INTO public.company_import_attempts (user_id) VALUES ('aaaaaaaa-0000-0000-0000-000000000001') $q$), 'the owner cannot write the budget');
SELECT t.expect(t.denied($q$ SELECT public.company_import_reserve_attempt('aaaaaaaa-0000-0000-0000-000000000001') $q$), 'a browser cannot reserve a read');
SELECT t.expect(t.denied($q$ SELECT public.company_import_finish_attempt('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'x') $q$), 'a browser cannot close a read');
SELECT t.expect(t.denied($q$ SELECT public.company_import_save_draft('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'https://x.co.uk/', 'https://x.co.uk', now(), now(), '[]', '[]') $q$), 'a browser cannot save a draft');
SELECT t.expect(t.denied(format($q$ SELECT public.company_import_approve_item('aaaaaaaa-0000-0000-0000-000000000001', %L, 'phone', '01000 000001') $q$, :'draft_id')), 'a browser cannot call the approval function');

-- Another contractor: nothing.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
SELECT t.expect((SELECT count(*) FROM public.company_import_drafts) = 0, 'another contractor sees no drafts');
SELECT t.expect(t.denied($q$ UPDATE public.company_import_drafts SET items = '[]' $q$), 'another contractor cannot change a draft');
SELECT t.expect(t.denied($q$ DELETE FROM public.company_import_drafts $q$), 'another contractor cannot delete a draft');
RESET ROLE;

-- A signed-out visitor: nothing.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT t.expect(t.denied('SELECT 1 FROM public.company_import_drafts'), 'a signed-out visitor cannot read drafts');
SELECT t.expect(t.denied($q$ SELECT public.company_import_reserve_attempt('aaaaaaaa-0000-0000-0000-000000000001') $q$), 'a signed-out visitor cannot reserve a read');
SELECT t.expect(t.denied(format($q$ SELECT public.company_import_approve_item('aaaaaaaa-0000-0000-0000-000000000001', %L, 'phone', '01000 000001') $q$, :'draft_id')), 'a signed-out visitor cannot approve');
RESET ROLE;

-- Approval, by the server for the authenticated contractor.
SET ROLE service_role;
SELECT t.expect(public.company_import_approve_item(:beta, :'draft_id', 'phone', '02000 000002')->>'outcome' = 'not-found', 'a draft cannot be approved for another contractor');
SELECT t.expect((SELECT phone FROM public.profiles WHERE id = :beta) = '02000 000002', 'the other contractor''s profile is untouched');

SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'capability_statement', NULL)->>'outcome' = 'unavailable', 'a column outside the import''s list is refused even if a draft names it');
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'phone = ''x'', company_name', NULL)->>'outcome' = 'unavailable', 'the field is a name from a fixed list, never SQL');
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'sales_email', NULL)->>'outcome' = 'unavailable', 'a field with no suggestion cannot be approved');
SELECT t.expect((SELECT capability_statement FROM public.profiles WHERE id = :alpha) = 'Alpha in its own words', 'the company story is untouched');

-- Stale: the profile no longer holds what the contractor was shown.
UPDATE public.profiles SET phone = '01000 222222' WHERE id = :alpha;
SELECT public.company_import_approve_item(:alpha, :'draft_id', 'phone', '01000 000001') AS stale \gset
SELECT t.expect((:'stale'::jsonb)->>'outcome' = 'conflict' AND (:'stale'::jsonb)->>'current' = '01000 222222', 'a changed value is reported, not overwritten');
SELECT t.expect((SELECT phone FROM public.profiles WHERE id = :alpha) = '01000 222222', 'the newer value is kept');
SELECT t.expect((SELECT items->0->>'existing' FROM public.company_import_drafts WHERE id = :'draft_id') = '01000 222222', 'the draft now shows the newer value');
SELECT t.expect((SELECT items->0->>'status' FROM public.company_import_drafts WHERE id = :'draft_id') = 'pending', 'the suggestion is still undecided');

-- Empty and missing are different saved values.
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'specialisms', NULL)->>'outcome' = 'conflict', 'an empty saved value is not "nothing saved"');
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'specialisms', '')->>'outcome' = 'applied', 'approving against the empty value works');
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'website', NULL)->>'outcome' = 'applied', 'approving against no saved value works');

-- Approved knowingly against the newer value: profile and record together.
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'phone', '01000 222222')->>'outcome' = 'applied', 'the contractor can approve against the newer value');
SELECT t.expect((SELECT phone FROM public.profiles WHERE id = :alpha) = '01999 999999', 'the profile holds the value saved in the draft');
SELECT t.expect((SELECT items->0->>'status' = 'applied' AND items->0->>'appliedAt' ~ '^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$' FROM public.company_import_drafts WHERE id = :'draft_id'), 'the approval is recorded with its time');
SELECT t.expect(public.company_import_approve_item(:alpha, :'draft_id', 'phone', '01999 999999')->>'outcome' = 'unavailable', 'a suggestion is approved once');
SELECT t.expect((SELECT company_name FROM public.profiles WHERE id = :alpha) = 'Alpha Builders', 'unapproved fields are untouched');
RESET ROLE;

-- All or nothing: if the approval cannot be recorded, the profile is not changed.
INSERT INTO public.company_import_drafts (id, user_id, source_url, website, permission_confirmed_at, fetched_at, items)
VALUES ('22222222-0000-0000-0000-000000000002', :beta, 'https://www.betajoinery.co.uk/', 'https://www.betajoinery.co.uk', now(), now(),
  '[{"field":"phone","proposed":"02999 999999","existing":"02000 000002","status":"pending"}]');
CREATE FUNCTION t.break_record() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit write failed'; END $$;
CREATE TRIGGER break_record BEFORE UPDATE ON public.company_import_drafts FOR EACH ROW WHEN (NEW.user_id = 'bbbbbbbb-0000-0000-0000-000000000002') EXECUTE FUNCTION t.break_record();
SET ROLE service_role;
SELECT t.expect(t.fails($q$ SELECT public.company_import_approve_item('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'phone', '02000 000002') $q$), 'an approval that cannot be recorded fails');
SELECT t.expect((SELECT phone FROM public.profiles WHERE id = :beta) = '02000 000002', 'and the profile change is rolled back with it');
RESET ROLE;
DROP TRIGGER break_record ON public.company_import_drafts;
SET ROLE service_role;
SELECT t.expect(public.company_import_approve_item(:beta, '22222222-0000-0000-0000-000000000002', 'phone', '02000 000002')->>'outcome' = 'applied', 'the same approval succeeds on retry');
RESET ROLE;

-- Expired: readable, not approvable.
INSERT INTO public.company_import_drafts (id, user_id, source_url, website, permission_confirmed_at, fetched_at, created_at, expires_at, items)
VALUES ('33333333-0000-0000-0000-000000000003', :alpha, 'https://www.alphabuilders.co.uk/', 'https://www.alphabuilders.co.uk',
  now() - interval '25 hours', now() - interval '25 hours', now() - interval '25 hours', now() - interval '1 hour',
  '[{"field":"company_name","proposed":"Alpha Builders Ltd","existing":"Alpha Builders","status":"pending"}]');
SET ROLE service_role;
SELECT t.expect(public.company_import_approve_item(:alpha, '33333333-0000-0000-0000-000000000003', 'company_name', 'Alpha Builders')->>'outcome' = 'expired', 'an expired draft cannot be approved');
SELECT t.expect((SELECT company_name FROM public.profiles WHERE id = :alpha) = 'Alpha Builders', 'and nothing is written from it');
RESET ROLE;

SELECT t.expect((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.company_import_drafts'::regclass, 'public.company_import_attempts'::regclass)), 'row level security is on for both tables');
SELECT t.expect(NOT has_table_privilege('authenticated', 'public.company_import_drafts', 'INSERT, UPDATE, DELETE, TRUNCATE'), 'the browser role holds no write privilege on drafts');
SELECT t.expect(NOT has_table_privilege('authenticated', 'public.company_import_attempts', 'SELECT, INSERT, UPDATE, DELETE'), 'the browser role holds no privilege on the budget');
SQL

# ── Two tabs approving the same suggestion at once ────────────────────────────
"${PSQL[@]}" >/dev/null <<'SQL'
UPDATE public.profiles SET company_name = 'Gamma Roofing' WHERE id = 'cccccccc-0000-0000-0000-000000000003';
INSERT INTO public.company_import_drafts (id, user_id, source_url, website, permission_confirmed_at, fetched_at, items)
VALUES ('44444444-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000003', 'https://www.gammaroofing.co.uk/', 'https://www.gammaroofing.co.uk', now(), now(),
  '[{"field":"company_name","proposed":"Gamma Roofing Ltd","existing":"Gamma Roofing","status":"pending"}]');
SQL
for i in 1 2 3 4 5 6; do
  "${PSQL[@]}" -At -c "SET ROLE service_role; SELECT public.company_import_approve_item('cccccccc-0000-0000-0000-000000000003', '44444444-0000-0000-0000-000000000004', 'company_name', 'Gamma Roofing')->>'outcome';" > "$TEST_DIR/tab.$i" &
done
wait
applied="$(cat "$TEST_DIR"/tab.* | grep -c '^applied$' || true)"
unavailable="$(cat "$TEST_DIR"/tab.* | grep -c '^unavailable$' || true)"
if [[ "$applied" != "1" || "$unavailable" != "5" ]]; then
  echo "FAILED: six simultaneous approvals gave $applied applied and $unavailable unavailable; expected 1 and 5." >&2
  exit 1
fi

echo "company import drafts: provenance, budget, atomic approval and tenant isolation hold"
