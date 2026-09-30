#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-cost-library.XXXXXX")"
PORT="${CONSTRUCTA_COST_LIBRARY_TEST_PG_PORT:-55452}"

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

CREATE TABLE public.cost_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  tenant_id uuid,
  code text,
  description text,
  base_rate numeric,
  is_system_default boolean NOT NULL DEFAULT false
);

ALTER TABLE public.cost_library_items DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Users Manage Own Resources" ON public.cost_library_items
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read System Items" ON public.cost_library_items
  FOR SELECT USING (is_system_default);
GRANT ALL ON public.cost_library_items TO authenticated;

INSERT INTO public.cost_library_items (
  id, user_id, tenant_id, code, description, base_rate, is_system_default
) VALUES
  (
    '10000000-0000-0000-0000-000000000001', NULL, NULL,
    'SYS-1', 'System item', 10, true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'USR-1', 'Legacy custom item', 20, false
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'USR-2', 'Other tenant item', 30, false
  );
SQL

"${PSQL[@]}" \
  -f "$ROOT_DIR/supabase/migrations/20260930190000_lock_cost_library_items.sql" \
  >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT (
    SELECT relrowsecurity
      FROM pg_class
     WHERE oid = 'public.cost_library_items'::regclass
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on cost_library_items.';
  END IF;

  IF has_table_privilege('anon', 'public.cost_library_items', 'SELECT')
     OR has_table_privilege('authenticated', 'public.cost_library_items', 'INSERT')
     OR has_table_privilege('authenticated', 'public.cost_library_items', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.cost_library_items', 'DELETE') THEN
    RAISE EXCEPTION 'A browser role retained unsafe cost-library privileges.';
  END IF;

  IF NOT has_table_privilege(
    'authenticated', 'public.cost_library_items', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Authenticated estimating lost system-catalogue read access.';
  END IF;
END;
$$;

SET ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.cost_library_items) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.cost_library_items
        WHERE code = 'SYS-1' AND is_system_default IS TRUE
     ) THEN
    RAISE EXCEPTION 'Authenticated RLS did not isolate the system catalogue.';
  END IF;
END;
$$;
RESET ROLE;

SET ROLE service_role;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.cost_library_items) <> 3 THEN
    RAISE EXCEPTION 'Service role cannot inspect quarantined legacy rows.';
  END IF;
END;
$$;
RESET ROLE;
SQL

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
INSERT INTO public.cost_library_items (code, description, base_rate)
VALUES ('ATTACK', 'Unauthorized item', 0);
SQL
then
  echo "cost-library-rls-suite: authenticated insert unexpectedly succeeded" >&2
  exit 1
fi

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
UPDATE public.cost_library_items SET base_rate = 0 WHERE code = 'SYS-1';
SQL
then
  echo "cost-library-rls-suite: authenticated system mutation unexpectedly succeeded" >&2
  exit 1
fi

echo "cost-library-rls-suite: pass"
