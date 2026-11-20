-- Operator rollback for 20261120174500_founding_cohort_ai_monthly_pence_caps.sql
-- SOURCE ONLY — do not place under supabase/migrations (glob replay would apply it).
-- Restores reserve/finish from 20261009090000_ai_generation_budget.sql and drops new columns.

BEGIN;

DROP FUNCTION IF EXISTS public.ai_generation_counted_pence(timestamptz, integer, integer);

CREATE OR REPLACE FUNCTION public.ai_generation_reserve(
    p_user_id uuid,
    p_feature text,
    p_reserve_output_tokens integer,
    p_source_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_feature public.ai_generation_features%ROWTYPE;
    v_contractor public.ai_generation_limits%ROWTYPE;
    v_global public.ai_generation_limits%ROWTYPE;
    v_hour_attempts integer;
    v_day_attempts integer;
    v_day_tokens bigint;
    v_id uuid;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'A contractor is required.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('ai_generation:global', 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('ai_generation:contractor:' || p_user_id::text, 0));

    SELECT * INTO v_feature FROM public.ai_generation_features WHERE feature = p_feature;
    SELECT * INTO v_contractor FROM public.ai_generation_limits WHERE scope = 'contractor';
    SELECT * INTO v_global FROM public.ai_generation_limits WHERE scope = 'global';
    IF v_feature.feature IS NULL OR v_feature.enabled IS NOT TRUE OR v_contractor.scope IS NULL OR v_global.scope IS NULL THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    IF p_reserve_output_tokens IS NULL OR p_reserve_output_tokens < 1 OR p_reserve_output_tokens > v_feature.max_reserve_output_tokens THEN
        RAISE EXCEPTION 'The output reserved for % must be between 1 and % tokens.', p_feature, v_feature.max_reserve_output_tokens
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    UPDATE public.ai_generation_attempts
    SET finished_at = now(), outcome = 'abandoned'
    WHERE user_id = p_user_id AND finished_at IS NULL AND started_at < now() - interval '2 minutes';

    IF EXISTS (SELECT 1 FROM public.ai_generation_attempts WHERE user_id = p_user_id AND finished_at IS NULL) THEN
        RETURN jsonb_build_object('status', 'in-flight');
    END IF;

    SELECT count(*) FILTER (WHERE started_at > now() - interval '1 hour'), count(*), coalesce(sum(charged_output_tokens), 0)
    INTO v_hour_attempts, v_day_attempts, v_day_tokens
    FROM public.ai_generation_attempts
    WHERE user_id = p_user_id AND started_at > now() - interval '24 hours';

    IF (v_contractor.per_hour_attempts IS NOT NULL AND v_hour_attempts >= v_contractor.per_hour_attempts)
        OR v_day_attempts >= v_contractor.per_day_attempts THEN
        RETURN jsonb_build_object('status', 'attempt-limit');
    END IF;
    IF v_day_tokens + p_reserve_output_tokens > v_contractor.per_day_output_tokens THEN
        RETURN jsonb_build_object('status', 'token-limit');
    END IF;

    SELECT count(*), coalesce(sum(charged_output_tokens), 0)
    INTO v_day_attempts, v_day_tokens
    FROM public.ai_generation_attempts
    WHERE started_at > now() - interval '24 hours';

    IF v_day_attempts >= v_global.per_day_attempts OR v_day_tokens + p_reserve_output_tokens > v_global.per_day_output_tokens THEN
        RETURN jsonb_build_object('status', 'service-limit');
    END IF;

    INSERT INTO public.ai_generation_attempts (user_id, feature, reserved_output_tokens, source_fingerprint)
    VALUES (p_user_id, p_feature, p_reserve_output_tokens, p_source_fingerprint)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('status', 'reserved', 'attempt_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_generation_finish(
    p_user_id uuid,
    p_attempt_id uuid,
    p_outcome text,
    p_prompt_tokens integer,
    p_completion_tokens integer,
    p_model text,
    p_prompt_version text
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF p_outcome IS NULL OR p_outcome NOT IN ('ok', 'rejected:schema', 'rejected:tripwire', 'sources-moved', 'error') THEN
        RAISE EXCEPTION 'Unknown AI attempt outcome.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_outcome = 'ok' AND p_completion_tokens IS NULL THEN
        RAISE EXCEPTION 'A successful AI attempt must record its usage.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    UPDATE public.ai_generation_attempts
    SET finished_at = now(),
        outcome = p_outcome,
        prompt_tokens = p_prompt_tokens,
        completion_tokens = p_completion_tokens,
        model = left(p_model, 100),
        prompt_version = left(p_prompt_version, 60)
    WHERE id = p_attempt_id AND user_id = p_user_id AND finished_at IS NULL;
    RETURN FOUND;
END;
$$;

ALTER TABLE public.ai_generation_attempts DROP COLUMN IF EXISTS charged_pence;
ALTER TABLE public.ai_generation_attempts DROP COLUMN IF EXISTS reserved_pence;
ALTER TABLE public.ai_generation_features DROP COLUMN IF EXISTS max_reserve_pence;
ALTER TABLE public.ai_generation_limits DROP COLUMN IF EXISTS per_calendar_month_max_pence;

COMMIT;