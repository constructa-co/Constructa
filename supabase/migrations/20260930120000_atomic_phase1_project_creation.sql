-- Phase 1 creation must commit the project, estimates and estimate lines as one
-- graph. This SECURITY INVOKER function keeps the caller's RLS context and only
-- accepts the bounded fields assembled by the validated server actions.

BEGIN;

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS creation_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_creation_request_uidx
    ON public.projects (user_id, creation_request_id)
    WHERE creation_request_id IS NOT NULL;

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

    INSERT INTO public.projects (
        user_id, tenant_id, organization_id, creation_request_id,
        name, client_name, client_email, client_phone, client_address,
        site_address, project_type, start_date, potential_value, status,
        proposal_complexity, template_id, brief_scope, brief_trade_sections,
        brief_completed, proposal_introduction, scope_text, programme_phases
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
        COALESCE(p_project->'programme_phases', '[]'::jsonb)
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

COMMIT;
