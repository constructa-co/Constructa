-- Stage 2G.3.2, candidate B: an AI-worded draft must be tied to a real,
-- budgeted, successful attempt.
--
-- Until now a draft could be saved with generator = 'ai' and nothing to show
-- that a provider call had been reserved, made and recorded. This migration
-- closes that:
--
--   * a draft gains ai_attempt_id, and a draft is 'ai' if and only if it has one;
--   * the function that saves a draft is REPLACED, not added to. The earlier
--     signature is dropped, so there is no older way to save an 'ai' draft
--     without an attempt;
--   * the new function accepts an 'ai' draft only with an attempt that is this
--     contractor's, for company.introduction, finished 'ok', written from
--     exactly the sources the draft states, carrying the same model and prompt
--     version, and not already attached to another draft. A 'template' draft
--     must have no attempt and no model.
--
-- Everything else about saving a draft is unchanged from the reviewed
-- function: the contractor's lock, the profile row lock, the comparison of
-- the stated sources with the current ones before anything is written, and
-- no insert and no retirement of an earlier draft on any refusal.
--
-- This does NOT switch AI wording on. company.introduction stays disabled in
-- ai_generation_features; no reservation can be made for it, so no attempt
-- can finish 'ok', so no 'ai' draft can be saved. Switching it on is a
-- separate, later, reviewed migration.

BEGIN;

ALTER TABLE public.company_narrative_drafts
    ADD COLUMN ai_attempt_id uuid REFERENCES public.ai_generation_attempts(id);

-- One attempt, one draft at most.
ALTER TABLE public.company_narrative_drafts
    ADD CONSTRAINT company_narrative_drafts_ai_attempt_once UNIQUE (ai_attempt_id);

-- 'ai' exactly when there is an attempt; an 'ai' draft names its model, a template names none.
ALTER TABLE public.company_narrative_drafts
    ADD CONSTRAINT company_narrative_drafts_ai_needs_attempt CHECK (
        (generator = 'ai' AND ai_attempt_id IS NOT NULL AND model IS NOT NULL)
        OR (generator = 'template' AND ai_attempt_id IS NULL AND model IS NULL)
    );

-- The earlier signature goes. Nothing may be left that can save without the attempt rule.
DROP FUNCTION public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text);

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
    p_expected_fingerprint text,
    p_ai_attempt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_draft public.company_narrative_drafts%ROWTYPE;
    v_attempt public.ai_generation_attempts%ROWTYPE;
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

    -- Who wrote it, and the proof. Checked before anything is retired or inserted.
    IF p_generator = 'template' THEN
        IF p_ai_attempt_id IS NOT NULL OR p_model IS NOT NULL THEN
            RETURN jsonb_build_object('outcome', 'invalid-attempt');
        END IF;
    ELSIF p_generator = 'ai' THEN
        IF p_ai_attempt_id IS NULL OR p_model IS NULL OR p_generator_version IS NULL THEN
            RETURN jsonb_build_object('outcome', 'invalid-attempt');
        END IF;
        -- A finished attempt cannot change, so reading it is enough.
        SELECT * INTO v_attempt FROM public.ai_generation_attempts
        WHERE id = p_ai_attempt_id AND user_id = p_user_id;
        IF NOT FOUND
            OR v_attempt.feature <> 'company.introduction'
            OR v_attempt.outcome IS DISTINCT FROM 'ok'
            OR v_attempt.source_fingerprint IS DISTINCT FROM p_expected_fingerprint
            OR v_attempt.model IS DISTINCT FROM p_model
            OR v_attempt.prompt_version IS DISTINCT FROM p_generator_version
            OR EXISTS (SELECT 1 FROM public.company_narrative_drafts WHERE ai_attempt_id = p_ai_attempt_id) THEN
            RETURN jsonb_build_object('outcome', 'invalid-attempt');
        END IF;
    ELSE
        RETURN jsonb_build_object('outcome', 'invalid-attempt');
    END IF;

    UPDATE public.company_narrative_drafts SET status = 'superseded'
    WHERE user_id = p_user_id AND section = p_section AND status = 'draft';

    INSERT INTO public.company_narrative_drafts
        (user_id, section, draft_text, generator, generator_version, model, question_set_version, based_on, facts, answers_fingerprint, profile_baseline, ai_attempt_id)
    VALUES
        (p_user_id, p_section, p_draft_text, p_generator, p_generator_version, p_model, p_question_set_version,
         coalesce(p_based_on, '[]'::jsonb), coalesce(p_facts, '[]'::jsonb), p_expected_fingerprint, p_profile_baseline, p_ai_attempt_id)
    RETURNING * INTO v_draft;
    RETURN jsonb_build_object('outcome', 'saved', 'draft', to_jsonb(v_draft));
END;
$$;

REVOKE ALL ON FUNCTION public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_narrative_save_draft(uuid, text, text, text, text, text, text, jsonb, jsonb, text, text, uuid) TO service_role;

COMMIT;
