#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-phase1-grants.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55453}"
MIGRATION_FILE="${CONSTRUCTA_PHASE1_GRANTS_MIGRATION:-$ROOT_DIR/supabase/migrations/20261001000000_phase1_data_api_grants.sql}"

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

-- Model Supabase's broad postgres-owned Data API defaults before creating the
-- historical objects. The migration must close both existing and future ACLs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.profiles (id uuid PRIMARY KEY);
CREATE TABLE public.organizations (id uuid PRIMARY KEY);
CREATE TABLE public.organization_members (organization_id uuid, user_id uuid);
CREATE TABLE public.projects (id uuid PRIMARY KEY);
CREATE TABLE public.estimates (id uuid PRIMARY KEY);
CREATE TABLE public.estimate_lines (id uuid PRIMARY KEY);
CREATE TABLE public.estimate_line_components (id uuid PRIMARY KEY);
CREATE TABLE public.rate_buildups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  unit text NOT NULL,
  built_up_rate numeric NOT NULL,
  trade_section text,
  components jsonb NOT NULL DEFAULT '[]',
  total_manhours_per_unit numeric DEFAULT 0,
  usage_count integer DEFAULT 0,
  is_system_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.cost_library_items (id uuid PRIMARY KEY);
CREATE TABLE public.labour_rates (id uuid PRIMARY KEY);
CREATE TABLE public.estimate_dependencies (id uuid PRIMARY KEY);
CREATE TABLE public.proposal_publications (id uuid PRIMARY KEY);
CREATE TABLE public.proposal_publication_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);
CREATE TABLE public.proposal_delivery_attempts (id uuid PRIMARY KEY);

CREATE POLICY members_self_select ON public.organization_members FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY rbu_select ON public.rate_buildups FOR SELECT
  USING (
    is_system_default IS TRUE OR organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
CREATE POLICY rbu_manage ON public.rate_buildups FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE FUNCTION public.resolve_proposal_publication(text, boolean)
RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.respond_to_proposal_publication(text, text, text, text, text)
RETURNS void LANGUAGE sql AS $$ SELECT $$;
REVOKE ALL ON FUNCTION public.resolve_proposal_publication(text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.respond_to_proposal_publication(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_proposal_publication(text, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_proposal_publication(text, text, text, text, text)
  TO service_role;

INSERT INTO public.organizations (id)
VALUES ('00000000-0000-0000-0000-000000000001'),
       ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.organization_members (organization_id, user_id)
VALUES ('00000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001');

-- Prove this migration supplies the current service-role disposition rather
-- than passing only because the modelled platform defaults already did.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role;
SQL

"${PSQL[@]}" -f "$MIGRATION_FILE" >/dev/null

"${PSQL[@]}" <<'SQL'
CREATE FUNCTION pg_temp.public_has_table_privilege(
  relation_name text,
  requested_privilege text
) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_class AS c
    CROSS JOIN LATERAL aclexplode(
      COALESCE(c.relacl, acldefault('r', c.relowner))
    ) AS acl
    WHERE c.oid = relation_name::regclass
      AND acl.grantee = 0
      AND acl.privilege_type = requested_privilege
  )
$$;

DO $$
DECLARE
  role_name text;
  table_name text;
  privilege_name text;
  actual boolean;
  expected boolean;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['PUBLIC', 'anon', 'authenticated', 'service_role'] LOOP
    FOREACH table_name IN ARRAY ARRAY[
      'profiles', 'organizations', 'organization_members', 'projects',
      'estimates', 'estimate_lines', 'estimate_line_components',
      'rate_buildups', 'cost_library_items', 'labour_rates',
      'estimate_dependencies', 'proposal_publications',
      'proposal_publication_events', 'proposal_delivery_attempts'
    ] LOOP
      FOREACH privilege_name IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'DELETE',
        'TRUNCATE', 'REFERENCES', 'TRIGGER'
      ] LOOP
        expected := role_name = 'service_role'
          OR (
            role_name = 'authenticated' AND CASE table_name
              WHEN 'profiles' THEN privilege_name = ANY (ARRAY['SELECT', 'INSERT', 'UPDATE'])
              WHEN 'organization_members' THEN privilege_name = 'SELECT'
              WHEN 'projects' THEN privilege_name = ANY (ARRAY['SELECT', 'INSERT', 'UPDATE'])
              WHEN 'estimates' THEN privilege_name = ANY (ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
              WHEN 'estimate_lines' THEN privilege_name = ANY (ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
              WHEN 'estimate_line_components' THEN privilege_name = ANY (ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
              WHEN 'rate_buildups' THEN privilege_name = 'SELECT'
              WHEN 'cost_library_items' THEN privilege_name = 'SELECT'
              WHEN 'labour_rates' THEN privilege_name = 'SELECT'
              WHEN 'estimate_dependencies' THEN privilege_name = ANY (ARRAY['SELECT', 'INSERT', 'DELETE'])
              WHEN 'proposal_publications' THEN privilege_name = 'SELECT'
              ELSE false
            END
          );

        IF role_name = 'PUBLIC' THEN
          actual := pg_temp.public_has_table_privilege(
            'public.' || table_name,
            privilege_name
          );
        ELSE
          actual := has_table_privilege(
            role_name,
            'public.' || table_name,
            privilege_name
          );
        END IF;

        IF actual IS DISTINCT FROM expected THEN
          RAISE EXCEPTION 'table privilege mismatch: role=%, table=%, privilege=%, expected=%, actual=%',
            role_name, table_name, privilege_name, expected, actual;
        END IF;
      END LOOP;

      IF NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = ('public.' || table_name)::regclass
      ) THEN
        RAISE EXCEPTION 'RLS is not enabled on public.%', table_name;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

DO $$
DECLARE
  column_name text;
  expected boolean;
  actual boolean;
BEGIN
  FOREACH column_name IN ARRAY ARRAY[
    'id', 'organization_id', 'name', 'unit', 'built_up_rate',
    'trade_section', 'components', 'total_manhours_per_unit',
    'usage_count', 'is_system_default', 'created_at'
  ] LOOP
    expected := column_name = ANY (ARRAY[
      'organization_id', 'name', 'unit', 'built_up_rate',
      'trade_section', 'components', 'total_manhours_per_unit'
    ]);
    actual := has_column_privilege(
      'authenticated',
      'public.rate_buildups',
      column_name,
      'INSERT'
    );
    IF actual IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'rate_buildups INSERT mismatch: column=%, expected=%, actual=%',
        column_name, expected, actual;
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  role_name text;
  privilege_name text;
  actual boolean;
  expected boolean;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH privilege_name IN ARRAY ARRAY['USAGE', 'SELECT', 'UPDATE'] LOOP
      expected := role_name = 'service_role';
      actual := has_sequence_privilege(
        role_name,
        'public.proposal_publication_events_id_seq',
        privilege_name
      );
      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'sequence privilege mismatch: role=%, privilege=%, expected=%, actual=%',
          role_name, privilege_name, expected, actual;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

DO $$
DECLARE
  role_name text;
  function_name text;
  actual boolean;
  expected boolean;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH function_name IN ARRAY ARRAY[
      'public.resolve_proposal_publication(text,boolean)',
      'public.respond_to_proposal_publication(text,text,text,text,text)'
    ] LOOP
      expected := role_name = 'service_role';
      actual := has_function_privilege(role_name, function_name, 'EXECUTE');
      IF actual IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'server RPC privilege mismatch: role=%, function=%, expected=%, actual=%',
          role_name, function_name, expected, actual;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

INSERT INTO public.rate_buildups (
  organization_id, name, unit, trade_section, components,
  built_up_rate, total_manhours_per_unit
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Owned build-up', 'm2', 'Concrete', '[]', 100, 1
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.rate_buildups (
      organization_id, name, unit, trade_section, components,
      built_up_rate, total_manhours_per_unit
    ) VALUES (
      '00000000-0000-0000-0000-000000000002',
      'Cross-tenant build-up', 'm2', 'Concrete', '[]', 9999, 1
    );
    RAISE EXCEPTION 'cross-tenant rate build-up insert unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.rate_buildups (
      organization_id, name, unit, trade_section, components,
      built_up_rate, total_manhours_per_unit, is_system_default
    ) VALUES (
      '00000000-0000-0000-0000-000000000001',
      'Forged system build-up', 'm2', 'Concrete', '[]', 9999, 1, true
    );
    RAISE EXCEPTION 'system-default rate build-up forgery unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

RESET ROLE;
RESET request.jwt.claim.sub;

CREATE FUNCTION public.future_object_must_be_explicit() RETURNS void
LANGUAGE sql AS $$ SELECT $$;
CREATE TABLE public.future_table_must_be_explicit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_function_privilege(
      role_name,
      'public.future_object_must_be_explicit()',
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'future function inherited browser execution privilege: %', role_name;
    END IF;
    IF has_table_privilege(
      role_name,
      'public.future_table_must_be_explicit',
      'SELECT'
    ) OR has_sequence_privilege(
      role_name,
      'public.future_table_must_be_explicit_id_seq',
      'USAGE'
    ) THEN
      RAISE EXCEPTION 'future table or sequence inherited browser privilege: %', role_name;
    END IF;
  END LOOP;

  IF NOT has_function_privilege(
    'service_role',
    'public.future_object_must_be_explicit()',
    'EXECUTE'
  ) OR NOT has_table_privilege(
    'service_role',
    'public.future_table_must_be_explicit',
    'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) OR NOT has_sequence_privilege(
    'service_role',
    'public.future_table_must_be_explicit_id_seq',
    'USAGE,SELECT,UPDATE'
  ) THEN
    RAISE EXCEPTION 'future service_role privileges are incomplete';
  END IF;
END;
$$;
SQL

echo "phase1-data-api-grants-suite: pass"
