#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-proposal-security.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55449}"

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

CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;

CREATE TABLE public.organizations (id uuid PRIMARY KEY);
CREATE TABLE public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  organization_id uuid REFERENCES public.organizations(id),
  is_archived boolean DEFAULT false,
  proposal_status text,
  proposal_accepted_at timestamptz,
  proposal_accepted_by text,
  proposal_token text,
  proposal_sent_at timestamptz,
  client_email text,
  status text
);
CREATE TABLE public.estimates (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  is_active boolean DEFAULT true,
  total_cost numeric DEFAULT 0,
  prelims_pct numeric DEFAULT 0,
  overhead_pct numeric DEFAULT 0,
  risk_pct numeric DEFAULT 0,
  profit_pct numeric DEFAULT 0
);
CREATE TABLE public.estimate_lines (
  id uuid PRIMARY KEY,
  estimate_id uuid NOT NULL REFERENCES public.estimates(id),
  trade_section text,
  line_total numeric
);

GRANT SELECT ON public.organization_members, public.projects, public.estimates,
  public.estimate_lines TO authenticated;
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20260930150000_proposal_publication_foundation.sql" >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.resolve_proposal_publication(text,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.resolve_proposal_publication(text,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.respond_to_proposal_publication(text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.respond_to_proposal_publication(text,text,text,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_proposal_delivery_attempt(uuid,boolean,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_proposal_receipt_delivery(uuid,text,boolean,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Server-only publication RPC is executable by a browser role.';
  END IF;

  IF NOT has_function_privilege('authenticated',
      'public.publish_proposal_publication(uuid,uuid,uuid,integer,text,jsonb,text,numeric,numeric,numeric,numeric,timestamptz,integer,timestamptz,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated owners cannot execute the guarded publish RPC.';
  END IF;

  IF has_table_privilege('authenticated', 'public.proposal_publications', 'INSERT')
     OR has_table_privilege('authenticated', 'public.proposal_publications', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.proposal_publications', 'DELETE')
     OR has_table_privilege('authenticated', 'public.proposal_publication_events', 'INSERT')
     OR has_table_privilege('authenticated', 'public.proposal_delivery_attempts', 'UPDATE') THEN
    RAISE EXCEPTION 'Authenticated users have direct publication-ledger mutation privileges.';
  END IF;
END;
$$;

INSERT INTO auth.users(id) VALUES
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.organizations(id) VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.organization_members(organization_id, user_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
INSERT INTO public.projects(id, user_id, organization_id, status) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Estimating'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Estimating');

INSERT INTO public.proposal_publications (
  id, project_id, organization_id, owner_user_id, version_number, token_hash,
  snapshot, snapshot_hash, contract_sum_ex_vat, vat_rate, vat_amount,
  contract_sum_inc_vat, sent_at, validity_days, expires_at
) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', 1, repeat('a', 64),
    '{"schema_version":1,"publication":{"id":"30000000-0000-0000-0000-000000000001","version_number":1,"sent_at":"2026-09-30T00:00:00Z","expires_at":"2026-10-30T00:00:00Z","validity_days":30},"commercial":{"contract_sum_ex_vat":100,"vat_rate":20,"vat_amount":20,"contract_sum_inc_vat":120}}',
    repeat('b', 64), 100, 20, 20, 120, '2026-09-30T00:00:00Z', 30, '2026-10-30T00:00:00Z'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002', 1, repeat('c', 64),
    '{"schema_version":1,"publication":{"id":"30000000-0000-0000-0000-000000000002","version_number":1,"sent_at":"2026-09-30T00:00:00Z","expires_at":"2026-10-30T00:00:00Z","validity_days":30},"commercial":{"contract_sum_ex_vat":200,"vat_rate":20,"vat_amount":40,"contract_sum_inc_vat":240}}',
    repeat('d', 64), 200, 20, 40, 240, '2026-09-30T00:00:00Z', 30, '2026-10-30T00:00:00Z'
  );

INSERT INTO public.proposal_delivery_attempts (
  id, publication_id, organization_id, owner_user_id, recipient_email
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'client@example.test'
);

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $$
BEGIN
  IF (SELECT count(*) FROM public.proposal_publications) <> 1 THEN
    RAISE EXCEPTION 'Owner RLS did not isolate proposal publications.';
  END IF;
  IF (SELECT count(*) FROM public.proposal_delivery_attempts) <> 1 THEN
    RAISE EXCEPTION 'Owner RLS did not isolate delivery attempts.';
  END IF;
END;
$$;
RESET ROLE;

SET ROLE service_role;
SELECT * FROM public.record_proposal_delivery_attempt(
  '40000000-0000-0000-0000-000000000001', true, 'provider-1', null
);
SELECT public.record_proposal_receipt_delivery(
  '30000000-0000-0000-0000-000000000001', 'client', true, 'receipt-provider-1', null
);
SELECT public.record_proposal_receipt_delivery(
  '30000000-0000-0000-0000-000000000001', 'client', true, 'receipt-provider-1', null
);
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.proposal_delivery_attempts
     WHERE id = '40000000-0000-0000-0000-000000000001'
       AND status = 'sent' AND attempt_count = 1 AND provider_message_id = 'provider-1'
  ) THEN
    RAISE EXCEPTION 'Service-role delivery result was not recorded.';
  END IF;
  IF (SELECT count(*) FROM public.proposal_publication_events
     WHERE publication_id = '30000000-0000-0000-0000-000000000001'
       AND event_type = 'client_receipt_sent'
       AND details->>'provider_message_id' = 'receipt-provider-1'
  ) <> 1 THEN
    RAISE EXCEPTION 'Service-role receipt result was not recorded idempotently.';
  END IF;
END;
$$;
SQL

echo "proposal-publication-security-suite: pass"
