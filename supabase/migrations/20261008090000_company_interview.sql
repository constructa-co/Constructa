-- Stage 2G.3.1: guided company interview.
--
-- Three layers that are never merged silently:
--
--   answers  what the contractor said, one row per question, with a revision;
--   drafts   text the server assembled from those answers, and the facts it
--            offers, with what they were built from;
--   profile  public.profiles, which a proposal is built from, and which only
--            an explicit approval (or the contractor's own Profile form)
--            changes.
--
-- Signed-in contractors may READ their own answers and drafts. Every write
-- goes through the three functions below, which only the server's service
-- role may execute, after the application has authenticated the contractor.
-- Each function takes that contractor's id and touches only their rows.
--
-- Nothing here reads public.company_import_drafts. A website suggestion is
-- not a fact until it has been approved into the profile.

BEGIN;

CREATE TABLE public.company_interview_answers (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_key text NOT NULL,
    answer text NOT NULL DEFAULT '',
    skipped boolean NOT NULL DEFAULT false,
    -- Goes up by one on every save. A save must name the revision it replaces.
    revision integer NOT NULL DEFAULT 1,
    question_set_version text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, question_key),
    CONSTRAINT company_interview_answers_key CHECK (question_key ~ '^[a-z][a-z_]{0,39}$'),
    CONSTRAINT company_interview_answers_length CHECK (char_length(answer) <= 600),
    CONSTRAINT company_interview_answers_version CHECK (char_length(question_set_version) BETWEEN 1 AND 40),
    CONSTRAINT company_interview_answers_revision CHECK (revision >= 1)
);

CREATE TABLE public.company_narrative_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section text NOT NULL,
    draft_text text NOT NULL,
    -- 'template' is assembled by fixed rules. 'ai' is reserved for a later slice.
    generator text NOT NULL,
    generator_version text NOT NULL,
    model text,
    question_set_version text NOT NULL,
    -- The answers and saved profile values the text was assembled from.
    based_on jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Facts offered for individual approval, each the contractor's own words.
    facts jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- The exact sources this text was written from: the revision of every
    -- answer and the business name, as one fingerprint. The server states which
    -- sources it read; the database stores that only if they are still current.
    answers_fingerprint text NOT NULL,
    -- The saved introduction the contractor is shown beside the draft.
    profile_baseline text,
    status text NOT NULL DEFAULT 'draft',
    approved_text text,
    -- True when the contractor changed the text before approving it: their words, not the server's.
    approved_edited boolean,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_narrative_drafts_section CHECK (section IN ('introduction')),
    CONSTRAINT company_narrative_drafts_generator CHECK (generator IN ('template', 'ai')),
    CONSTRAINT company_narrative_drafts_status CHECK (status IN ('draft', 'approved', 'superseded')),
    CONSTRAINT company_narrative_drafts_text CHECK (char_length(draft_text) <= 2000 AND (approved_text IS NULL OR char_length(approved_text) <= 2000)),
    CONSTRAINT company_narrative_drafts_based_on CHECK (jsonb_typeof(based_on) = 'array' AND pg_column_size(based_on) <= 32768),
    CONSTRAINT company_narrative_drafts_facts CHECK (jsonb_typeof(facts) = 'array' AND pg_column_size(facts) <= 16384)
);

CREATE INDEX company_narrative_drafts_user_created_idx
    ON public.company_narrative_drafts (user_id, created_at DESC);

ALTER TABLE public.company_interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_narrative_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read their own interview answers"
    ON public.company_interview_answers FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Contractors read their own narrative drafts"
    ON public.company_narrative_drafts FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.company_interview_answers, public.company_narrative_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.company_interview_answers, public.company_narrative_drafts TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.company_interview_answers, public.company_narrative_drafts TO service_role;

-- The sources a draft is written from, as they are right now: which revision
-- of every answer exists, and the saved business name (the introduction names
-- the business). Any change to either gives a different fingerprint.
CREATE FUNCTION public.company_interview_fingerprint(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT md5(
        coalesce((
            SELECT string_agg(question_key || ':' || revision::text || ':' || skipped::text, '|' ORDER BY question_key COLLATE "C")
            FROM public.company_interview_answers
            WHERE user_id = p_user_id
        ), '')
        || '#'
        || coalesce((SELECT company_name FROM public.profiles WHERE id = p_user_id), '')
    );
$$;

-- Saves one answer if, and only if, the caller has seen the latest revision.
-- p_expected_revision is 0 for a question that has never been answered.
CREATE FUNCTION public.company_interview_save_answer(
    p_user_id uuid,
    p_question_key text,
    p_answer text,
    p_skipped boolean,
    p_expected_revision integer,
    p_question_set_version text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_row public.company_interview_answers%ROWTYPE;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A contractor is required.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- Serialises saves for one contractor, so a first answer cannot be inserted twice.
    PERFORM pg_advisory_xact_lock(hashtextextended('company_interview:' || p_user_id::text, 0));

    SELECT * INTO v_row FROM public.company_interview_answers
    WHERE user_id = p_user_id AND question_key = p_question_key
    FOR UPDATE;

    IF NOT FOUND THEN
        IF coalesce(p_expected_revision, 0) <> 0 THEN
            RETURN jsonb_build_object('outcome', 'conflict', 'revision', 0, 'answer', '', 'skipped', false);
        END IF;
        INSERT INTO public.company_interview_answers (user_id, question_key, answer, skipped, question_set_version)
        VALUES (p_user_id, p_question_key, coalesce(p_answer, ''), coalesce(p_skipped, false), p_question_set_version)
        RETURNING * INTO v_row;
        RETURN jsonb_build_object('outcome', 'saved', 'revision', v_row.revision);
    END IF;

    IF v_row.revision IS DISTINCT FROM p_expected_revision THEN
        RETURN jsonb_build_object('outcome', 'conflict', 'revision', v_row.revision, 'answer', v_row.answer, 'skipped', v_row.skipped);
    END IF;

    UPDATE public.company_interview_answers
    SET answer = coalesce(p_answer, ''), skipped = coalesce(p_skipped, false), revision = v_row.revision + 1,
        question_set_version = p_question_set_version, updated_at = now()
    WHERE user_id = p_user_id AND question_key = p_question_key
    RETURNING * INTO v_row;
    RETURN jsonb_build_object('outcome', 'saved', 'revision', v_row.revision);
END;
$$;

-- Saves a draft and retires the contractor's earlier unapproved one, but only
-- if the sources it was written from are still the current ones.
--
-- The caller reads the answers and the business name, writes the text, and
-- then calls this. Those are separate steps, so something can change in
-- between. p_expected_fingerprint says which sources the text was written
-- from. It is compared here, under the contractor's lock and with their
-- profile row locked, with the sources as they are now. If they differ the
-- text is out of date: nothing is inserted, nothing is retired, and the caller
-- is told to read again. A draft is never stamped with a fingerprint other
-- than the one its text was written from.
CREATE FUNCTION public.company_narrative_save_draft(
    p_user_id uuid,
    p_section text,
    p_draft_text text,
    p_generator text,
    p_generator_version text,
    p_model text,
    p_question_set_version text,
    p_based_on jsonb,
    p_facts jsonb,
    p_profile_baseline text,
    p_expected_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_draft public.company_narrative_drafts%ROWTYPE;
    v_current text;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A contractor is required.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_expected_fingerprint IS NULL OR p_expected_fingerprint !~ '^[0-9a-f]{32}$' THEN
        RAISE EXCEPTION 'The sources a draft was written from must be stated.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- Answer saves take the same lock, and the profile row is held, so neither
    -- source can change between the comparison and the insert.
    PERFORM pg_advisory_xact_lock(hashtextextended('company_interview:' || p_user_id::text, 0));
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    v_current := public.company_interview_fingerprint(p_user_id);
    IF v_current IS DISTINCT FROM p_expected_fingerprint THEN
        RETURN jsonb_build_object('outcome', 'stale-source');
    END IF;

    UPDATE public.company_narrative_drafts SET status = 'superseded'
    WHERE user_id = p_user_id AND section = p_section AND status = 'draft';

    INSERT INTO public.company_narrative_drafts
        (user_id, section, draft_text, generator, generator_version, model, question_set_version, based_on, facts, answers_fingerprint, profile_baseline)
    VALUES
        (p_user_id, p_section, p_draft_text, p_generator, p_generator_version, p_model, p_question_set_version,
         coalesce(p_based_on, '[]'::jsonb), coalesce(p_facts, '[]'::jsonb), p_expected_fingerprint, p_profile_baseline)
    RETURNING * INTO v_draft;
    RETURN jsonb_build_object('outcome', 'saved', 'draft', to_jsonb(v_draft));
END;
$$;

-- Approves one thing from a draft: the introduction, or one offered fact.
-- The profile column and the approval record change together or not at all.
--
--   * refused if any source has changed since the draft was written: an answer
--     or the business name (worked out here from the tables, with the profile
--     row locked, not taken on trust);
--   * refused if the profile no longer holds the value the contractor was shown;
--   * a fact's value is the one saved in the draft, never one sent with the call;
--   * the introduction may be the contractor's own edit of the draft, which is
--     then recorded as edited by them.
CREATE FUNCTION public.company_narrative_approve(
    p_user_id uuid,
    p_draft_id uuid,
    p_target text,
    p_text text,
    p_expected_existing text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_draft public.company_narrative_drafts%ROWTYPE;
    v_text text;
    v_index integer;
    v_fact jsonb;
    v_value text;
    v_current text;
    v_rows integer;
BEGIN
    IF p_target IS NULL OR p_target NOT IN ('introduction', 'years_trading', 'accreditations', 'insurance_details') THEN
        RETURN jsonb_build_object('outcome', 'unavailable');
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('company_interview:' || p_user_id::text, 0));
    -- Held to the end, so the business name cannot change between the source check and the write.
    PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    SELECT * INTO v_draft FROM public.company_narrative_drafts
    WHERE id = p_draft_id AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'not-found');
    END IF;
    IF v_draft.status = 'superseded' THEN
        RETURN jsonb_build_object('outcome', 'stale-answers');
    END IF;
    IF v_draft.answers_fingerprint IS DISTINCT FROM public.company_interview_fingerprint(p_user_id) THEN
        RETURN jsonb_build_object('outcome', 'stale-answers');
    END IF;

    IF p_target = 'introduction' THEN
        IF v_draft.status <> 'draft' THEN
            RETURN jsonb_build_object('outcome', 'unavailable');
        END IF;
        v_text := btrim(coalesce(p_text, v_draft.draft_text));
        -- Plain text of a sensible length, whoever wrote it.
        IF v_text = '' OR char_length(v_text) > 2000 OR v_text ~ '[<>]' OR v_text ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' THEN
            RETURN jsonb_build_object('outcome', 'invalid-text');
        END IF;

        UPDATE public.profiles SET capability_statement = v_text
        WHERE id = p_user_id AND capability_statement IS NOT DISTINCT FROM p_expected_existing;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN
            SELECT capability_statement INTO v_current FROM public.profiles WHERE id = p_user_id;
            UPDATE public.company_narrative_drafts SET profile_baseline = v_current WHERE id = p_draft_id AND user_id = p_user_id;
            RETURN jsonb_build_object('outcome', 'conflict', 'current', v_current);
        END IF;

        UPDATE public.company_narrative_drafts
        SET status = 'approved', approved_text = v_text, approved_edited = (v_text IS DISTINCT FROM btrim(v_draft.draft_text)),
            approved_at = now(), profile_baseline = v_text
        WHERE id = p_draft_id AND user_id = p_user_id;
        RETURN jsonb_build_object('outcome', 'applied', 'edited', v_text IS DISTINCT FROM btrim(v_draft.draft_text));
    END IF;

    -- A fact: the contractor's own answer, as saved in the draft.
    SELECT (t.ord - 1)::integer, t.elem INTO v_index, v_fact
    FROM jsonb_array_elements(v_draft.facts) WITH ORDINALITY AS t(elem, ord)
    WHERE t.elem->>'field' = p_target
    ORDER BY t.ord
    LIMIT 1;
    v_value := v_fact->>'proposed';
    IF v_fact IS NULL OR v_fact->>'status' = 'applied' OR v_value IS NULL OR btrim(v_value) = '' OR char_length(v_value) > 600 THEN
        RETURN jsonb_build_object('outcome', 'unavailable');
    END IF;

    IF p_target = 'years_trading' THEN
        IF v_value !~ '^[0-9]{1,3}$' THEN
            RETURN jsonb_build_object('outcome', 'unavailable');
        END IF;
        UPDATE public.profiles SET years_trading = v_value::integer
        WHERE id = p_user_id AND years_trading::text IS NOT DISTINCT FROM p_expected_existing;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN SELECT years_trading::text INTO v_current FROM public.profiles WHERE id = p_user_id; END IF;
    ELSIF p_target = 'accreditations' THEN
        UPDATE public.profiles SET accreditations = v_value
        WHERE id = p_user_id AND accreditations IS NOT DISTINCT FROM p_expected_existing;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN SELECT accreditations INTO v_current FROM public.profiles WHERE id = p_user_id; END IF;
    ELSE
        UPDATE public.profiles SET insurance_details = v_value
        WHERE id = p_user_id AND insurance_details IS NOT DISTINCT FROM p_expected_existing;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 1 THEN SELECT insurance_details INTO v_current FROM public.profiles WHERE id = p_user_id; END IF;
    END IF;

    IF v_rows <> 1 THEN
        UPDATE public.company_narrative_drafts
        SET facts = jsonb_set(facts, ARRAY[v_index::text], v_fact || jsonb_build_object('existing', v_current))
        WHERE id = p_draft_id AND user_id = p_user_id;
        RETURN jsonb_build_object('outcome', 'conflict', 'current', v_current);
    END IF;

    UPDATE public.company_narrative_drafts
    SET facts = jsonb_set(facts, ARRAY[v_index::text], v_fact || jsonb_build_object(
        'status', 'applied', 'existing', v_value,
        'appliedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    WHERE id = p_draft_id AND user_id = p_user_id;
    RETURN jsonb_build_object('outcome', 'applied');
END;
$$;

REVOKE ALL ON FUNCTION public.company_interview_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_interview_save_answer(uuid, text, text, boolean, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_narrative_approve(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_interview_fingerprint(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_interview_save_answer(uuid, text, text, boolean, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.company_narrative_approve(uuid, uuid, text, text, text) TO service_role;

COMMIT;
