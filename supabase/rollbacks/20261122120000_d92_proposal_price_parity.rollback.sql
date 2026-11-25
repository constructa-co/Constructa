-- D92-M1 ROLLBACK (NOT a migration; never auto-applied; held with PR #238).
-- Restores the exact pre-D92 publish_proposal_publication definition and
-- grants, copied byte-for-byte from 20260930150000_proposal_publication_foundation.sql
-- (the only earlier definition). Function-only: no table, column or data change,
-- so published proposals/snapshots are untouched. Production use requires Rob
-- and a verified preapply function backup. scripts/test-proposal-publication-sql.sh
-- proves the byte match and the behaviour in a disposable database.
BEGIN;

CREATE OR REPLACE FUNCTION public.publish_proposal_publication(
    p_project_id uuid,
    p_publication_id uuid,
    p_estimate_id uuid,
    p_version_number integer,
    p_token_hash text,
    p_snapshot jsonb,
    p_snapshot_hash text,
    p_contract_sum_ex_vat numeric,
    p_vat_rate numeric,
    p_vat_amount numeric,
    p_contract_sum_inc_vat numeric,
    p_sent_at timestamptz,
    p_validity_days integer,
    p_expires_at timestamptz,
    p_delivery_email text DEFAULT NULL
)
RETURNS TABLE (
    publication_id uuid,
    published_version integer,
    published_at timestamptz,
    publication_expires_at timestamptz,
    delivery_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor uuid := auth.uid();
    v_project public.projects%ROWTYPE;
    v_estimate public.estimates%ROWTYPE;
    v_active_estimate_count integer;
    v_expected_version integer;
    v_previous_id uuid;
    v_delivery_id uuid;
    v_direct_cost numeric := 0;
    v_explicit_prelims numeric := 0;
    v_explicit_prelims_count integer := 0;
    v_base_cost numeric := 0;
    v_prelims numeric := 0;
    v_canonical_sum numeric := 0;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT project.*
      INTO v_project
      FROM public.projects project
     WHERE project.id = p_project_id
       AND project.user_id = v_actor
     FOR UPDATE;

    IF NOT FOUND OR v_project.organization_id IS NULL OR NOT EXISTS (
        SELECT 1
          FROM public.organization_members membership
         WHERE membership.organization_id = v_project.organization_id
           AND membership.user_id = v_actor
    ) THEN
        RAISE EXCEPTION 'Unauthorized project access.' USING ERRCODE = '42501';
    END IF;

    IF v_project.is_archived IS TRUE
       OR v_project.proposal_status = 'accepted'
       OR v_project.proposal_accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This project can no longer publish a proposal.' USING ERRCODE = '23514';
    END IF;

    SELECT count(*)
      INTO v_active_estimate_count
      FROM public.estimates estimate
     WHERE estimate.project_id = p_project_id
       AND estimate.is_active IS TRUE;

    IF v_active_estimate_count <> 1 THEN
        RAISE EXCEPTION 'Exactly one active estimate is required before publishing.' USING ERRCODE = '23514';
    END IF;

    SELECT estimate.*
      INTO v_estimate
      FROM public.estimates estimate
     WHERE estimate.id = p_estimate_id
       AND estimate.project_id = p_project_id
       AND estimate.is_active IS TRUE
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected estimate is not the active project estimate.' USING ERRCODE = '23514';
    END IF;

    -- Serialize against estimate-line edits before independently recomputing
    -- the amount that the application placed in the immutable snapshot.
    PERFORM 1
      FROM public.estimate_lines line
     WHERE line.estimate_id = v_estimate.id
     ORDER BY line.id
     FOR UPDATE;

    SELECT
        COALESCE(sum(line.line_total) FILTER (
            WHERE COALESCE(line.trade_section, 'General') <> 'Preliminaries'
              AND COALESCE(line.line_total, 0) > 0
        ), 0),
        COALESCE(sum(line.line_total) FILTER (
            WHERE COALESCE(line.trade_section, '') = 'Preliminaries'
        ), 0),
        count(*) FILTER (WHERE COALESCE(line.trade_section, '') = 'Preliminaries')
      INTO v_direct_cost, v_explicit_prelims, v_explicit_prelims_count
      FROM public.estimate_lines line
     WHERE line.estimate_id = v_estimate.id;

    v_base_cost := CASE
        WHEN v_direct_cost > 0 THEN v_direct_cost
        ELSE COALESCE(v_estimate.total_cost, 0)
    END;
    v_prelims := CASE
        WHEN v_explicit_prelims_count > 0 THEN v_explicit_prelims
        ELSE v_base_cost * COALESCE(v_estimate.prelims_pct, 0) / 100
    END;
    v_canonical_sum := round(
        (((v_base_cost + v_prelims)
            * (1 + COALESCE(v_estimate.overhead_pct, 0) / 100))
            * (1 + COALESCE(v_estimate.risk_pct, 0) / 100))
            * (1 + COALESCE(v_estimate.profit_pct, 0) / 100)
            * (1 - COALESCE(v_estimate.discount_pct, 0) / 100),
        2
    );

    IF v_canonical_sum <= 0 OR v_canonical_sum IS DISTINCT FROM p_contract_sum_ex_vat THEN
        RAISE EXCEPTION 'Published contract sum does not match the active estimate.' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(max(publication.version_number), 0) + 1
      INTO v_expected_version
      FROM public.proposal_publications publication
     WHERE publication.project_id = p_project_id;

    IF p_version_number <> v_expected_version
       OR p_token_hash !~ '^[a-f0-9]{64}$'
       OR p_snapshot_hash !~ '^[a-f0-9]{64}$'
       OR p_snapshot#>>'{project,id}' <> p_project_id::text
       OR p_snapshot#>>'{commercial,estimate_id}' <> v_estimate.id::text
       OR (p_snapshot#>>'{publication,id}')::uuid IS DISTINCT FROM p_publication_id
       OR (p_snapshot#>>'{publication,version_number}')::integer IS DISTINCT FROM p_version_number THEN
        RAISE EXCEPTION 'Proposal publication payload failed validation.' USING ERRCODE = '23514';
    END IF;

    SELECT publication.id
      INTO v_previous_id
      FROM public.proposal_publications publication
     WHERE publication.project_id = p_project_id
       AND publication.status IN ('sent', 'viewed')
     FOR UPDATE;

    IF v_previous_id IS NOT NULL THEN
        UPDATE public.proposal_publications
           SET status = 'revoked', revoked_at = p_sent_at
         WHERE id = v_previous_id;
        INSERT INTO public.proposal_publication_events (
            publication_id, organization_id, owner_user_id, event_type,
            actor_kind, details, occurred_at
        ) VALUES (
            v_previous_id, v_project.organization_id, v_actor, 'revoked',
            'owner', jsonb_build_object('superseded_by', p_publication_id), p_sent_at
        );
    END IF;

    INSERT INTO public.proposal_publications (
        id, project_id, organization_id, owner_user_id, version_number,
        token_hash, status, snapshot, snapshot_hash,
        contract_sum_ex_vat, vat_rate, vat_amount, contract_sum_inc_vat,
        sent_at, validity_days, expires_at
    ) VALUES (
        p_publication_id, p_project_id, v_project.organization_id, v_actor, p_version_number,
        p_token_hash, 'sent', p_snapshot, p_snapshot_hash,
        p_contract_sum_ex_vat, p_vat_rate, p_vat_amount, p_contract_sum_inc_vat,
        p_sent_at, p_validity_days, p_expires_at
    );

    INSERT INTO public.proposal_publication_events (
        publication_id, organization_id, owner_user_id, event_type,
        actor_kind, details, occurred_at
    ) VALUES (
        p_publication_id, v_project.organization_id, v_actor, 'published',
        'owner', jsonb_build_object('version_number', p_version_number), p_sent_at
    );

    IF NULLIF(btrim(COALESCE(p_delivery_email, '')), '') IS NOT NULL THEN
        IF length(btrim(p_delivery_email)) > 320 THEN
            RAISE EXCEPTION 'Delivery email is invalid.' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.proposal_delivery_attempts (
            publication_id, organization_id, owner_user_id, recipient_email
        ) VALUES (
            p_publication_id, v_project.organization_id, v_actor, lower(btrim(p_delivery_email))
        ) RETURNING id INTO v_delivery_id;
        INSERT INTO public.proposal_publication_events (
            publication_id, organization_id, owner_user_id, event_type,
            actor_kind, details, occurred_at
        ) VALUES (
            p_publication_id, v_project.organization_id, v_actor, 'delivery_queued',
            'system', jsonb_build_object('delivery_id', v_delivery_id), p_sent_at
        );
    END IF;

    IF v_previous_id IS NOT NULL THEN
        UPDATE public.proposal_publications
           SET superseded_by = p_publication_id
         WHERE id = v_previous_id;
    END IF;

    UPDATE public.projects
       SET current_proposal_publication_id = p_publication_id,
           proposal_token = NULL,
           proposal_sent_at = p_sent_at,
           proposal_status = 'sent',
           status = CASE
               WHEN status IS NULL OR status IN ('Lead', 'Estimating') THEN 'Proposal Sent'
               ELSE status
           END
     WHERE id = p_project_id
       AND user_id = v_actor;

    RETURN QUERY SELECT p_publication_id, p_version_number, p_sent_at, p_expires_at, v_delivery_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_proposal_publication(
    uuid, uuid, uuid, integer, text, jsonb, text, numeric, numeric,
    numeric, numeric, timestamptz, integer, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_proposal_publication(
    uuid, uuid, uuid, integer, text, jsonb, text, numeric, numeric,
    numeric, numeric, timestamptz, integer, timestamptz, text
) TO authenticated, service_role;

COMMIT;
