#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-supervisor-token.XXXXXX")"
PORT="${CONSTRUCTA_SUPERVISOR_TEST_PG_PORT:-55453}"

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
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL
);
CREATE TABLE public.supervisor_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  token text NOT NULL UNIQUE,
  name text NOT NULL
);
GRANT SELECT ON public.projects TO authenticated;

ALTER TABLE public.supervisor_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_by_token" ON public.supervisor_tokens
  FOR SELECT USING (true);
CREATE POLICY "users_manage_own_supervisor_tokens" ON public.supervisor_tokens
  FOR ALL USING (auth.uid() = user_id);
GRANT SELECT ON public.supervisor_tokens TO anon;
GRANT ALL ON public.supervisor_tokens TO authenticated;

INSERT INTO public.projects (id, user_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.supervisor_tokens (id, user_id, project_id, token, name) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'owner-token', 'Owner Invite'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'other-token', 'Other Invite'
  );
SQL

"${PSQL[@]}" \
  -f "$ROOT_DIR/supabase/migrations/20260930200000_gate_supervisor_portal.sql" \
  >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.supervisor_tokens', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous callers can enumerate supervisor tokens.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'supervisor_tokens'
       AND policyname = 'public_read_by_token'
  ) THEN
    RAISE EXCEPTION 'Enumerable public token policy still exists.';
  END IF;
END;
$$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.supervisor_tokens) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.supervisor_tokens WHERE token = 'owner-token'
     ) THEN
    RAISE EXCEPTION 'Owner token reads are not project isolated.';
  END IF;
END;
$$;
RESET ROLE;
SQL

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
INSERT INTO public.supervisor_tokens (user_id, project_id, token, name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'cross-project-token', 'Cross-project Invite'
);
SQL
then
  echo "supervisor-token-security-suite: cross-project insert unexpectedly succeeded" >&2
  exit 1
fi

echo "supervisor-token-security-suite: pass"
