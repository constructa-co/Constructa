-- Stage 2G.2: reviewable drafts from a contractor's own website.
--
-- Provenance boundary. A draft says "the server read this from that page at
-- that time", and an approval says "the contractor accepted it". Both are
-- only worth anything if the browser cannot write them. So:
--
--   * signed-in contractors may READ their own drafts, and nothing more;
--   * drafts, attempts and approvals are written only by the functions
--     below, which only the server's service role may execute, and only
--     after the application has authenticated the contractor;
--   * every function takes the contractor's id and touches only their rows.
--
-- A draft is never read when a proposal is built: proposals come from
-- public.profiles, which only an explicit approval changes.

BEGIN;

-- ── Attempts: the fetch budget ───────────────────────────────────────────────
-- One row per time a website was about to be read, successful or not.

CREATE TABLE public.company_import_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    outcome text,
    CONSTRAINT company_import_attempts_outcome_short CHECK (outcome IS NULL OR char_length(outcome) <= 60)
);

CREATE INDEX company_import_attempts_user_started_idx
    ON public.company_import_attempts (user_id, started_at DESC);

-- At most one read in flight per contractor, enforced by the schema itself.
CREATE UNIQUE INDEX company_import_attempts_one_in_flight
    ON public.company_import_attempts (user_id) WHERE finished_at IS NULL;

ALTER TABLE public.company_import_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.company_import_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.company_import_attempts TO service_role;

-- ── Drafts ───────────────────────────────────────────────────────────────────

CREATE TABLE public.company_import_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_url text NOT NULL,
    website text NOT NULL,
    -- When the contractor confirmed the website is theirs to use.
    permission_confirmed_at timestamptz NOT NULL,
    fetched_at timestamptz NOT NULL,
    pages jsonb NOT NULL DEFAULT '[]'::jsonb,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- After this a draft can be read but nothing in it can be approved.
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    CONSTRAINT company_import_drafts_source_url_http CHECK (source_url ~ '^https?://' AND char_length(source_url) <= 2000),
    CONSTRAINT company_import_drafts_website_http CHECK (website ~ '^https?://' AND char_length(website) <= 300),
    CONSTRAINT company_import_drafts_pages_array CHECK (jsonb_typeof(pages) = 'array' AND pg_column_size(pages) <= 16384),
    CONSTRAINT company_import_drafts_items_array CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) <= 65536)
);

CREATE INDEX company_import_drafts_user_created_idx
    ON public.company_import_drafts (user_id, created_at DESC);

ALTER TABLE public.company_import_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read their own import drafts"
    ON public.company_import_drafts FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Read only. No INSERT, UPDATE or DELETE policy or grant exists for the
-- browser roles, so a draft cannot be forged, edited or erased from a browser.
REVOKE ALL PRIVILEGES ON TABLE public.company_import_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.company_import_drafts TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.company_import_drafts TO service_role;

-- Where a draft came from, when, and when it expires are fixed for every
-- role once it exists. Only the items' approval state changes afterwards.
CREATE FUNCTION public.company_import_drafts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.source_url IS DISTINCT FROM OLD.source_url
        OR NEW.website IS DISTINCT FROM OLD.website
        OR NEW.permission_confirmed_at IS DISTINCT FROM OLD.permission_confirmed_at
        OR NEW.fetched_at IS DISTINCT FROM OLD.fetched_at
        OR NEW.pages IS DISTINCT FROM OLD.pages
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'The source of an import draft cannot be changed.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER company_import_drafts_guard
    BEFORE UPDATE ON public.company_import_drafts
    FOR EACH ROW EXECUTE FUNCTION public.company_import_drafts_guard();

-- ── Server-only functions ────────────────────────────────────────────────────

-- Claims the right to read one website, before anything is fetched. Serialised
-- per contractor, so two simultaneous calls cannot both succeed. Counts every
-- attempt in the last hour, whatever became of it.
CREATE FUNCTION public.company_import_reserve_attempt(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A contractor is required.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('company_import:' || p_user_id::text, 0));

    -- A read that never reported back (a crashed request) stops blocking after two minutes.
    UPDATE public.company_import_attempts
    SET finished_at = now(), outcome = 'abandoned'
    WHERE user_id = p_user_id AND finished_at IS NULL AND started_at < now() - interval '2 minutes';

    IF EXISTS (SELECT 1 FROM public.company_import_attempts WHERE user_id = p_user_id AND finished_at IS NULL) THEN
        RETURN jsonb_build_object('status', 'in-flight');
    END IF;
    IF (SELECT count(*) FROM public.company_import_attempts
        WHERE user_id = p_user_id AND started_at > now() - interval '1 hour') >= 6 THEN
        RETURN jsonb_build_object('status', 'rate-limited');
    END IF;

    INSERT INTO public.company_import_attempts (user_id) VALUES (p_user_id) RETURNING id INTO v_id;
    RETURN jsonb_build_object('status', 'reserved', 'attempt_id', v_id);
END;
$$;

CREATE FUNCTION public.company_import_finish_attempt(p_user_id uuid, p_attempt_id uuid, p_outcome text)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
    UPDATE public.company_import_attempts
    SET finished_at = now(), outcome = left(p_outcome, 60)
    WHERE id = p_attempt_id AND user_id = p_user_id AND finished_at IS NULL;
$$;

-- Saves what one reserved read found and closes that read, together.
CREATE FUNCTION public.company_import_save_draft(
    p_user_id uuid,
    p_attempt_id uuid,
    p_source_url text,
    p_website text,
    p_permission_confirmed_at timestamptz,
    p_fetched_at timestamptz,
    p_pages jsonb,
    p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_draft public.company_import_drafts%ROWTYPE;
BEGIN
    UPDATE public.company_import_attempts
    SET finished_at = now(), outcome = 'drafted'
    WHERE id = p_attempt_id AND user_id = p_user_id AND finished_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No reserved read exists for this draft.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    INSERT INTO public.company_import_drafts (user_id, source_url, website, permission_confirmed_at, fetched_at, pages, items)
    VALUES (p_user_id, p_source_url, p_website, p_permission_confirmed_at, p_fetched_at, p_pages, p_items)
    RETURNING * INTO v_draft;
    RETURN to_jsonb(v_draft);
END;
$$;

-- Approves one suggestion: the profile column and the approval record change
-- in this one transaction or not at all. The value written is the one saved
-- in the draft. Nothing is written unless the profile still holds the value
-- the contractor was shown.
CREATE FUNCTION public.company_import_approve_item(
    p_user_id uuid,
    p_draft_id uuid,
    p_field text,
    p_expected_existing text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_draft public.company_import_drafts%ROWTYPE;
    v_index integer;
    v_item jsonb;
    v_proposed text;
    v_current text;
    v_rows integer;
    v_same boolean;
BEGIN
    -- The only profile columns an import may ever write.
    IF p_field IS NULL OR p_field NOT IN (
        'company_name', 'website', 'company_number', 'vat_number', 'specialisms', 'phone', 'sales_email', 'address'
    ) THEN
        RETURN jsonb_build_object('outcome', 'unavailable');
    END IF;

    SELECT * INTO v_draft
    FROM public.company_import_drafts
    WHERE id = p_draft_id AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_draft.expires_at <= now() THEN
        RETURN jsonb_build_object('outcome', 'expired');
    END IF;

    SELECT (t.ord - 1)::integer, t.elem INTO v_index, v_item
    FROM jsonb_array_elements(v_draft.items) WITH ORDINALITY AS t(elem, ord)
    WHERE t.elem->>'field' = p_field
    ORDER BY t.ord
    LIMIT 1;
    v_proposed := v_item->>'proposed';
    IF v_item IS NULL OR v_item->>'status' = 'applied' OR v_proposed IS NULL OR btrim(v_proposed) = '' OR char_length(v_proposed) > 1000 THEN
        RETURN jsonb_build_object('outcome', 'unavailable');
    END IF;

    EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2 AND %I IS NOT DISTINCT FROM $3', p_field, p_field)
    USING v_proposed, p_user_id, p_expected_existing;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 1 THEN
        v_item := v_item || jsonb_build_object(
            'status', 'applied',
            'existing', v_proposed,
            'appliedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        );
        UPDATE public.company_import_drafts
        SET items = jsonb_set(items, ARRAY[v_index::text], v_item)
        WHERE id = p_draft_id AND user_id = p_user_id;
        RETURN jsonb_build_object('outcome', 'applied');
    END IF;

    -- Nothing was written. Record what the profile says now, so the contractor decides against that.
    EXECUTE format('SELECT %I::text FROM public.profiles WHERE id = $1', p_field) INTO v_current USING p_user_id;
    v_same := lower(btrim(regexp_replace(coalesce(v_current, ''), '\s+', ' ', 'g')))
        = lower(btrim(regexp_replace(v_proposed, '\s+', ' ', 'g')));
    v_item := v_item || jsonb_build_object('existing', v_current, 'status', CASE WHEN v_same THEN 'same' ELSE 'pending' END);
    UPDATE public.company_import_drafts
    SET items = jsonb_set(items, ARRAY[v_index::text], v_item)
    WHERE id = p_draft_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'conflict', 'current', v_current);
END;
$$;

REVOKE ALL ON FUNCTION public.company_import_drafts_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_import_reserve_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_import_finish_attempt(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_import_save_draft(uuid, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_import_approve_item(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_import_reserve_attempt(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_import_finish_attempt(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_import_save_draft(uuid, uuid, text, text, timestamptz, timestamptz, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_import_approve_item(uuid, uuid, text, text) TO service_role;

COMMIT;
