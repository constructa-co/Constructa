-- Stage 2G.3.2, candidate A: a usage budget for two AI features.
--
-- Scope, stated exactly. This budget covers two features and nothing else:
--
--   profile.rewrite        the "rewrite with AI" buttons on the Profile form
--   company.introduction   AI wording for the guided company interview,
--                          which is NOT wired to anything and is disabled here
--
-- Every other AI call in the application is outside it. This is not an
-- application-wide spending limit and must not be described as one.
--
-- How it works. Before a call to the provider, the server reserves an attempt
-- here. The reservation is refused if the feature is switched off, if the
-- contractor already has a call in flight, or if the contractor's or the
-- whole service's allowance for the period is used up. An attempt counts
-- from the moment it is reserved, whatever becomes of it: there is no free
-- failure. When the call is over the server records, once, how it ended and
-- what it used.
--
-- Nothing here is readable or writable from a browser. Only the server's
-- service role can execute the two functions, after the application has
-- authenticated the contractor.
--
-- The numbers seeded below are provisional defaults for review. They are
-- counts of calls and tokens, not prices, and are not owner-approved limits.

BEGIN;

-- ── Settings ─────────────────────────────────────────────────────────────────

-- One row per feature: whether it may call the provider at all, and the most
-- output it may reserve for one call.
CREATE TABLE public.ai_generation_features (
    feature text PRIMARY KEY,
    enabled boolean NOT NULL DEFAULT false,
    max_reserve_output_tokens integer NOT NULL,
    CONSTRAINT ai_generation_features_known CHECK (feature IN ('company.introduction', 'profile.rewrite')),
    CONSTRAINT ai_generation_features_reserve CHECK (max_reserve_output_tokens BETWEEN 1 AND 4000)
);

-- Two rows, with different meanings:
--   'contractor'  what ONE contractor may use, across both features together;
--   'global'      what ALL contractors together may use: a circuit breaker.
CREATE TABLE public.ai_generation_limits (
    scope text PRIMARY KEY,
    per_hour_attempts integer,
    per_day_attempts integer NOT NULL,
    per_day_output_tokens integer NOT NULL,
    CONSTRAINT ai_generation_limits_scope CHECK (scope IN ('contractor', 'global')),
    CONSTRAINT ai_generation_limits_positive CHECK (
        (per_hour_attempts IS NULL OR per_hour_attempts >= 0) AND per_day_attempts >= 0 AND per_day_output_tokens >= 0
    )
);

-- Provisional defaults. company.introduction is OFF: switching it on is a
-- separate, reviewed migration after its budgeted wiring and evaluation exist.
INSERT INTO public.ai_generation_features (feature, enabled, max_reserve_output_tokens) VALUES
    ('profile.rewrite', true, 700),
    ('company.introduction', false, 500);
INSERT INTO public.ai_generation_limits (scope, per_hour_attempts, per_day_attempts, per_day_output_tokens) VALUES
    ('contractor', 6, 20, 12000),
    ('global', NULL, 2000, 1000000);

-- ── Ledger ───────────────────────────────────────────────────────────────────

-- One row per reserved attempt. Counts and versions only: no prompt and no reply.
CREATE TABLE public.ai_generation_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature text NOT NULL REFERENCES public.ai_generation_features(feature),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    outcome text,
    -- The output cap claimed for this call. Charged in full unless the provider reported what was used.
    reserved_output_tokens integer NOT NULL,
    prompt_tokens integer,
    completion_tokens integer,
    model text,
    prompt_version text,
    -- company.introduction only: which sources were sent.
    source_fingerprint text,
    -- What this attempt costs the allowance. Unknown usage is charged as the whole reservation.
    charged_output_tokens integer GENERATED ALWAYS AS (coalesce(completion_tokens, reserved_output_tokens)) STORED,
    CONSTRAINT ai_generation_attempts_reserved CHECK (reserved_output_tokens BETWEEN 1 AND 4000),
    CONSTRAINT ai_generation_attempts_tokens CHECK (
        (prompt_tokens IS NULL OR prompt_tokens BETWEEN 0 AND 1000000) AND (completion_tokens IS NULL OR completion_tokens BETWEEN 0 AND 1000000)
    ),
    CONSTRAINT ai_generation_attempts_outcome CHECK (
        outcome IS NULL OR outcome IN ('ok', 'rejected:schema', 'rejected:tripwire', 'sources-moved', 'error', 'abandoned')
    ),
    CONSTRAINT ai_generation_attempts_finished CHECK ((finished_at IS NULL) = (outcome IS NULL)),
    CONSTRAINT ai_generation_attempts_text CHECK (
        (model IS NULL OR char_length(model) <= 100) AND (prompt_version IS NULL OR char_length(prompt_version) <= 60)
    ),
    CONSTRAINT ai_generation_attempts_fingerprint CHECK (
        (feature = 'company.introduction' AND source_fingerprint IS NOT NULL AND source_fingerprint ~ '^[0-9a-f]{32}$')
        OR (feature = 'profile.rewrite' AND source_fingerprint IS NULL)
    )
);

CREATE INDEX ai_generation_attempts_user_started_idx ON public.ai_generation_attempts (user_id, started_at DESC);
CREATE INDEX ai_generation_attempts_started_idx ON public.ai_generation_attempts (started_at DESC);

-- At most one call in flight per contractor, across both features, enforced by the schema itself.
CREATE UNIQUE INDEX ai_generation_attempts_one_in_flight
    ON public.ai_generation_attempts (user_id) WHERE finished_at IS NULL;

-- A reservation's identity never changes, and once an attempt is finished it
-- is a record: nothing about it can be changed by anyone.
CREATE FUNCTION public.ai_generation_attempts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.finished_at IS NOT NULL THEN
        RAISE EXCEPTION 'A finished AI attempt cannot be changed.' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.feature IS DISTINCT FROM OLD.feature
        OR NEW.started_at IS DISTINCT FROM OLD.started_at
        OR NEW.reserved_output_tokens IS DISTINCT FROM OLD.reserved_output_tokens
        OR NEW.source_fingerprint IS DISTINCT FROM OLD.source_fingerprint THEN
        RAISE EXCEPTION 'An AI attempt''s reservation cannot be changed.' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER ai_generation_attempts_guard
    BEFORE UPDATE ON public.ai_generation_attempts
    FOR EACH ROW EXECUTE FUNCTION public.ai_generation_attempts_guard();

ALTER TABLE public.ai_generation_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_attempts ENABLE ROW LEVEL SECURITY;

-- No policy and no grant for any browser role, on any of the three tables.
REVOKE ALL PRIVILEGES ON TABLE public.ai_generation_features, public.ai_generation_limits, public.ai_generation_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.ai_generation_features, public.ai_generation_limits, public.ai_generation_attempts TO service_role;

-- ── Reserve ──────────────────────────────────────────────────────────────────

-- Claims the right to make one provider call, before it is made.
--
-- LOCK ORDER (an invariant): the global lock first, then the contractor's.
-- This function is the only place either lock is taken. Any future code that
-- needs both must take them in this order, or it can deadlock with this one.
-- The global lock means reservations happen one at a time across the whole
-- service. That is deliberate: it is what makes the global ceiling exact, and
-- a reservation is a few indexed reads and one insert. Nothing slow may ever
-- run while it is held; in particular the provider call happens after this
-- transaction has ended, never inside it.
--
-- Returns {status} and, when reserved, {attempt_id}. A refusal inserts nothing.
CREATE FUNCTION public.ai_generation_reserve(
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
    -- An unknown feature, a feature switched off, or missing limits: no call.
    IF v_feature.feature IS NULL OR v_feature.enabled IS NOT TRUE OR v_contractor.scope IS NULL OR v_global.scope IS NULL THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    IF p_reserve_output_tokens IS NULL OR p_reserve_output_tokens < 1 OR p_reserve_output_tokens > v_feature.max_reserve_output_tokens THEN
        RAISE EXCEPTION 'The output reserved for % must be between 1 and % tokens.', p_feature, v_feature.max_reserve_output_tokens
            USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- A call that never reported back stops blocking after two minutes. It stays counted, at its full reservation.
    UPDATE public.ai_generation_attempts
    SET finished_at = now(), outcome = 'abandoned'
    WHERE user_id = p_user_id AND finished_at IS NULL AND started_at < now() - interval '2 minutes';

    IF EXISTS (SELECT 1 FROM public.ai_generation_attempts WHERE user_id = p_user_id AND finished_at IS NULL) THEN
        RETURN jsonb_build_object('status', 'in-flight');
    END IF;

    -- This contractor, both features together. Every attempt counts, whatever became of it.
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

    -- Everyone together. Calls still in flight count at what they reserved.
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

-- ── Finish ───────────────────────────────────────────────────────────────────

-- Records how a reserved call ended. Once, by the contractor it belongs to.
-- Returns true if this call recorded it, false if there was nothing open to
-- finish (already finished, abandoned, or not this contractor's). Takes no
-- advisory lock: it changes one row that only it can still change.
--
-- Token counts are what the provider reported. When they are not known the
-- attempt is charged its whole reservation.
CREATE FUNCTION public.ai_generation_finish(
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
    -- A usable reply always comes with the provider's count of what it used.
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

REVOKE ALL ON FUNCTION public.ai_generation_attempts_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_generation_reserve(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_generation_finish(uuid, uuid, text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_generation_reserve(uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_generation_finish(uuid, uuid, text, integer, integer, text, text) TO service_role;

COMMIT;
