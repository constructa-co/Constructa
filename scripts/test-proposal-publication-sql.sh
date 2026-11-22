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
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text
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
  line_total numeric,
  line_type text
);

GRANT SELECT ON public.organization_members, public.projects, public.estimates,
  public.estimate_lines TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Reproduce a historical/default over-grant so the boundary migration must
-- actively remove browser-anonymous access rather than relying on a clean DB.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.profiles TO PUBLIC, anon;
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20260930150000_proposal_publication_foundation.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20260930220000_lock_public_proposal_base_tables.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20261122120000_d92_proposal_price_parity.sql" >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.projects', 'SELECT')
     OR has_table_privilege('anon', 'public.projects', 'INSERT')
     OR has_table_privilege('anon', 'public.projects', 'UPDATE')
     OR has_table_privilege('anon', 'public.projects', 'DELETE')
     OR has_table_privilege('anon', 'public.profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'INSERT')
     OR has_table_privilege('anon', 'public.profiles', 'UPDATE')
     OR has_table_privilege('anon', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'Anonymous browser role retains base proposal-table privileges.';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.projects', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT') THEN
    RAISE EXCEPTION 'Authenticated owner access was removed with the anonymous boundary.';
  END IF;

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

# Exercise the real publish RPC, not a SQL transcription. All rows and RPC
# writes below live only in this script's disposable local Postgres fixture.
"${PSQL[@]}" <<'SQL'
INSERT INTO public.estimates(id, project_id, total_cost, prelims_pct, overhead_pct, risk_pct, profit_pct)
VALUES ('50000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001', 9999, 10, 10, 5, 15);

DO $$
DECLARE
  c record;
  p_id uuid;
  v integer := 1;
  snapshot jsonb;
  sent timestamptz := '2026-11-22T00:00:00Z';
  expiry timestamptz := '2026-12-22T00:00:00Z';
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('plain', '[{"line_total":10000}]'::jsonb, 14610.75::numeric, 10::numeric, 10::numeric, 5::numeric, 15::numeric, 0::numeric),
    ('PC allowance', '[{"line_total":10000},{"line_total":5000,"line_type":"pc_sum"}]'::jsonb, 19610.75, 10,10,5,15,0),
    ('provisional allowance', '[{"line_total":10000},{"line_total":5000,"line_type":"provisional_sum"}]'::jsonb, 19610.75,10,10,5,15,0),
    ('blank prelims', '[{"line_total":10000},{"line_total":0,"trade_section":"Preliminaries"}]'::jsonb, 14610.75,10,10,5,15,0),
    ('credit', '[{"line_total":10000},{"line_total":-500}]'::jsonb, 13880.21,10,10,5,15,0),
    ('explicit prelims', '[{"line_total":10000},{"line_total":500,"trade_section":"Preliminaries"}]'::jsonb, 13946.63,10,10,5,15,0),
    ('credit prelims', '[{"line_total":10000},{"line_total":-500,"trade_section":"Preliminaries"}]'::jsonb, 12618.38,10,10,5,15,0),
    ('face-only ignores stale stored total', '[{"line_total":5000,"line_type":"pc_sum","trade_section":"Preliminaries"}]'::jsonb, 5000,10,10,5,15,25),
    ('zero and legacy fallback', '[{"line_total":0}]'::jsonb, 14609.29,10,10,5,15,0),
    ('unknown type stays ordinary', '[{"line_total":10000,"line_type":"future_type"}]'::jsonb,14610.75,10,10,5,15,0),
    ('groundworks worked example', '[{"line_total":2762.50},{"line_total":1632},{"line_total":1663.20},{"line_total":1320},{"line_total":600,"line_type":"pc_sum"}]'::jsonb,10710.97,8,10,3,12,0),
    ('discount excludes allowance', '[{"line_total":10000},{"line_total":5000,"line_type":"pc_sum"}]'::jsonb,15958.06,10,10,5,15,25)
  ) AS cases(label, lines, expected, prelims, overhead, risk, profit, discount)
  LOOP
    DELETE FROM public.estimate_lines WHERE estimate_id = '50000000-0000-0000-0000-000000000001';
    INSERT INTO public.estimate_lines(id,estimate_id,trade_section,line_total,line_type)
      SELECT gen_random_uuid(), '50000000-0000-0000-0000-000000000001',
             x->>'trade_section', (x->>'line_total')::numeric, x->>'line_type'
      FROM jsonb_array_elements(c.lines) x;
    UPDATE public.estimates SET prelims_pct=c.prelims, overhead_pct=c.overhead,
      risk_pct=c.risk, profit_pct=c.profit, discount_pct=c.discount
      WHERE id='50000000-0000-0000-0000-000000000001';
    v := v+1; p_id := gen_random_uuid();
    snapshot := jsonb_build_object('schema_version',1,
      'project',jsonb_build_object('id','20000000-0000-0000-0000-000000000001'),
      'publication',jsonb_build_object('id',p_id,'version_number',v,'sent_at',sent,'expires_at',expiry,'validity_days',30),
      'commercial',jsonb_build_object('estimate_id','50000000-0000-0000-0000-000000000001',
        'contract_sum_ex_vat',c.expected,'vat_rate',0,'vat_amount',0,'contract_sum_inc_vat',c.expected));
    PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    SET LOCAL ROLE authenticated;
    BEGIN
      PERFORM public.publish_proposal_publication('20000000-0000-0000-0000-000000000001',p_id,
        '50000000-0000-0000-0000-000000000001',v,encode(sha256(p_id::text::bytea),'hex'),snapshot,
        repeat('f',64),c.expected+0.01,0,0,c.expected+0.01,sent,30,expiry,NULL);
      RAISE EXCEPTION 'Wrong price accepted: %',c.label;
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM <> 'Published contract sum does not match the active estimate.' THEN RAISE; END IF;
    END;
    PERFORM public.publish_proposal_publication('20000000-0000-0000-0000-000000000001',p_id,
      '50000000-0000-0000-0000-000000000001',v,encode(sha256(p_id::text::bytea),'hex'),snapshot,
      repeat('f',64),c.expected,0,0,c.expected,sent,30,expiry,NULL);
    RESET ROLE;
    IF NOT EXISTS (SELECT 1 FROM public.proposal_publications WHERE id=p_id AND contract_sum_ex_vat=c.expected) THEN
      RAISE EXCEPTION 'Price not persisted: %',c.label;
    END IF;
    RAISE NOTICE 'publish parity PASS: % = %',c.label,c.expected;
  END LOOP;
END;
$$;

-- Future held #176 compatibility, without making a production column/default.
ALTER TABLE public.estimates ADD COLUMN markup_method text;
UPDATE public.estimates SET markup_method='on_net',prelims_pct=10,overhead_pct=10,risk_pct=5,profit_pct=15,discount_pct=0;
DELETE FROM public.estimate_lines;
INSERT INTO public.estimate_lines(id,estimate_id,line_total)
VALUES(gen_random_uuid(),'50000000-0000-0000-0000-000000000001',10000);
DO $$
DECLARE
  p_id uuid := gen_random_uuid();
  v integer;
  s jsonb;
  sent timestamptz := '2026-11-22T00:00:00Z';
  expiry timestamptz := '2026-12-22T00:00:00Z';
BEGIN
  SELECT max(version_number)+1 INTO v FROM public.proposal_publications WHERE project_id='20000000-0000-0000-0000-000000000001';
  s:=jsonb_build_object('schema_version',1,'project',jsonb_build_object('id','20000000-0000-0000-0000-000000000001'),
    'publication',jsonb_build_object('id',p_id,'version_number',v,'sent_at',sent,'expires_at',expiry,'validity_days',30),
    'commercial',jsonb_build_object('estimate_id','50000000-0000-0000-0000-000000000001',
      'contract_sum_ex_vat',14300,'vat_rate',0,'vat_amount',0,'contract_sum_inc_vat',14300));
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  BEGIN
    PERFORM public.publish_proposal_publication('20000000-0000-0000-0000-000000000001',p_id,
      '50000000-0000-0000-0000-000000000001',v,repeat('e',64),s,repeat('f',64),14300,0,0,14300,sent,30,expiry,NULL);
    RAISE EXCEPTION 'Foreign owner accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  PERFORM public.publish_proposal_publication('20000000-0000-0000-0000-000000000001',p_id,
    '50000000-0000-0000-0000-000000000001',v,repeat('e',64),s,repeat('f',64),14300,0,0,14300,sent,30,expiry,NULL);
  RESET ROLE;
  RAISE NOTICE 'publish parity PASS: on_net = 14300; foreign owner refused';
END;
$$;
SQL

echo "proposal-publication-security-suite: pass"
