#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-definer-security.XXXXXX")"
PORT="${CONSTRUCTA_DEFINER_TEST_PG_PORT:-55451}"

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

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY,
  requests_total integer NOT NULL DEFAULT 0
);

CREATE FUNCTION public.create_valuation_and_invoice(
  uuid, uuid, text, numeric, text DEFAULT 'Interim'
) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT $1 $$;
CREATE FUNCTION public.get_effective_rate(uuid, uuid)
RETURNS numeric LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1::numeric $$;
CREATE FUNCTION public.increment_api_key_requests(uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT $$;
CREATE FUNCTION public.fn_benchmark_on_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END $$;
CREATE FUNCTION public.fn_cv_band(numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'legacy'::text $$;
SQL

"${PSQL[@]}" \
  -f "$ROOT_DIR/supabase/migrations/20260930180000_harden_legacy_definer_functions.sql" \
  >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF to_regprocedure(
       'public.create_valuation_and_invoice(uuid,uuid,text,numeric,text)'
     ) IS NOT NULL
     OR to_regprocedure('public.get_effective_rate(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Dead legacy definer RPC was retained.';
  END IF;

  IF has_function_privilege(
       'anon', 'public.increment_api_key_requests(uuid)', 'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated', 'public.increment_api_key_requests(uuid)', 'EXECUTE'
     )
     OR has_function_privilege(
       'anon', 'public.fn_benchmark_on_archive()', 'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated', 'public.fn_benchmark_on_archive()', 'EXECUTE'
     )
     OR has_function_privilege(
       'anon', 'public.fn_cv_band(numeric)', 'EXECUTE'
     )
     OR has_function_privilege(
       'authenticated', 'public.fn_cv_band(numeric)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'A browser role can execute a service-only helper.';
  END IF;

  IF NOT has_function_privilege(
       'service_role', 'public.increment_api_key_requests(uuid)', 'EXECUTE'
     )
     OR NOT has_function_privilege(
       'service_role', 'public.fn_cv_band(numeric)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Service role lost an approved helper.';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'public'
       AND procedure.proname IN (
         'increment_api_key_requests', 'fn_benchmark_on_archive', 'fn_cv_band'
       )
       AND EXISTS (
         SELECT 1
           FROM unnest(procedure.proconfig) AS setting
          WHERE setting LIKE 'search_path=%'
       )
  ) <> 3 THEN
    RAISE EXCEPTION 'A retained helper has a mutable search path.';
  END IF;
END;
$$;

INSERT INTO public.api_keys (id)
VALUES ('00000000-0000-0000-0000-000000000001');

SET ROLE service_role;
SELECT public.increment_api_key_requests(
  '00000000-0000-0000-0000-000000000001'
);
RESET ROLE;

DO $$
BEGIN
  IF (SELECT requests_total FROM public.api_keys
       WHERE id = '00000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Service-only API counter update failed.';
  END IF;
END;
$$;
SQL

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
SELECT public.increment_api_key_requests(
  '00000000-0000-0000-0000-000000000001'
);
SQL
then
  echo "legacy-definer-security-suite: authenticated RPC unexpectedly succeeded" >&2
  exit 1
fi

echo "legacy-definer-security-suite: pass"
