-- D101 / PR #176 ROLLBACK for supabase/migrations/20261116140000_d36_phase1_project_graph_markup_method.sql
--
-- NOT a migration. Lives outside supabase/migrations so it can never run
-- automatically. Run by a human, by hand, on a target whose verified preapply
-- backup exists:  psql "$URL" -X -v ON_ERROR_STOP=1 -f <this file>
--
-- What it does: restores the PREVIOUS create_phase1_project_graph definition
-- (the A069 closing-prefill version from 20261028183000_new_job_closing_prefill.sql,
-- copied verbatim below) with its grants (REVOKE PUBLIC/anon, GRANT authenticated).
-- It touches NO table, column, constraint or row: profiles.markup_method and
-- estimates.markup_method and every stored value are kept.
--
-- on_net INCOMPATIBILITY: a pre-D36 application knows only the compound
-- method. Any estimate stored with markup_method = 'on_net' would be priced as
-- compound by that application (a different, wrong price). So this script
-- REFUSES while any stored on_net estimate exists, unless the operator
-- explicitly acknowledges it:
--     psql ... -v ack_on_net_incompatible=yes -f <this file>
-- Acknowledging does not delete or change anything; it only restores the old
-- RPC. The old application must then NOT be used to view or price those
-- on_net estimates (forward-fix is the safe route). See README.md.
--
-- The text below is the repository predecessor. If the ACTUAL preapply backup
-- of the production function differs from it, use the backup instead.

\if :{?ack_on_net_incompatible}
\else
\set ack_on_net_incompatible no
\endif

BEGIN;

SELECT set_config('d101.ack_on_net_incompatible', :'ack_on_net_incompatible', true);

DO $guard$
DECLARE
    v_on_net bigint := 0;
    v_ack text := current_setting('d101.ack_on_net_incompatible', true);
BEGIN
    IF to_regprocedure('public.create_phase1_project_graph(uuid,jsonb,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'D101 rollback refused: create_phase1_project_graph(uuid,jsonb,jsonb) does not exist.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'estimates' AND column_name = 'markup_method'
    ) THEN
        EXECUTE 'SELECT count(*) FROM public.estimates WHERE markup_method = ''on_net'''
           INTO v_on_net;
    END IF;
    IF v_on_net > 0 AND v_ack IS DISTINCT FROM 'yes' THEN
        RAISE EXCEPTION 'D101 rollback refused: % stored on_net estimate(s) would be mispriced by a pre-D36 application. Forward-fix instead, or re-run with -v ack_on_net_incompatible=yes (restores the RPC only; no data is changed).', v_on_net;
    END IF;
    IF v_on_net > 0 THEN
        RAISE WARNING 'D101 rollback proceeding with % stored on_net estimate(s) kept unchanged; do not price them with a pre-D36 application.', v_on_net;
    END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.create_phase1_project_graph(
    p_request_id uuid,
    p_project jsonb,
    p_estimates jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(project_id uuid, estimate_ids uuid[])
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_organization_id uuid;
    v_project_id uuid;
    v_estimate_id uuid;
    v_estimate_ids uuid[] := ARRAY[]::uuid[];
    v_estimate jsonb;
    v_line jsonb;
    v_estimate_count integer;
    v_line_count integer := 0;
    v_closing text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_request_id IS NULL THEN
        RAISE EXCEPTION 'Creation request id is required';
    END IF;
    IF jsonb_typeof(p_project) <> 'object' OR jsonb_typeof(p_estimates) <> 'array' THEN
        RAISE EXCEPTION 'Invalid project creation payload';
    END IF;
    IF length(trim(COALESCE(p_project->>'name', ''))) NOT BETWEEN 1 AND 200 THEN
        RAISE EXCEPTION 'Project name is required and must be at most 200 characters';
    END IF;
    IF COALESCE(p_project->>'status', 'Lead') NOT IN ('Lead', 'Estimating') THEN
        RAISE EXCEPTION 'Invalid initial project status';
    END IF;
    IF COALESCE(p_project->>'proposal_complexity', 'full') NOT IN ('quick', 'full') THEN
        RAISE EXCEPTION 'Invalid proposal complexity';
    END IF;
    IF length(COALESCE(p_project->>'client_name', '')) > 200
       OR length(COALESCE(p_project->>'client_email', '')) > 200
       OR length(COALESCE(p_project->>'client_phone', '')) > 50
       OR length(COALESCE(p_project->>'client_address', '')) > 500
       OR length(COALESCE(p_project->>'site_address', '')) > 500
       OR length(COALESCE(p_project->>'project_type', '')) > 100
       OR length(COALESCE(p_project->>'brief_scope', '')) > 20000
       OR length(COALESCE(p_project->>'proposal_introduction', '')) > 20000
       OR length(COALESCE(p_project->>'scope_text', '')) > 20000 THEN
        RAISE EXCEPTION 'Project creation text exceeds the allowed size';
    END IF;
    IF COALESCE(NULLIF(p_project->>'potential_value', '')::numeric, 0)
       NOT BETWEEN 0 AND 100000000 THEN
        RAISE EXCEPTION 'Potential value is outside the allowed range';
    END IF;

    SELECT p.active_organization_id
      INTO v_organization_id
      FROM public.profiles p
      JOIN public.organization_members om
        ON om.organization_id = p.active_organization_id
       AND om.user_id = v_user_id
     WHERE p.id = v_user_id;

    IF v_organization_id IS NULL THEN
        SELECT om.organization_id
          INTO v_organization_id
          FROM public.organization_members om
         WHERE om.user_id = v_user_id
         ORDER BY om.joined_at
         LIMIT 1;
    END IF;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'No authorized organization is available';
    END IF;

    -- Serialize requests for the same user/request pair. Without this lock,
    -- concurrent retries can both miss the lookup below and the losing request
    -- reports a unique-index failure even though the graph was committed.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id::text, 0)
    );

    -- A retry with the same client-generated request id returns the committed
    -- graph rather than creating a duplicate.
    SELECT p.id
      INTO v_project_id
      FROM public.projects p
     WHERE p.user_id = v_user_id
       AND p.creation_request_id = p_request_id;

    IF v_project_id IS NOT NULL THEN
        SELECT COALESCE(array_agg(e.id ORDER BY e.created_at), ARRAY[]::uuid[])
          INTO v_estimate_ids
          FROM public.estimates e
         WHERE e.project_id = v_project_id;
        RETURN QUERY SELECT v_project_id, v_estimate_ids;
        RETURN;
    END IF;

    v_estimate_count := jsonb_array_length(p_estimates);
    IF v_estimate_count > 20 THEN
        RAISE EXCEPTION 'A project may contain at most 20 initial estimates';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM jsonb_array_elements(p_estimates) AS item(value)
         WHERE jsonb_typeof(value) <> 'object'
            OR (value ? 'lines' AND jsonb_typeof(value->'lines') <> 'array')
    ) THEN
        RAISE EXCEPTION 'Invalid estimate creation payload';
    END IF;

    SELECT COALESCE(sum(jsonb_array_length(COALESCE(value->'lines', '[]'::jsonb))), 0)
      INTO v_line_count
      FROM jsonb_array_elements(p_estimates);
    IF v_line_count > 2000 THEN
        RAISE EXCEPTION 'A project may contain at most 2000 initial estimate lines';
    END IF;

    -- A069: a truly new job starts with the owner's own saved managing
    -- director's message as its proposal-specific closing, exactly as saved,
    -- read here in the same transaction under the caller's RLS. A retry has
    -- already returned above, so an existing job is never changed. A blank or
    -- over-long message leaves the closing empty, as the explicit "Use company
    -- message" choice does (ECMAScript String.prototype.trim on the saved text,
    -- not POSIX locale space classes); nothing is shortened or reworded.
    -- Blank eligibility only (ECMAScript trim set, each code point enumerated):
    -- U+0009,U+000A,U+000B,U+000C,U+000D,U+0020,U+00A0,U+1680,U+2000,U+2001,
    -- U+2002,U+2003,U+2004,U+2005,U+2006,U+2007,U+2008,U+2009,U+200A,U+2028,
    -- U+2029,U+202F,U+205F,U+3000,U+FEFF. U+200B and U+180E are not blank.
    SELECT p.md_message
      INTO v_closing
      FROM public.profiles p
     WHERE p.id = v_user_id;
    IF v_closing IS NULL
       OR v_closing !~ U&'[^\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]' UESCAPE '\'
       OR length(v_closing) > 20000 THEN
        v_closing := NULL;
    ELSIF (SELECT pg_catalog.sum(CASE WHEN pg_catalog.ascii(chars.ch) > 65535 THEN 2 ELSE 1 END)
             FROM pg_catalog.regexp_split_to_table(v_closing, '') AS chars(ch)) > 20000 THEN
        -- The editor's 20,000 limit counts UTF-16 code units, as JavaScript
        -- does: a character above U+FFFF counts as two. Skip, never shorten.
        v_closing := NULL;
    END IF;

    INSERT INTO public.projects (
        user_id, tenant_id, organization_id, creation_request_id,
        name, client_name, client_email, client_phone, client_address,
        site_address, project_type, start_date, potential_value, status,
        proposal_complexity, template_id, brief_scope, brief_trade_sections,
        brief_completed, proposal_introduction, scope_text, programme_phases,
        closing_statement
    ) VALUES (
        v_user_id, v_user_id, v_organization_id, p_request_id,
        trim(p_project->>'name'), NULLIF(trim(p_project->>'client_name'), ''),
        NULLIF(trim(p_project->>'client_email'), ''), NULLIF(trim(p_project->>'client_phone'), ''),
        NULLIF(trim(p_project->>'client_address'), ''), NULLIF(trim(p_project->>'site_address'), ''),
        COALESCE(NULLIF(trim(p_project->>'project_type'), ''), 'Extension'),
        NULLIF(p_project->>'start_date', '')::date,
        NULLIF(p_project->>'potential_value', '')::numeric,
        COALESCE(NULLIF(p_project->>'status', ''), 'Lead'),
        COALESCE(NULLIF(p_project->>'proposal_complexity', ''), 'full'),
        NULLIF(p_project->>'template_id', '')::uuid,
        NULLIF(p_project->>'brief_scope', ''),
        ARRAY(
            SELECT jsonb_array_elements_text(
                COALESCE(p_project->'brief_trade_sections', '[]'::jsonb)
            )
        ),
        COALESCE((p_project->>'brief_completed')::boolean, false),
        NULLIF(p_project->>'proposal_introduction', ''),
        NULLIF(p_project->>'scope_text', ''),
        COALESCE(p_project->'programme_phases', '[]'::jsonb),
        v_closing
    ) RETURNING id INTO v_project_id;

    FOR v_estimate IN SELECT value FROM jsonb_array_elements(p_estimates)
    LOOP
        IF length(COALESCE(v_estimate->>'version_name', '')) > 200
           OR COALESCE((v_estimate->>'total_cost')::numeric, 0) NOT BETWEEN 0 AND 100000000
           OR COALESCE((v_estimate->>'overhead_pct')::numeric, 10) NOT BETWEEN 0 AND 100
           OR COALESCE((v_estimate->>'profit_pct')::numeric, 15) NOT BETWEEN 0 AND 100
           OR COALESCE((v_estimate->>'risk_pct')::numeric, 0) NOT BETWEEN 0 AND 100
           OR COALESCE((v_estimate->>'prelims_pct')::numeric, 0) NOT BETWEEN 0 AND 100 THEN
            RAISE EXCEPTION 'Estimate creation values are outside the allowed range';
        END IF;

        INSERT INTO public.estimates (
            project_id, organization_id, version_name, total_cost,
            overhead_pct, profit_pct, risk_pct, prelims_pct, is_active
        ) VALUES (
            v_project_id, v_organization_id,
            COALESCE(NULLIF(trim(v_estimate->>'version_name'), ''), 'Estimate v1'),
            COALESCE((v_estimate->>'total_cost')::numeric, 0),
            COALESCE((v_estimate->>'overhead_pct')::numeric, 10),
            COALESCE((v_estimate->>'profit_pct')::numeric, 15),
            COALESCE((v_estimate->>'risk_pct')::numeric, 0),
            COALESCE((v_estimate->>'prelims_pct')::numeric, 0),
            COALESCE((v_estimate->>'is_active')::boolean, false)
        ) RETURNING id INTO v_estimate_id;

        v_estimate_ids := array_append(v_estimate_ids, v_estimate_id);

        FOR v_line IN
            SELECT value FROM jsonb_array_elements(COALESCE(v_estimate->'lines', '[]'::jsonb))
        LOOP
            IF jsonb_typeof(v_line) <> 'object'
               OR length(COALESCE(v_line->>'trade_section', '')) > 200
               OR length(COALESCE(v_line->>'description', '')) > 1000
               OR length(COALESCE(v_line->>'unit', '')) > 50
               OR COALESCE((v_line->>'quantity')::numeric, 0) NOT BETWEEN 0 AND 100000000
               OR COALESCE((v_line->>'unit_rate')::numeric, 0) NOT BETWEEN 0 AND 100000000
               OR COALESCE((v_line->>'line_total')::numeric, 0) NOT BETWEEN 0 AND 100000000 THEN
                RAISE EXCEPTION 'Estimate line values are outside the allowed range';
            END IF;

            INSERT INTO public.estimate_lines (
                estimate_id, organization_id, trade_section, description,
                quantity, unit, unit_rate, line_total, pricing_mode, line_type
            ) VALUES (
                v_estimate_id, v_organization_id,
                COALESCE(NULLIF(trim(v_line->>'trade_section'), ''), 'General'),
                COALESCE(v_line->>'description', ''),
                COALESCE((v_line->>'quantity')::numeric, 0),
                COALESCE(NULLIF(trim(v_line->>'unit'), ''), 'item'),
                COALESCE((v_line->>'unit_rate')::numeric, 0),
                COALESCE((v_line->>'line_total')::numeric, 0),
                COALESCE(NULLIF(v_line->>'pricing_mode', ''), 'simple'),
                COALESCE(NULLIF(v_line->>'line_type', ''), 'general')
            );
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_project_id, v_estimate_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.create_phase1_project_graph(uuid, jsonb, jsonb)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_phase1_project_graph(uuid, jsonb, jsonb)
    TO authenticated;

-- Verify the restored definition before committing; any failure rolls back.
DO $verify$
DECLARE
    v_fn regprocedure := to_regprocedure('public.create_phase1_project_graph(uuid,jsonb,jsonb)');
    v_src text;
    v_secdef boolean;
    v_config text[];
BEGIN
    SELECT p.prosrc, p.prosecdef, p.proconfig INTO v_src, v_secdef, v_config
      FROM pg_catalog.pg_proc p WHERE p.oid = v_fn;
    -- md5 of the A069 predecessor body (20261028183000_new_job_closing_prefill.sql).
    IF pg_catalog.md5(v_src) <> '94a09802c149940e1494164d11840cd0' THEN
        RAISE EXCEPTION 'D101 rollback verification failed: restored body does not match the A069 predecessor.';
    END IF;
    IF position('markup_method' IN v_src) > 0 THEN
        RAISE EXCEPTION 'D101 rollback verification failed: restored body still references markup_method.';
    END IF;
    IF v_secdef IS DISTINCT FROM false OR v_config IS DISTINCT FROM ARRAY['search_path=""']::text[] THEN
        RAISE EXCEPTION 'D101 rollback verification failed: security mode or search_path differs.';
    END IF;
    IF NOT pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'D101 rollback verification failed: grants differ (authenticated must execute, anon must not).';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc p, LATERAL pg_catalog.aclexplode(p.proacl) a
         WHERE p.oid = v_fn AND a.grantee = 0
    ) THEN
        RAISE EXCEPTION 'D101 rollback verification failed: PUBLIC can still execute.';
    END IF;
END
$verify$;

COMMIT;
