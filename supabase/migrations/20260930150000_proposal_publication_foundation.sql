-- Immutable proposal publication foundation. A draft project is not a public
-- proposal; each send creates a versioned record whose client-safe snapshot,
-- canonical value and validity window cannot drift with later project edits.

BEGIN;

CREATE TABLE IF NOT EXISTS public.proposal_publications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    version_number integer NOT NULL CHECK (version_number > 0),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    status text NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'viewed', 'accepted', 'declined', 'revoked')),
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
        (status IN ('accepted', 'declined') AND responded_at IS NOT NULL AND responded_by IS NOT NULL)
        OR (status NOT IN ('accepted', 'declined') AND responded_at IS NULL)
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
        (OLD.status = 'sent' AND NEW.status IN ('viewed', 'accepted', 'declined', 'revoked'))
        OR (OLD.status = 'viewed' AND NEW.status IN ('accepted', 'declined', 'revoked'))
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

REVOKE ALL ON TABLE public.proposal_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.proposal_publications TO authenticated;
GRANT ALL ON TABLE public.proposal_publications TO service_role;

COMMENT ON TABLE public.proposal_publications IS
    'Immutable client-safe sent proposal versions. Public token access is server-only by SHA-256 digest.';
COMMENT ON COLUMN public.proposal_publications.snapshot IS
    'Versioned client document model. Must never contain internal cost, markup, margin or supplier fields.';

COMMIT;
