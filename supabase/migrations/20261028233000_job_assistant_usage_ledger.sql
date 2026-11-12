-- A055/A063: usage ledger for the job assistant (pricing, planning, Brief).
--
-- SOURCE ONLY. Not applied to any database. When it is applied it is
-- DISABLED: the settings row says enabled = false with no ceilings, so every
-- reservation answers 'disabled'. Enabling it is a separate, reviewed change
-- after the owner approves the provider, model, prices and caps.
--
-- What it records, per attempt: the server's attempt id, the contractor, the
-- job, the feature, the saved-context revision, provider, model, approval
-- reference, the pence reserved and charged, and how the attempt ended. It
-- stores no prompt, no reply, no job text and no key.
--
-- Money is counted conservatively, all three features together:
--   released  0                       (the provider confirmed nothing was sent)
--   settled   the charged pence       (the provider's reported usage; may exceed
--                                      the reservation, and then still counts)
--   otherwise the reserved pence      (in flight, or the paid outcome is unknown)
-- Nothing here refunds or cancels a provider charge.

BEGIN;

-- One row. The server's approved configuration passes its caps on each
-- reservation; these columns are the database's own ceilings over them.
CREATE TABLE public.job_assistant_usage_settings (
    id smallint PRIMARY KEY DEFAULT 1,
    enabled boolean NOT NULL DEFAULT false,
    max_attempt_pence integer,
    max_per_job_pence integer,
    max_monthly_pence integer,
    CONSTRAINT job_assistant_usage_settings_single CHECK (id = 1),
    CONSTRAINT job_assistant_usage_settings_positive CHECK (
        (max_attempt_pence IS NULL OR max_attempt_pence > 0)
        AND (max_per_job_pence IS NULL OR max_per_job_pence > 0)
        AND (max_monthly_pence IS NULL OR max_monthly_pence > 0)
    )
);
INSERT INTO public.job_assistant_usage_settings (id, enabled) VALUES (1, false);

CREATE TABLE public.job_assistant_attempts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    feature text NOT NULL,
    revision text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    approval_ref text NOT NULL,
    reserved_pence integer NOT NULL,
    state text NOT NULL DEFAULT 'reserved',
    charged_pence integer,
    retain_reason text,
    outcome text,
    created_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    concluded_at timestamptz,
    CONSTRAINT job_assistant_attempts_feature CHECK (feature IN ('pricing', 'planning', 'brief')),
    CONSTRAINT job_assistant_attempts_revision CHECK (revision ~ '^[a-f0-9]{64}$'),
    CONSTRAINT job_assistant_attempts_labels CHECK (
        char_length(provider) BETWEEN 1 AND 60 AND char_length(model) BETWEEN 1 AND 100 AND char_length(approval_ref) BETWEEN 1 AND 200
    ),
    CONSTRAINT job_assistant_attempts_reserved CHECK (reserved_pence > 0),
    CONSTRAINT job_assistant_attempts_state CHECK (state IN ('reserved', 'settled', 'released', 'retained')),
    CONSTRAINT job_assistant_attempts_charged CHECK ((state = 'settled') = (charged_pence IS NOT NULL) AND (charged_pence IS NULL OR charged_pence >= 0)),
    CONSTRAINT job_assistant_attempts_retained CHECK ((state = 'retained') = (retain_reason IS NOT NULL)
        AND (retain_reason IS NULL OR retain_reason IN ('cancelled', 'failed', 'unreadable_usage'))),
    CONSTRAINT job_assistant_attempts_outcome CHECK (outcome IS NULL OR (state <> 'reserved' AND outcome IN ('reply', 'rejected', 'stale', 'unavailable')))
);
CREATE INDEX job_assistant_attempts_project ON public.job_assistant_attempts (project_id);
CREATE INDEX job_assistant_attempts_created ON public.job_assistant_attempts (created_at);

ALTER TABLE public.job_assistant_usage_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assistant_attempts ENABLE ROW LEVEL SECURITY;

-- No policy and no grant for any browser role.
REVOKE ALL PRIVILEGES ON TABLE public.job_assistant_usage_settings, public.job_assistant_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.job_assistant_usage_settings, public.job_assistant_attempts TO service_role;

-- Counted pence for one attempt row (see the header).
CREATE FUNCTION public.job_assistant_counted_pence(p_state text, p_reserved integer, p_charged integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE p_state WHEN 'released' THEN 0 WHEN 'settled' THEN p_charged ELSE p_reserved END;
$$;

-- Reserve one attempt before the provider is called.
--
-- LOCK ORDER (an invariant): the global lock first, then the job's. Only this
-- function takes them. The global lock makes the monthly cap exact across all
-- contractors and features; the provider call always happens after this
-- transaction has ended.
--
-- Returns {status}: 'reserved', or a refusal that inserts nothing:
-- 'disabled', 'duplicate' (this attempt id exists: never send it again),
-- 'not-owner', 'over-ceiling', 'job-cap', 'monthly-cap'.
CREATE FUNCTION public.job_assistant_reserve(
    p_attempt_id uuid,
    p_user_id uuid,
    p_project_id uuid,
    p_feature text,
    p_revision text,
    p_provider text,
    p_model text,
    p_approval_ref text,
    p_pence integer,
    p_per_job_cap_pence integer,
    p_monthly_cap_pence integer
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_settings public.job_assistant_usage_settings%ROWTYPE;
    v_job bigint;
    v_month bigint;
BEGIN
    IF p_attempt_id IS NULL OR p_user_id IS NULL OR p_project_id IS NULL OR p_pence IS NULL OR p_pence < 1
        OR p_per_job_cap_pence IS NULL OR p_monthly_cap_pence IS NULL THEN
        RAISE EXCEPTION 'A complete reservation is required.' USING ERRCODE = 'invalid_parameter_value';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('job_assistant:global', 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('job_assistant:project:' || p_project_id::text, 0));

    SELECT * INTO v_settings FROM public.job_assistant_usage_settings WHERE id = 1;
    IF v_settings.id IS NULL OR v_settings.enabled IS NOT TRUE
        OR v_settings.max_attempt_pence IS NULL OR v_settings.max_per_job_pence IS NULL OR v_settings.max_monthly_pence IS NULL THEN
        RETURN jsonb_build_object('status', 'disabled');
    END IF;

    IF EXISTS (SELECT 1 FROM public.job_assistant_attempts WHERE id = p_attempt_id) THEN
        RETURN jsonb_build_object('status', 'duplicate');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = p_user_id) THEN
        RETURN jsonb_build_object('status', 'not-owner');
    END IF;

    IF p_pence > v_settings.max_attempt_pence OR p_per_job_cap_pence > v_settings.max_per_job_pence
        OR p_monthly_cap_pence > v_settings.max_monthly_pence OR p_pence > p_per_job_cap_pence OR p_per_job_cap_pence > p_monthly_cap_pence THEN
        RETURN jsonb_build_object('status', 'over-ceiling');
    END IF;

    -- This job, all three features together, for its whole life.
    SELECT coalesce(sum(public.job_assistant_counted_pence(state, reserved_pence, charged_pence)), 0) INTO v_job
    FROM public.job_assistant_attempts WHERE project_id = p_project_id;
    IF v_job + p_pence > p_per_job_cap_pence THEN
        RETURN jsonb_build_object('status', 'job-cap');
    END IF;

    -- Everyone, all three features together, this calendar month (UK time).
    SELECT coalesce(sum(public.job_assistant_counted_pence(state, reserved_pence, charged_pence)), 0) INTO v_month
    FROM public.job_assistant_attempts
    WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/London') AT TIME ZONE 'Europe/London';
    IF v_month + p_pence > p_monthly_cap_pence THEN
        RETURN jsonb_build_object('status', 'monthly-cap');
    END IF;

    INSERT INTO public.job_assistant_attempts (id, user_id, project_id, feature, revision, provider, model, approval_ref, reserved_pence)
    VALUES (p_attempt_id, p_user_id, p_project_id, p_feature, p_revision, left(p_provider, 60), left(p_model, 100), left(p_approval_ref, 200), p_pence);
    RETURN jsonb_build_object('status', 'reserved');
END;
$$;

-- Each step below moves one attempt exactly once and returns whether it did.
-- The server treats false as a failure and refuses the reply.

CREATE FUNCTION public.job_assistant_settle(p_attempt_id uuid, p_charged_pence integer)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF p_charged_pence IS NULL OR p_charged_pence < 0 THEN
        RAISE EXCEPTION 'A settled attempt needs its charged pence.' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE public.job_assistant_attempts SET state = 'settled', charged_pence = p_charged_pence, finished_at = now()
    WHERE id = p_attempt_id AND state = 'reserved';
    RETURN FOUND;
END;
$$;

CREATE FUNCTION public.job_assistant_release(p_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.job_assistant_attempts SET state = 'released', finished_at = now()
    WHERE id = p_attempt_id AND state = 'reserved';
    RETURN FOUND;
END;
$$;

CREATE FUNCTION public.job_assistant_retain(p_attempt_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.job_assistant_attempts SET state = 'retained', retain_reason = p_reason, finished_at = now()
    WHERE id = p_attempt_id AND state = 'reserved';
    RETURN FOUND;
END;
$$;

-- Records what the request path did with the attempt. An attempt that never
-- reached the provider (refused before reservation) has no row to conclude.
CREATE FUNCTION public.job_assistant_conclude(p_attempt_id uuid, p_outcome text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    UPDATE public.job_assistant_attempts SET outcome = p_outcome, concluded_at = now()
    WHERE id = p_attempt_id AND state <> 'reserved' AND outcome IS NULL;
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.job_assistant_counted_pence(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_assistant_reserve(uuid, uuid, uuid, text, text, text, text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_assistant_settle(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_assistant_release(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_assistant_retain(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_assistant_conclude(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_assistant_counted_pence(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_assistant_reserve(uuid, uuid, uuid, text, text, text, text, text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_assistant_settle(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_assistant_release(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_assistant_retain(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_assistant_conclude(uuid, text) TO service_role;

COMMIT;
