-- Immutable proposal publication foundation. A draft project is not a public
-- proposal; each send creates a versioned record whose client-safe snapshot,
-- canonical value and validity window cannot drift with later project edits.

BEGIN;

-- These fields are used by the live estimator but were originally added
-- out-of-band. Reconcile them here before the publication RPC depends on
-- them so a migrations-only environment produces the same contract sum.
ALTER TABLE public.estimates
    ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_reason text;

CREATE TABLE IF NOT EXISTS public.proposal_publications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    version_number integer NOT NULL CHECK (version_number > 0),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    status text NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'viewed', 'acknowledged', 'accepted', 'declined', 'revoked')),
    snapshot_schema_version integer NOT NULL DEFAULT 1
        CHECK (snapshot_schema_version = 1),
    snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
    contract_sum_ex_vat numeric(14,2) NOT NULL CHECK (contract_sum_ex_vat > 0),
    vat_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (vat_rate BETWEEN 0 AND 100),
    vat_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    contract_sum_inc_vat numeric(14,2) NOT NULL CHECK (contract_sum_inc_vat > 0),
    sent_at timestamptz NOT NULL DEFAULT now(),
    validity_days integer NOT NULL CHECK (validity_days BETWEEN 1 AND 365),
    expires_at timestamptz NOT NULL CHECK (expires_at > sent_at),
    first_viewed_at timestamptz,
    responded_at timestamptz,
    responded_by text CHECK (responded_by IS NULL OR length(responded_by) <= 200),
    responded_email text CHECK (responded_email IS NULL OR length(responded_email) <= 320),
    response_note text CHECK (response_note IS NULL OR length(response_note) <= 5000),
    revoked_at timestamptz,
    superseded_by uuid REFERENCES public.proposal_publications(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT proposal_publications_project_version_key UNIQUE (project_id, version_number),
    CONSTRAINT proposal_publications_money_check CHECK (
        contract_sum_inc_vat = contract_sum_ex_vat + vat_amount
    ),
    CONSTRAINT proposal_publications_response_check CHECK (
        (status IN ('acknowledged', 'accepted', 'declined') AND responded_at IS NOT NULL AND responded_by IS NOT NULL)
        OR (status NOT IN ('acknowledged', 'accepted', 'declined') AND responded_at IS NULL)
    ),
    CONSTRAINT proposal_publications_revocation_check CHECK (
        (status = 'revoked' AND revoked_at IS NOT NULL)
        OR (status <> 'revoked' AND revoked_at IS NULL)
    ),
    CONSTRAINT proposal_publications_not_self_superseded CHECK (superseded_by IS DISTINCT FROM id),
    CONSTRAINT proposal_publications_snapshot_identity_check CHECK (
        snapshot->>'schema_version' = snapshot_schema_version::text
        AND (snapshot#>>'{publication,id}')::uuid = id
        AND (snapshot#>>'{publication,version_number}')::integer = version_number
        AND (snapshot#>>'{publication,sent_at}')::timestamptz = sent_at
        AND (snapshot#>>'{publication,expires_at}')::timestamptz = expires_at
        AND (snapshot#>>'{publication,validity_days}')::integer = validity_days
    ),
    CONSTRAINT proposal_publications_snapshot_money_check CHECK (
        (snapshot#>>'{commercial,contract_sum_ex_vat}')::numeric = contract_sum_ex_vat
        AND (snapshot#>>'{commercial,vat_rate}')::numeric = vat_rate
        AND (snapshot#>>'{commercial,vat_amount}')::numeric = vat_amount
        AND (snapshot#>>'{commercial,contract_sum_inc_vat}')::numeric = contract_sum_inc_vat
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS proposal_publications_one_live_per_project_uidx
    ON public.proposal_publications(project_id)
    WHERE status IN ('sent', 'viewed');

CREATE INDEX IF NOT EXISTS proposal_publications_owner_project_idx
    ON public.proposal_publications(owner_user_id, project_id, version_number DESC);

CREATE INDEX IF NOT EXISTS proposal_publications_organization_idx
    ON public.proposal_publications(organization_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.proposal_publication_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    publication_id uuid NOT NULL REFERENCES public.proposal_publications(id) ON DELETE RESTRICT,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    event_type text NOT NULL CHECK (event_type IN (
        'published', 'revoked', 'viewed', 'acknowledged', 'accepted', 'declined',
        'delivery_queued', 'delivery_sent', 'delivery_failed'
    )),
    actor_kind text NOT NULL CHECK (actor_kind IN ('owner', 'client', 'system')),
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_publication_events_publication_idx
    ON public.proposal_publication_events(publication_id, occurred_at, id);

CREATE TABLE IF NOT EXISTS public.proposal_delivery_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id uuid NOT NULL REFERENCES public.proposal_publications(id) ON DELETE RESTRICT,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    template text NOT NULL DEFAULT 'proposal_published'
        CHECK (template IN ('proposal_published')),
    recipient_email text NOT NULL CHECK (length(recipient_email) BETWEEN 3 AND 320),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_attempt_at timestamptz,
    sent_at timestamptz,
    provider_message_id text CHECK (provider_message_id IS NULL OR length(provider_message_id) <= 500),
    last_error_code text CHECK (last_error_code IS NULL OR length(last_error_code) <= 200),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT proposal_delivery_attempts_once UNIQUE (publication_id, template, recipient_email),
    CONSTRAINT proposal_delivery_attempts_sent_check CHECK (
        (status = 'sent' AND sent_at IS NOT NULL)
        OR (status <> 'sent' AND sent_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS proposal_delivery_attempts_pending_idx
    ON public.proposal_delivery_attempts(status, created_at)
    WHERE status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.proposal_snapshot_has_forbidden_keys(p_snapshot jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    WITH RECURSIVE nodes(key, value) AS (
        SELECT NULL::text, p_snapshot
        UNION ALL
        SELECT child.key, child.value
          FROM nodes parent
          CROSS JOIN LATERAL (
              SELECT object_entry.key, object_entry.value
                FROM jsonb_each(
                    CASE WHEN jsonb_typeof(parent.value) = 'object'
                         THEN parent.value ELSE '{}'::jsonb END
                ) AS object_entry
              UNION ALL
              SELECT NULL::text, array_entry.value
                FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(parent.value) = 'array'
                         THEN parent.value ELSE '[]'::jsonb END
                ) AS array_entry
          ) child
    )
    SELECT EXISTS (
        SELECT 1
          FROM nodes
         WHERE key = ANY (ARRAY[
            'total_cost', 'prelims_pct', 'overhead_pct', 'risk_pct',
            'profit_pct', 'discount_pct', 'unit_rate', 'internal_cost',
            'cost_price', 'buy_rate', 'markup', 'supplier', 'margin',
            'components', 'estimate_line_components'
         ])
    );
$$;

REVOKE ALL ON FUNCTION public.proposal_snapshot_has_forbidden_keys(jsonb) FROM PUBLIC;

ALTER TABLE public.proposal_publications
    DROP CONSTRAINT IF EXISTS proposal_publications_client_safe_snapshot_check,
    ADD CONSTRAINT proposal_publications_client_safe_snapshot_check
        CHECK (NOT public.proposal_snapshot_has_forbidden_keys(snapshot));

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS current_proposal_publication_id uuid
        REFERENCES public.proposal_publications(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accepted_proposal_publication_id uuid
        REFERENCES public.proposal_publications(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.guard_proposal_publication_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF OLD.project_id IS DISTINCT FROM NEW.project_id
       OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
       OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
       OR OLD.version_number IS DISTINCT FROM NEW.version_number
       OR OLD.token_hash IS DISTINCT FROM NEW.token_hash
       OR OLD.snapshot_schema_version IS DISTINCT FROM NEW.snapshot_schema_version
       OR OLD.snapshot IS DISTINCT FROM NEW.snapshot
       OR OLD.snapshot_hash IS DISTINCT FROM NEW.snapshot_hash
       OR OLD.contract_sum_ex_vat IS DISTINCT FROM NEW.contract_sum_ex_vat
       OR OLD.vat_rate IS DISTINCT FROM NEW.vat_rate
       OR OLD.vat_amount IS DISTINCT FROM NEW.vat_amount
       OR OLD.contract_sum_inc_vat IS DISTINCT FROM NEW.contract_sum_inc_vat
       OR OLD.sent_at IS DISTINCT FROM NEW.sent_at
       OR OLD.validity_days IS DISTINCT FROM NEW.validity_days
       OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
       OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
        RAISE EXCEPTION 'Published proposal content is immutable.' USING ERRCODE = '23514';
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status AND NOT (
        (OLD.status = 'sent' AND NEW.status IN ('viewed', 'acknowledged', 'accepted', 'declined', 'revoked'))
        OR (OLD.status = 'viewed' AND NEW.status IN ('acknowledged', 'accepted', 'declined', 'revoked'))
    ) THEN
        RAISE EXCEPTION 'Invalid proposal publication status transition.' USING ERRCODE = '23514';
    END IF;

    IF OLD.first_viewed_at IS NOT NULL
       AND OLD.first_viewed_at IS DISTINCT FROM NEW.first_viewed_at THEN
        RAISE EXCEPTION 'The first viewed timestamp is immutable.' USING ERRCODE = '23514';
    END IF;

    IF NEW.superseded_by IS NOT NULL THEN
        IF NEW.status <> 'revoked' OR NOT EXISTS (
            SELECT 1
              FROM public.proposal_publications replacement
             WHERE replacement.id = NEW.superseded_by
               AND replacement.project_id = NEW.project_id
               AND replacement.version_number > NEW.version_number
        ) THEN
            RAISE EXCEPTION 'A superseding publication must be a newer version of the same project.'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_proposal_publication_immutable_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_proposal_publication_immutable_fields
    ON public.proposal_publications;
CREATE TRIGGER trg_guard_proposal_publication_immutable_fields
BEFORE UPDATE ON public.proposal_publications
FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_publication_immutable_fields();

CREATE OR REPLACE FUNCTION public.guard_project_publication_pointers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.current_proposal_publication_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM public.proposal_publications publication
            WHERE publication.id = NEW.current_proposal_publication_id
              AND publication.project_id = NEW.id
              AND publication.owner_user_id = NEW.user_id
              AND publication.organization_id IS NOT DISTINCT FROM NEW.organization_id
       ) THEN
        RAISE EXCEPTION 'Current proposal publication does not belong to this project.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.accepted_proposal_publication_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
             FROM public.proposal_publications publication
            WHERE publication.id = NEW.accepted_proposal_publication_id
              AND publication.project_id = NEW.id
              AND publication.owner_user_id = NEW.user_id
              AND publication.organization_id IS NOT DISTINCT FROM NEW.organization_id
              AND publication.status = 'accepted'
       ) THEN
        RAISE EXCEPTION 'Accepted proposal publication is invalid for this project.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_project_publication_pointers() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_project_publication_pointers ON public.projects;
CREATE TRIGGER trg_guard_project_publication_pointers
BEFORE INSERT OR UPDATE OF current_proposal_publication_id, accepted_proposal_publication_id
ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_publication_pointers();

ALTER TABLE public.proposal_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_delivery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proposal_publications_owner_read ON public.proposal_publications;
CREATE POLICY proposal_publications_owner_read
ON public.proposal_publications
FOR SELECT
TO authenticated
USING (
    owner_user_id = auth.uid()
    AND EXISTS (
        SELECT 1
          FROM public.organization_members membership
         WHERE membership.organization_id = proposal_publications.organization_id
           AND membership.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS proposal_publication_events_owner_read ON public.proposal_publication_events;
CREATE POLICY proposal_publication_events_owner_read
ON public.proposal_publication_events
FOR SELECT
TO authenticated
USING (
    owner_user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.organization_members membership
         WHERE membership.organization_id = proposal_publication_events.organization_id
           AND membership.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS proposal_delivery_attempts_owner_read ON public.proposal_delivery_attempts;
CREATE POLICY proposal_delivery_attempts_owner_read
ON public.proposal_delivery_attempts
FOR SELECT
TO authenticated
USING (
    owner_user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.organization_members membership
         WHERE membership.organization_id = proposal_delivery_attempts.organization_id
           AND membership.user_id = auth.uid()
    )
);

REVOKE ALL ON TABLE public.proposal_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proposal_publications TO authenticated;
GRANT ALL ON TABLE public.proposal_publications TO service_role;
REVOKE ALL ON TABLE public.proposal_publication_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proposal_publication_events TO authenticated;
GRANT ALL ON TABLE public.proposal_publication_events TO service_role;
REVOKE ALL ON TABLE public.proposal_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proposal_delivery_attempts TO authenticated;
GRANT ALL ON TABLE public.proposal_delivery_attempts TO service_role;

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

CREATE OR REPLACE FUNCTION public.record_proposal_delivery_attempt(
    p_delivery_id uuid,
    p_succeeded boolean,
    p_provider_message_id text DEFAULT NULL,
    p_error_code text DEFAULT NULL
)
RETURNS TABLE (delivery_status text, attempt_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_delivery public.proposal_delivery_attempts%ROWTYPE;
BEGIN
    SELECT delivery.*
      INTO v_delivery
      FROM public.proposal_delivery_attempts delivery
     WHERE delivery.id = p_delivery_id
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery record not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_delivery.status = 'sent' THEN
        RETURN QUERY SELECT v_delivery.status, v_delivery.attempt_count;
        RETURN;
    END IF;

    UPDATE public.proposal_delivery_attempts AS target
       SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
           attempt_count = target.attempt_count + 1,
           last_attempt_at = now(),
           sent_at = CASE WHEN p_succeeded THEN now() ELSE NULL END,
           provider_message_id = CASE WHEN p_succeeded THEN left(p_provider_message_id, 500) ELSE NULL END,
           last_error_code = CASE WHEN p_succeeded THEN NULL ELSE left(COALESCE(p_error_code, 'unknown'), 200) END
     WHERE target.id = v_delivery.id
     RETURNING * INTO v_delivery;

    INSERT INTO public.proposal_publication_events (
        publication_id, organization_id, owner_user_id, event_type,
        actor_kind, details, occurred_at
    ) VALUES (
        v_delivery.publication_id,
        v_delivery.organization_id,
        v_delivery.owner_user_id,
        CASE WHEN p_succeeded THEN 'delivery_sent' ELSE 'delivery_failed' END,
        'system',
        jsonb_build_object(
            'delivery_id', v_delivery.id,
            'attempt_count', v_delivery.attempt_count,
            'provider_message_id', CASE WHEN p_succeeded THEN v_delivery.provider_message_id ELSE NULL END,
            'error_code', CASE WHEN p_succeeded THEN NULL ELSE v_delivery.last_error_code END
        ),
        v_delivery.last_attempt_at
    );

    RETURN QUERY SELECT v_delivery.status, v_delivery.attempt_count;
END;
$$;

REVOKE ALL ON FUNCTION public.record_proposal_delivery_attempt(uuid, boolean, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_proposal_delivery_attempt(uuid, boolean, text, text)
    TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_proposal_publication(
    p_token_hash text,
    p_mark_viewed boolean DEFAULT true
)
RETURNS TABLE (
    publication_id uuid,
    project_id uuid,
    owner_user_id uuid,
    publication_status text,
    snapshot jsonb,
    first_viewed_at timestamptz,
    responded_at timestamptz,
    responded_by text,
    was_just_viewed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_publication public.proposal_publications%ROWTYPE;
    v_just_viewed boolean := false;
BEGIN
    IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN;
    END IF;

    SELECT publication.*
      INTO v_publication
      FROM public.proposal_publications publication
     WHERE publication.token_hash = p_token_hash
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF p_mark_viewed
       AND v_publication.status = 'sent'
       AND v_publication.expires_at > now() THEN
        UPDATE public.proposal_publications AS target
           SET status = 'viewed', first_viewed_at = COALESCE(target.first_viewed_at, now())
         WHERE target.id = v_publication.id
         RETURNING * INTO v_publication;
        v_just_viewed := true;
        INSERT INTO public.proposal_publication_events (
            publication_id, organization_id, owner_user_id, event_type,
            actor_kind, details, occurred_at
        ) VALUES (
            v_publication.id, v_publication.organization_id,
            v_publication.owner_user_id, 'viewed', 'client', '{}'::jsonb,
            v_publication.first_viewed_at
        );
    END IF;

    RETURN QUERY SELECT
        v_publication.id,
        v_publication.project_id,
        v_publication.owner_user_id,
        v_publication.status,
        v_publication.snapshot,
        v_publication.first_viewed_at,
        v_publication.responded_at,
        v_publication.responded_by,
        v_just_viewed;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_proposal_publication(text, boolean)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_proposal_publication(text, boolean)
    TO service_role;

CREATE OR REPLACE FUNCTION public.respond_to_proposal_publication(
    p_token_hash text,
    p_response text,
    p_name text,
    p_email text DEFAULT NULL,
    p_note text DEFAULT NULL
)
RETURNS TABLE (
    publication_id uuid,
    project_id uuid,
    owner_user_id uuid,
    publication_status text,
    snapshot jsonb,
    responded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_publication public.proposal_publications%ROWTYPE;
    v_mode text;
    v_name text := btrim(COALESCE(p_name, ''));
    v_email text := NULLIF(btrim(COALESCE(p_email, '')), '');
    v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
    IF p_token_hash !~ '^[a-f0-9]{64}$'
       OR length(v_name) < 2 OR length(v_name) > 200
       OR (v_email IS NOT NULL AND length(v_email) > 320)
       OR (v_note IS NOT NULL AND length(v_note) > 5000) THEN
        RAISE EXCEPTION 'Invalid proposal response.' USING ERRCODE = '22023';
    END IF;

    SELECT publication.*
      INTO v_publication
      FROM public.proposal_publications publication
     WHERE publication.token_hash = p_token_hash
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002';
    END IF;

    v_mode := v_publication.snapshot#>>'{publication,response_mode}';
    IF (v_mode = 'acknowledgement' AND p_response <> 'acknowledged')
       OR (v_mode = 'binding_acceptance' AND p_response NOT IN ('accepted', 'declined'))
       OR v_mode NOT IN ('acknowledgement', 'binding_acceptance') THEN
        RAISE EXCEPTION 'Response is not permitted for this proposal.' USING ERRCODE = '23514';
    END IF;

    IF v_publication.status = p_response THEN
        IF v_publication.responded_by IS DISTINCT FROM v_name
           OR v_publication.responded_email IS DISTINCT FROM v_email THEN
            RAISE EXCEPTION 'This proposal already has a different recorded response.' USING ERRCODE = '23514';
        END IF;
        RETURN QUERY SELECT v_publication.id, v_publication.project_id,
            v_publication.owner_user_id, v_publication.status,
            v_publication.snapshot, v_publication.responded_at;
        RETURN;
    END IF;

    IF v_publication.status NOT IN ('sent', 'viewed')
       OR v_publication.expires_at <= now()
       OR v_publication.superseded_by IS NOT NULL THEN
        RAISE EXCEPTION 'This proposal can no longer receive a response.' USING ERRCODE = '23514';
    END IF;

    UPDATE public.proposal_publications
       SET status = p_response,
           responded_at = now(),
           responded_by = v_name,
           responded_email = v_email,
           response_note = v_note,
           first_viewed_at = COALESCE(first_viewed_at, now())
     WHERE id = v_publication.id
     RETURNING * INTO v_publication;

    UPDATE public.projects
       SET current_proposal_publication_id = v_publication.id,
           accepted_proposal_publication_id = CASE
               WHEN p_response = 'accepted' THEN v_publication.id
               ELSE accepted_proposal_publication_id
           END,
           proposal_status = p_response,
           proposal_accepted_at = CASE
               WHEN p_response = 'accepted' THEN v_publication.responded_at
               ELSE proposal_accepted_at
           END,
           proposal_accepted_by = CASE
               WHEN p_response = 'accepted' THEN v_name
               ELSE proposal_accepted_by
           END,
           client_email = COALESCE(v_email, client_email),
           status = CASE WHEN p_response = 'accepted' THEN 'Won' ELSE status END
     WHERE id = v_publication.project_id
       AND user_id = v_publication.owner_user_id;

    INSERT INTO public.proposal_publication_events (
        publication_id, organization_id, owner_user_id, event_type,
        actor_kind, details, occurred_at
    ) VALUES (
        v_publication.id, v_publication.organization_id,
        v_publication.owner_user_id, p_response, 'client',
        jsonb_build_object('responded_by', v_name), v_publication.responded_at
    );

    RETURN QUERY SELECT v_publication.id, v_publication.project_id,
        v_publication.owner_user_id, v_publication.status,
        v_publication.snapshot, v_publication.responded_at;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_proposal_publication(text, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_proposal_publication(text, text, text, text, text)
    TO service_role;

COMMENT ON TABLE public.proposal_publications IS
    'Immutable client-safe sent proposal versions. Public token access is server-only by SHA-256 digest.';
COMMENT ON COLUMN public.proposal_publications.snapshot IS
    'Versioned client document model. Must never contain internal cost, markup, margin or supplier fields.';

COMMIT;
