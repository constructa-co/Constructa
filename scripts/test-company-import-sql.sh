#!/usr/bin/env bash
# Stage 2G.2: company import drafts are tenant-owned and replayable.
#
# Runs the migration in a throwaway local Postgres and proves that:
#   - it applies cleanly, and a second copy of the schema is not needed;
#   - a contractor can create, read, update and delete only their own drafts;
#   - another contractor sees none of them and cannot change, take over or
#     delete them, and cannot create a draft in someone else's name;
#   - a signed-out visitor cannot reach the table at all;
#   - where a draft came from cannot be rewritten after it is made;
#   - a draft, approved or not, never changes the profile a proposal is
#     built from.
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
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  company_name text,
  phone text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

INSERT INTO auth.users VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002');
INSERT INTO public.profiles VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Builders', '01000 000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Beta Joinery', '02000 000002');
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261007120000_company_import_drafts.sql" >/dev/null

"${PSQL[@]}" >/dev/null <<'SQL'
CREATE FUNCTION pg_temp.expect(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', message; END IF;
END $$;

CREATE FUNCTION pg_temp.refused(statement text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE statement;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END $$;

-- Alpha makes a draft. The owner is taken from the session, not from the row.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

INSERT INTO public.company_import_drafts (id, source_url, website, permission_confirmed_at, fetched_at, pages, items)
VALUES (
  '11111111-0000-0000-0000-000000000001',
  'https://www.alphabuilders.co.uk/', 'https://www.alphabuilders.co.uk',
  now(), now(),
  '["https://www.alphabuilders.co.uk/"]',
  '[{"field":"phone","proposed":"01999 999999","existing":"01000 000001","status":"pending"}]'
);

SELECT pg_temp.expect((SELECT user_id FROM public.company_import_drafts) = 'aaaaaaaa-0000-0000-0000-000000000001', 'the draft belongs to the contractor who made it');
SELECT pg_temp.expect((SELECT phone FROM public.profiles WHERE id = auth.uid()) = '01000 000001', 'making a draft does not change the profile');

SELECT pg_temp.expect(pg_temp.refused($q$
  INSERT INTO public.company_import_drafts (user_id, source_url, website, permission_confirmed_at, fetched_at)
  VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'https://x.co.uk/', 'https://x.co.uk', now(), now())
$q$), 'a draft cannot be created in another contractor''s name');
SELECT pg_temp.expect(pg_temp.refused($q$
  INSERT INTO public.company_import_drafts (source_url, website, permission_confirmed_at, fetched_at)
  VALUES ('file:///etc/passwd', 'https://x.co.uk', now(), now())
$q$), 'only http and https sources are recorded');
SELECT pg_temp.expect(pg_temp.refused($q$
  INSERT INTO public.company_import_drafts (source_url, website, fetched_at)
  VALUES ('https://x.co.uk/', 'https://x.co.uk', now())
$q$), 'a draft cannot exist without confirmed permission');
SELECT pg_temp.expect(pg_temp.refused($q$
  INSERT INTO public.company_import_drafts (source_url, website, permission_confirmed_at, fetched_at, items)
  VALUES ('https://x.co.uk/', 'https://x.co.uk', now(), now(), '{"not":"a list"}')
$q$), 'items must be a list');

-- Approval state can change; the source cannot.
UPDATE public.company_import_drafts
SET items = '[{"field":"phone","proposed":"01999 999999","existing":"01000 000001","status":"applied"}]';
SELECT pg_temp.expect((SELECT items->0->>'status' FROM public.company_import_drafts) = 'applied', 'the owner can record an approval');
SELECT pg_temp.expect((SELECT phone FROM public.profiles WHERE id = auth.uid()) = '01000 000001', 'recording an approval on a draft does not itself change the profile');
SELECT pg_temp.expect(pg_temp.refused($q$ UPDATE public.company_import_drafts SET source_url = 'https://elsewhere.co.uk/' $q$), 'the source address is fixed');
SELECT pg_temp.expect(pg_temp.refused($q$ UPDATE public.company_import_drafts SET fetched_at = now() + interval '1 day' $q$), 'the fetch time is fixed');
SELECT pg_temp.expect(pg_temp.refused($q$ UPDATE public.company_import_drafts SET permission_confirmed_at = now() + interval '1 day' $q$), 'the permission time is fixed');
SELECT pg_temp.expect(pg_temp.refused($q$ UPDATE public.company_import_drafts SET user_id = 'bbbbbbbb-0000-0000-0000-000000000002' $q$), 'a draft cannot be handed to another contractor');

-- Beta sees and changes nothing of Alpha's.
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
SELECT pg_temp.expect((SELECT count(*) FROM public.company_import_drafts) = 0, 'another contractor sees no drafts');
WITH changed AS (UPDATE public.company_import_drafts SET items = '[]' RETURNING 1)
SELECT pg_temp.expect((SELECT count(*) FROM changed) = 0, 'another contractor cannot change a draft');
WITH removed AS (DELETE FROM public.company_import_drafts RETURNING 1)
SELECT pg_temp.expect((SELECT count(*) FROM removed) = 0, 'another contractor cannot delete a draft');
SELECT pg_temp.expect(pg_temp.refused($q$
  INSERT INTO public.company_import_drafts (id, source_url, website, permission_confirmed_at, fetched_at)
  VALUES ('11111111-0000-0000-0000-000000000001', 'https://x.co.uk/', 'https://x.co.uk', now(), now())
$q$), 'another contractor cannot replace a draft by reusing its id');

-- A signed-out visitor has no access to the table.
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT pg_temp.expect(pg_temp.refused('SELECT 1 FROM public.company_import_drafts'), 'a signed-out visitor cannot read drafts');
SELECT pg_temp.expect(pg_temp.refused($q$
  INSERT INTO public.company_import_drafts (source_url, website, permission_confirmed_at, fetched_at)
  VALUES ('https://x.co.uk/', 'https://x.co.uk', now(), now())
$q$), 'a signed-out visitor cannot create drafts');

-- Alpha's draft is intact, and Alpha can remove it.
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
SELECT pg_temp.expect((SELECT count(*) FROM public.company_import_drafts WHERE items->0->>'status' = 'applied') = 1, 'the owner''s draft is untouched');
DELETE FROM public.company_import_drafts;
SELECT pg_temp.expect((SELECT count(*) FROM public.company_import_drafts) = 0, 'the owner can delete their draft');

RESET ROLE;
SELECT pg_temp.expect(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.company_import_drafts'::regclass),
  'row level security is on');
SQL

echo "company import drafts: migration replays and tenant isolation holds"
