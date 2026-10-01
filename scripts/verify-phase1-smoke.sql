\set ON_ERROR_STOP on

BEGIN;

-- Supabase Auth is not running in the hosted PostgreSQL service. Inserting the
-- same durable user row exercises the real signup trigger and all downstream
-- database boundaries without touching production.
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'phase1-smoke@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Phase One Smoke"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

DO $$
DECLARE
  v_organization_id uuid;
BEGIN
  SELECT profile.active_organization_id
    INTO v_organization_id
    FROM public.profiles profile
   WHERE profile.id = '10000000-0000-0000-0000-000000000001';

  IF v_organization_id IS NULL
     OR NOT EXISTS (
       SELECT 1
         FROM public.organization_members membership
        WHERE membership.organization_id = v_organization_id
          AND membership.user_id = '10000000-0000-0000-0000-000000000001'
          AND membership.role = 'Owner'
     ) THEN
    RAISE EXCEPTION 'Signup trigger did not create the profile, organization and owner membership.';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

SELECT *
  FROM public.create_phase1_project_graph(
    '20000000-0000-0000-0000-000000000001',
    jsonb_build_object(
      'name', 'Phase 1 Smoke Project',
      'client_name', 'Example Client',
      'client_email', 'client@example.test',
      'site_address', '1 Test Street',
      'project_type', 'Extension',
      'potential_value', 100,
      'status', 'Estimating',
      'proposal_complexity', 'full',
      'brief_scope', 'Deterministic hosted database smoke journey',
      'brief_trade_sections', jsonb_build_array('General'),
      'brief_completed', true,
      'proposal_introduction', 'A test proposal.',
      'scope_text', 'Complete the described works.'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'version_name', 'Estimate v1',
        'total_cost', 100,
        'overhead_pct', 0,
        'risk_pct', 0,
        'profit_pct', 0,
        'prelims_pct', 0,
        'is_active', true,
        'lines', jsonb_build_array(
          jsonb_build_object(
            'trade_section', 'General',
            'description', 'Smoke-tested works',
            'quantity', 1,
            'unit', 'item',
            'unit_rate', 100,
            'line_total', 100,
            'pricing_mode', 'simple',
            'line_type', 'general'
          )
        )
      )
    )
  );

-- A retry with the same request ID must return the existing graph.
SELECT *
  FROM public.create_phase1_project_graph(
    '20000000-0000-0000-0000-000000000001',
    '{"name":"Phase 1 Smoke Project"}'::jsonb,
    '[]'::jsonb
  );

RESET ROLE;

DO $$
DECLARE
  v_organization_id uuid;
  v_project_id uuid;
  v_estimate_id uuid;
BEGIN
  SELECT active_organization_id
    INTO v_organization_id
    FROM public.profiles
   WHERE id = '10000000-0000-0000-0000-000000000001';

  SELECT id
    INTO v_project_id
    FROM public.projects
   WHERE user_id = '10000000-0000-0000-0000-000000000001'
     AND creation_request_id = '20000000-0000-0000-0000-000000000001';

  SELECT id
    INTO v_estimate_id
    FROM public.estimates
   WHERE project_id = v_project_id
     AND is_active IS TRUE;

  IF v_project_id IS NULL OR v_estimate_id IS NULL
     OR (SELECT count(*) FROM public.projects
          WHERE creation_request_id = '20000000-0000-0000-0000-000000000001') <> 1
     OR (SELECT count(*) FROM public.estimates WHERE project_id = v_project_id) <> 1
     OR (SELECT count(*) FROM public.estimate_lines WHERE estimate_id = v_estimate_id) <> 1
     OR NOT EXISTS (
       SELECT 1
         FROM public.projects project
        WHERE project.id = v_project_id
          AND project.organization_id = v_organization_id
     ) THEN
    RAISE EXCEPTION 'Atomic project graph or idempotent retry assertion failed.';
  END IF;
END;
$$;

SELECT id AS smoke_project_id
  FROM public.projects
 WHERE creation_request_id = '20000000-0000-0000-0000-000000000001'
\gset

SELECT id AS smoke_estimate_id
  FROM public.estimates
 WHERE project_id = :'smoke_project_id'::uuid
   AND is_active IS TRUE
\gset

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);

SELECT *
  FROM public.publish_proposal_publication(
    :'smoke_project_id'::uuid,
    '30000000-0000-0000-0000-000000000001',
    :'smoke_estimate_id'::uuid,
    1,
    repeat('a', 64),
    jsonb_build_object(
      'schema_version', 1,
      'project', jsonb_build_object('id', :'smoke_project_id'),
      'publication', jsonb_build_object(
        'id', '30000000-0000-0000-0000-000000000001',
        'version_number', 1,
        'sent_at', '2099-01-01T00:00:00Z',
        'expires_at', '2099-01-31T00:00:00Z',
        'validity_days', 30,
        'response_mode', 'binding_acceptance'
      ),
      'commercial', jsonb_build_object(
        'estimate_id', :'smoke_estimate_id',
        'contract_sum_ex_vat', 100,
        'vat_rate', 20,
        'vat_amount', 20,
        'contract_sum_inc_vat', 120
      )
    ),
    repeat('b', 64),
    100,
    20,
    20,
    120,
    '2099-01-01T00:00:00Z',
    30,
    '2099-01-31T00:00:00Z',
    NULL
  );

RESET ROLE;

SET LOCAL ROLE service_role;

SELECT *
  FROM public.resolve_proposal_publication(repeat('a', 64), true);

SELECT *
  FROM public.respond_to_proposal_publication(
    repeat('a', 64),
    'accepted',
    'Example Client',
    'client@example.test',
    'Accepted in the hosted smoke journey.'
  );

-- The same response is idempotent and must not duplicate its audit event.
SELECT *
  FROM public.respond_to_proposal_publication(
    repeat('a', 64),
    'accepted',
    'Example Client',
    'client@example.test',
    'Accepted in the hosted smoke journey.'
  );

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
     FROM public.proposal_publications publication
     WHERE publication.id = '30000000-0000-0000-0000-000000000001'
       AND publication.project_id = (
         SELECT id
           FROM public.projects
          WHERE creation_request_id = '20000000-0000-0000-0000-000000000001'
       )
       AND publication.status = 'accepted'
       AND publication.first_viewed_at IS NOT NULL
       AND publication.responded_by = 'Example Client'
       AND publication.snapshot_hash = repeat('b', 64)
  ) THEN
    RAISE EXCEPTION 'Immutable proposal did not complete the view and response journey.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.projects project
     WHERE project.creation_request_id = '20000000-0000-0000-0000-000000000001'
       AND project.current_proposal_publication_id = '30000000-0000-0000-0000-000000000001'
       AND project.accepted_proposal_publication_id = '30000000-0000-0000-0000-000000000001'
       AND project.proposal_status = 'accepted'
       AND project.proposal_accepted_at IS NOT NULL
       AND project.status = 'Won'
  ) THEN
    RAISE EXCEPTION 'Accepted proposal did not update the project pointers and status.';
  END IF;

  IF (SELECT count(*)
        FROM public.proposal_publication_events
       WHERE publication_id = '30000000-0000-0000-0000-000000000001'
         AND event_type = 'published') <> 1
     OR (SELECT count(*)
           FROM public.proposal_publication_events
          WHERE publication_id = '30000000-0000-0000-0000-000000000001'
            AND event_type = 'viewed') <> 1
     OR (SELECT count(*)
           FROM public.proposal_publication_events
          WHERE publication_id = '30000000-0000-0000-0000-000000000001'
            AND event_type = 'accepted') <> 1 THEN
    RAISE EXCEPTION 'Proposal publication audit events are incomplete or duplicated.';
  END IF;
END;
$$;

ROLLBACK;

\echo 'constructa-phase1-database-smoke: pass'
