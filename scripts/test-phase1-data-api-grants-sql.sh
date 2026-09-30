#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-phase1-grants.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55453}"

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
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.organizations (id uuid PRIMARY KEY);
CREATE TABLE public.organization_members (organization_id uuid, user_id uuid);
CREATE TABLE public.projects (id uuid PRIMARY KEY);
CREATE TABLE public.estimates (id uuid PRIMARY KEY);
CREATE TABLE public.estimate_lines (id uuid PRIMARY KEY);
CREATE TABLE public.estimate_line_components (id uuid PRIMARY KEY);
CREATE TABLE public.rate_buildups (id uuid PRIMARY KEY);
CREATE TABLE public.cost_library_items (id uuid PRIMARY KEY);
CREATE TABLE public.labour_rates (id uuid PRIMARY KEY);
CREATE TABLE public.estimate_dependencies (id uuid PRIMARY KEY);
CREATE TABLE public.proposal_publications (id uuid PRIMARY KEY);
CREATE TABLE public.proposal_publication_events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
CREATE TABLE public.proposal_delivery_attempts (id uuid PRIMARY KEY);

-- Model a historical project with broad inherited Data API privileges.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO PUBLIC, anon, authenticated;
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261001000000_phase1_data_api_grants.sql" >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'organizations', 'organization_members', 'projects',
    'estimates', 'estimate_lines', 'estimate_line_components',
    'rate_buildups', 'cost_library_items', 'labour_rates',
    'estimate_dependencies', 'proposal_publications',
    'proposal_publication_events', 'proposal_delivery_attempts'
  ] LOOP
    IF has_table_privilege('anon', 'public.' || table_name, 'SELECT')
       OR has_table_privilege('anon', 'public.' || table_name, 'INSERT')
       OR has_table_privilege('anon', 'public.' || table_name, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || table_name, 'DELETE') THEN
      RAISE EXCEPTION 'anon retains a privilege on public.%', table_name;
    END IF;
    IF NOT has_table_privilege(
         'service_role', 'public.' || table_name,
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
       ) THEN
      RAISE EXCEPTION 'service_role lacks access to public.%', table_name;
    END IF;
    IF NOT (
      SELECT relrowsecurity
        FROM pg_class
       WHERE oid = ('public.' || table_name)::regclass
    ) THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', table_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT,INSERT,UPDATE')
     OR has_table_privilege('authenticated', 'public.profiles', 'DELETE')
     OR NOT has_table_privilege('authenticated', 'public.organizations', 'SELECT')
     OR has_table_privilege('authenticated', 'public.organizations', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.organization_members', 'SELECT')
     OR has_table_privilege('authenticated', 'public.organization_members', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.projects', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.estimates', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.estimate_lines', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.estimate_line_components', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.rate_buildups', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.labour_rates', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.estimate_dependencies', 'SELECT,INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.cost_library_items', 'SELECT')
     OR has_table_privilege('authenticated', 'public.cost_library_items', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.proposal_publications', 'SELECT')
     OR has_table_privilege('authenticated', 'public.proposal_publications', 'INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.proposal_publication_events', 'SELECT')
     OR has_table_privilege('authenticated', 'public.proposal_publication_events', 'INSERT,UPDATE,DELETE')
     OR NOT has_table_privilege('authenticated', 'public.proposal_delivery_attempts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.proposal_delivery_attempts', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'authenticated Phase 1 grant matrix is not least privilege';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'organizations', 'organization_members', 'projects',
    'estimates', 'estimate_lines', 'estimate_line_components',
    'rate_buildups', 'cost_library_items', 'labour_rates',
    'estimate_dependencies', 'proposal_publications',
    'proposal_publication_events', 'proposal_delivery_attempts'
  ] LOOP
    IF has_table_privilege(
         'authenticated', 'public.' || table_name,
         'TRUNCATE,REFERENCES,TRIGGER'
       ) THEN
      RAISE EXCEPTION 'authenticated retains administrative privilege on public.%', table_name;
    END IF;
  END LOOP;

  IF has_sequence_privilege(
       'anon', 'public.proposal_publication_events_id_seq', 'USAGE'
     )
     OR has_sequence_privilege(
       'authenticated', 'public.proposal_publication_events_id_seq', 'USAGE'
     )
     OR NOT has_sequence_privilege(
       'service_role', 'public.proposal_publication_events_id_seq', 'USAGE'
     ) THEN
    RAISE EXCEPTION 'proposal event sequence privileges are not least privilege';
  END IF;
END;
$$;

CREATE FUNCTION public.future_object_must_be_explicit() RETURNS void
LANGUAGE sql AS $$ SELECT $$;
CREATE TABLE public.future_table_must_be_explicit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.future_object_must_be_explicit()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.future_object_must_be_explicit()', 'EXECUTE') THEN
    RAISE EXCEPTION 'future function inherited browser execution privilege';
  END IF;
  IF has_table_privilege('anon', 'public.future_table_must_be_explicit', 'SELECT')
     OR has_table_privilege('authenticated', 'public.future_table_must_be_explicit', 'SELECT')
     OR has_sequence_privilege(
       'anon', 'public.future_table_must_be_explicit_id_seq', 'USAGE'
     )
     OR has_sequence_privilege(
       'authenticated', 'public.future_table_must_be_explicit_id_seq', 'USAGE'
     ) THEN
    RAISE EXCEPTION 'future table or sequence inherited browser privilege';
  END IF;
END;
$$;
SQL

echo "phase1-data-api-grants-suite: pass"
