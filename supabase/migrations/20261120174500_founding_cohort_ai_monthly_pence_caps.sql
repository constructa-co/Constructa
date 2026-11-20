-- SOURCE ONLY — NOT APPLIED until owner review.
-- Founding-cohort calendar-month spend ceilings on the existing ai_generation_* ledger.
-- Pence is stored as integers. Feature max_reserve_pence values are operator-authored in
-- SQL (verified upper bounds per feature), not computed from live API token prices.
--
-- Seeded: global month cap = 2500 pence (GBP 25); contractor month cap = 500 pence (GBP 5).
-- R1 scope: conservative contractor seed is not a verified billing rate.
-- Per-feature max_reserve_pence remains NULL until operator sets verified bounds;
-- features without a bound cannot reserve (fail-closed; never unlimited).

BEGIN;

ALTER TABLE public.ai_generation_limits
    ADD COLUMN IF NOT EXISTS per_calendar_month_max_pence integer,
    ADD CONSTRAINT ai_generation_limits_month_pence_positive CHECK (
        per_calendar_month_max_pence IS NULL OR per_calendar_month_max_pence >= 0
    );

ALTER TABLE public.ai_generation_features
    ADD COLUMN IF NOT EXISTS max_reserve_pence integer,
    ADD CONSTRAINT ai_generation_features_reserve_pence_positive CHECK (
        max_reserve_pence IS NULL OR max_reserve_pence >= 0
    );

ALTER TABLE public.ai_generation_attempts
    ADD COLUMN IF NOT EXISTS reserved_pence integer,
    ADD COLUMN IF NOT EXISTS charged_pence integer,
    ADD CONSTRAINT ai_generation_attempts_reserved_pence_positive CHECK (
        reserved_pence IS NULL OR reserved_pence > 0
    ),
    ADD CONSTRAINT ai_generation_attempts_charged_pence_positive CHECK (
        charged_pence IS NULL OR charged_pence >= 0
    );

UPDATE public.ai_generation_limits
SET per_calendar_month_max_pence = 2500
WHERE scope = 'global';

UPDATE public.ai_generation_limits
SET per_calendar_month_max_pence = 500
WHERE scope = 'contractor';

-- What one attempt row costs the monthly pence ledger. Immutable reserved_pence is set at
-- reserve time; finish charges from that snapshot, never from a later feature row.
CREATE OR REPLACE FUNCTION public.ai_generation_counted_pence(
    p_finished_at timestamptz,
    p_reserved_pence integer,
    p_charged_pence integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN p_reserved_pence IS NULL THEN NULL
        WHEN p_finished_at IS NULL THEN p_reserved_pence
        ELSE coalesce(p_charged_pence, p_reserved_pence)
    END;
$$;

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
    v_month_start timestamptz;
    v_month_end timestamptz;
    v_contractor_month_pence bigint;
    v_global_month_pence bigint;
    v_reserve_pence integer;
    v_unpriced_in_month boolean;
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

    -- No verified per-feature upper bound: monetary path is off (fail-closed).
    IF v_feature.max_reserve_pence IS NULL OR v_feature.max_reserve_pence <= 0
        OR v_contractor.per_calendar_month_max_pence IS NULL
        OR v_global.per_calendar_month_max_pence IS NULL THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    IF p_reserve_output_tokens IS NULL OR p_reserve_output_tokens < 1 OR p_reserve_output_tokens > v_feature.max_reserve_output_tokens THEN
        RAISE EXCEPTION 'The output reserved for % must be between 1 and % tokens.', p_feature, v_feature.max_reserve_output_tokens
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_reserve_pence := v_feature.max_reserve_pence;

    UPDATE public.ai_generation_attempts
    SET finished_at = now(),
        outcome = 'abandoned',
        charged_pence = reserved_pence
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

    -- UK calendar month in Europe/London (DST-safe month end).
    v_month_start := date_trunc('month', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London';
    v_month_end := (date_trunc('month', now() AT TIME ZONE 'Europe/London') + interval '1 month') AT TIME ZONE 'Europe/London';

    SELECT EXISTS (
        SELECT 1 FROM public.ai_generation_attempts a
        WHERE a.started_at >= v_month_start AND a.started_at < v_month_end AND a.reserved_pence IS NULL
    ) INTO v_unpriced_in_month;

    IF v_unpriced_in_month THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    SELECT coalesce(sum(public.ai_generation_counted_pence(a.finished_at, a.reserved_pence, a.charged_pence)), 0)
    INTO v_contractor_month_pence
    FROM public.ai_generation_attempts a
    WHERE a.user_id = p_user_id
      AND a.started_at >= v_month_start AND a.started_at < v_month_end
      AND a.reserved_pence IS NOT NULL;

    IF v_contractor.per_calendar_month_max_pence IS NOT NULL
        AND v_contractor_month_pence + v_reserve_pence > v_contractor.per_calendar_month_max_pence THEN
        RETURN jsonb_build_object('status', 'contractor-spend-cap');
    END IF;

    SELECT coalesce(sum(public.ai_generation_counted_pence(a.finished_at, a.reserved_pence, a.charged_pence)), 0)
    INTO v_global_month_pence
    FROM public.ai_generation_attempts a
    WHERE a.started_at >= v_month_start AND a.started_at < v_month_end
      AND a.reserved_pence IS NOT NULL;

    IF v_global.per_calendar_month_max_pence IS NOT NULL
        AND v_global_month_pence + v_reserve_pence > v_global.per_calendar_month_max_pence THEN
        RETURN jsonb_build_object('status', 'global-spend-cap');
    END IF;

    INSERT INTO public.ai_generation_attempts (
        user_id, feature, reserved_output_tokens, source_fingerprint, reserved_pence
    )
    VALUES (p_user_id, p_feature, p_reserve_output_tokens, p_source_fingerprint, v_reserve_pence)
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
DECLARE
    v_reserved_pence integer;
BEGIN
    IF p_outcome IS NULL OR p_outcome NOT IN ('ok', 'rejected:schema', 'rejected:tripwire', 'sources-moved', 'error') THEN
        RAISE EXCEPTION 'Unknown AI attempt outcome.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p_outcome = 'ok' AND p_completion_tokens IS NULL THEN
        RAISE EXCEPTION 'A successful AI attempt must record its usage.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT reserved_pence INTO v_reserved_pence
    FROM public.ai_generation_attempts
    WHERE id = p_attempt_id AND user_id = p_user_id AND finished_at IS NULL;

    IF v_reserved_pence IS NULL THEN
        RETURN false;
    END IF;

    -- Pence ledger charges the immutable reservation. No token-to-price conversion and no
    -- refund when the provider reports lower usage than the verified upper bound.
    UPDATE public.ai_generation_attempts
    SET finished_at = now(),
        outcome = p_outcome,
        prompt_tokens = p_prompt_tokens,
        completion_tokens = p_completion_tokens,
        model = left(p_model, 100),
        prompt_version = left(p_prompt_version, 60),
        charged_pence = v_reserved_pence
    WHERE id = p_attempt_id AND user_id = p_user_id AND finished_at IS NULL;
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_generation_counted_pence(timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_generation_counted_pence(timestamptz, integer, integer) TO service_role;

COMMIT;