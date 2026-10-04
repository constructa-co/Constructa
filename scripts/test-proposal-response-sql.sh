#!/usr/bin/env bash
# Stage 2 Tranche 2D: the non-binding client response needs no schema change.
#
# Runs the existing proposal-publication migrations in a throwaway local
# Postgres and proves, against the database as it stands, that:
#   - a snapshot carrying the canonical programme and the chosen response
#     satisfies every publication constraint;
#   - both new response kinds are published under the "acknowledgement" mode,
#     so the one response the database will record for them is "acknowledged";
#   - acceptance and decline are refused for them;
#   - a published snapshot cannot be changed afterwards;
#   - a publication made earlier in binding-acceptance mode still behaves as
#     it did, so historical records are not reinterpreted.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-proposal-response.XXXXXX")"
PORT="${CONSTRUCTA_TEST_PG_PORT:-55451}"

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
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), email text, full_name text);
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
SQL

"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20260930150000_proposal_publication_foundation.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT_DIR/supabase/migrations/20260930220000_lock_public_proposal_base_tables.sql" >/dev/null

"${PSQL[@]}" <<'SQL'
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.organizations(id) VALUES ('10000000-0000-0000-0000-000000000001');
INSERT INTO public.organization_members(organization_id, user_id)
  VALUES ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
INSERT INTO public.projects(id, user_id, organization_id, status) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Proposal Sent'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Proposal Sent'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Proposal Sent');

-- The snapshot shape buildProposalPublicationSnapshot writes from Tranche 2D:
-- response_mode is always "acknowledgement"; the response the client is asked
-- for and the canonical programme are additional keys. schema_version stays 1.
CREATE FUNCTION pg_temp.snapshot(p_id uuid, p_mode text, p_kind text, p_sent timestamptz) RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'schema_version', 1,
    'publication', jsonb_build_object(
      'id', p_id, 'version_number', 1,
      'sent_at', p_sent, 'expires_at', p_sent + interval '30 days',
      'validity_days', 30, 'response_mode', p_mode),
    'project', jsonb_build_object('id', '20000000-0000-0000-0000-000000000001', 'name', 'Synthetic job'),
    'commercial', jsonb_build_object(
      'currency', 'GBP', 'contract_sum_ex_vat', 7552.05, 'vat_rate', 20,
      'vat_amount', 1510.41, 'contract_sum_inc_vat', 9062.46, 'vat_treatment', 'standard'),
    'programme', '[]'::jsonb,
    'terms', jsonb_build_object('profile_version', 'phase1-standard-v1', 'clauses', '[]'::jsonb)
  ) || CASE WHEN p_kind IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'programme_plan', jsonb_build_object(
      'basis', 'mon_fri_working_days', 'start_date', '2026-11-02', 'end_date', '2026-11-20',
      'working_days', 15, 'calendar_days', 19, 'duration_label', '3 weeks',
      'stages', jsonb_build_array(jsonb_build_object(
        'name', 'Works on site', 'start_date', '2026-11-02', 'end_date', '2026-11-20',
        'working_days', 15, 'offset_days', 0, 'span_days', 19))),
    'response', jsonb_build_object('kind', p_kind, 'notice', 'Synthetic notice.'),
    'case_studies', '[]'::jsonb,
    'photos', jsonb_build_array(jsonb_build_object('url', 'https://images.example.test/a.jpg', 'caption', null))
  ) END
$$;

INSERT INTO public.proposal_publications (
  id, project_id, organization_id, owner_user_id, version_number, token_hash,
  snapshot, snapshot_hash, contract_sum_ex_vat, vat_rate, vat_amount,
  contract_sum_inc_vat, sent_at, validity_days, expires_at
)
-- Sent a moment ago, so each publication is still inside its validity window.
SELECT p.id, p.project_id, '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1,
       repeat(p.token, 64), pg_temp.snapshot(p.id, p.mode, p.kind, sent.at), repeat('f', 64),
       7552.05, 20, 1510.41, 9062.46, sent.at, 30, sent.at + interval '30 days'
  FROM (SELECT date_trunc('second', now()) AS at) AS sent,
       (VALUES
    ('30000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'a', 'acknowledgement', 'acknowledgement'),
    ('30000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'b', 'acknowledgement', 'non_binding_intent'),
    -- As published before Tranche 2D: acceptance mode, none of the newer keys.
    ('30000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'c', 'binding_acceptance', NULL)
  ) AS p(id, project_id, token, mode, kind);
SQL

"${PSQL[@]}" <<'SQL'
SET ROLE service_role;

DO $$
DECLARE
  v_status text;
  v_failed boolean;
BEGIN
  -- 1. Acknowledgement: only "acknowledged" is recorded.
  FOREACH v_status IN ARRAY ARRAY['accepted', 'declined'] LOOP
    v_failed := false;
    BEGIN
      PERFORM public.respond_to_proposal_publication(repeat('a', 64), v_status, 'Alex Client', NULL, NULL);
    EXCEPTION WHEN check_violation THEN v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'An acknowledgement proposal recorded "%".', v_status; END IF;
  END LOOP;
  PERFORM public.respond_to_proposal_publication(repeat('a', 64), 'acknowledged', 'Alex Client', 'alex@example.test', NULL);

  -- 2. Non-binding intention: the same single response, and acceptance is refused.
  FOREACH v_status IN ARRAY ARRAY['accepted', 'declined'] LOOP
    v_failed := false;
    BEGIN
      PERFORM public.respond_to_proposal_publication(repeat('b', 64), v_status, 'Alex Client', NULL, NULL);
    EXCEPTION WHEN check_violation THEN v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'A non-binding-intent proposal recorded "%".', v_status; END IF;
  END LOOP;
  PERFORM public.respond_to_proposal_publication(repeat('b', 64), 'acknowledged', 'Alex Client', NULL, NULL);

  -- 3. A publication made earlier in acceptance mode still behaves as it did.
  v_failed := false;
  BEGIN
    PERFORM public.respond_to_proposal_publication(repeat('c', 64), 'acknowledged', 'Alex Client', NULL, NULL);
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A historical acceptance-mode proposal was reinterpreted as an acknowledgement.'; END IF;
  PERFORM public.respond_to_proposal_publication(repeat('c', 64), 'accepted', 'Alex Client', NULL, NULL);
END;
$$;

RESET ROLE;

DO $$
DECLARE
  v_failed boolean := false;
BEGIN
  IF (SELECT count(*) FROM public.proposal_publications
       WHERE id IN ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')
         AND status = 'acknowledged' AND responded_by = 'Alex Client') <> 2 THEN
    RAISE EXCEPTION 'The non-binding responses were not recorded as acknowledged.';
  END IF;

  -- Neither non-binding response marks the project as won or accepted.
  IF EXISTS (SELECT 1 FROM public.projects
              WHERE id IN ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')
                AND (status = 'Won' OR proposal_accepted_at IS NOT NULL
                     OR accepted_proposal_publication_id IS NOT NULL OR proposal_status <> 'acknowledged')) THEN
    RAISE EXCEPTION 'A non-binding response was treated as acceptance on the project.';
  END IF;

  -- What the client was asked for is read back from the immutable snapshot.
  IF (SELECT snapshot#>>'{response,kind}' FROM public.proposal_publications WHERE id = '30000000-0000-0000-0000-000000000002') <> 'non_binding_intent'
     OR (SELECT snapshot#>>'{programme_plan,end_date}' FROM public.proposal_publications WHERE id = '30000000-0000-0000-0000-000000000002') <> '2026-11-20' THEN
    RAISE EXCEPTION 'The response kind or programme was not kept in the snapshot.';
  END IF;

  -- The historical acceptance is intact.
  IF NOT EXISTS (SELECT 1 FROM public.projects
                  WHERE id = '20000000-0000-0000-0000-000000000003' AND status = 'Won'
                    AND accepted_proposal_publication_id = '30000000-0000-0000-0000-000000000003') THEN
    RAISE EXCEPTION 'The historical acceptance was not preserved.';
  END IF;

  -- A published snapshot cannot be edited, even to change what was asked for.
  BEGIN
    UPDATE public.proposal_publications
       SET snapshot = jsonb_set(snapshot, '{response,kind}', '"acknowledgement"')
     WHERE id = '30000000-0000-0000-0000-000000000002';
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A published snapshot was changed after publication.'; END IF;
END;
$$;
SQL

echo "proposal-response-suite: pass"
