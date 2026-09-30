#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-org-security.XXXXXX")"
PORT="${CONSTRUCTA_ORG_TEST_PG_PORT:-55450}"

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

"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  active_organization_id uuid REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'Member'
    CHECK (role IN ('Owner', 'Admin', 'Member')),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_member_select_own" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "org_member_insert_owner" ON public.organization_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members
  TO authenticated;

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ BEGIN RETURN NEW; END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE FUNCTION public.get_my_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$ SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() $$;
SQL

"${PSQL[@]}" \
  -f "$ROOT_DIR/supabase/migrations/20260930170000_secure_organization_membership.sql" \
  >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.organization_members', 'INSERT')
     OR has_table_privilege('authenticated', 'public.organization_members', 'INSERT')
     OR has_table_privilege('authenticated', 'public.organization_members', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.organization_members', 'DELETE') THEN
    RAISE EXCEPTION 'A browser role can still mutate organization membership.';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.organization_members', 'SELECT') THEN
    RAISE EXCEPTION 'Authenticated users lost the membership read needed by the app.';
  END IF;

  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_my_organizations()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A browser role can directly execute a restricted organization helper.';
  END IF;

  IF NOT has_function_privilege(
      'authenticated', 'public.get_my_organizations()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated RLS evaluation cannot use the organization helper.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'organization_members'
       AND policyname = 'org_member_insert_owner'
  ) THEN
    RAISE EXCEPTION 'Unsafe self-membership insert policy still exists.';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'public'
       AND procedure.proname IN ('handle_new_user', 'get_my_organizations')
       AND EXISTS (
         SELECT 1
           FROM unnest(procedure.proconfig) AS setting
          WHERE setting LIKE 'search_path=%'
       )
  ) <> 2 THEN
    RAISE EXCEPTION 'Organization helper search_path is not fixed.';
  END IF;
END;
$$;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'owner@example.test',
  '{"full_name":"Test Owner"}'
);
INSERT INTO public.organizations (id, name)
VALUES ('10000000-0000-0000-0000-000000000002', 'Another Tenant');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.profiles profile
      JOIN public.organization_members membership
        ON membership.user_id = profile.id
       AND membership.organization_id = profile.active_organization_id
     WHERE profile.id = '00000000-0000-0000-0000-000000000001'
       AND membership.role = 'Owner'
  ) THEN
    RAISE EXCEPTION 'Trigger-only signup bootstrap did not create the owner membership.';
  END IF;
END;
$$;
SQL

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Owner'
);
SQL
then
  echo "organization-membership-security-suite: authenticated insert unexpectedly succeeded" >&2
  exit 1
fi

echo "organization-membership-security-suite: pass"
