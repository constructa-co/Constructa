-- Accepted proposals are contractual records. Application checks provide useful
-- feedback, but only database triggers can close the race between acceptance
-- and an in-flight edit and cover every current or future write path.

BEGIN;

CREATE OR REPLACE FUNCTION public.assert_project_precontract_unlocked(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  project_state record;
BEGIN
  SELECT p.proposal_accepted_at,
         lower(coalesce(to_jsonb(p) ->> 'proposal_status', '')) = 'accepted' AS status_accepted
    INTO project_state
    FROM public.projects p
   WHERE p.id = p_project_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
  END IF;

  IF project_state.proposal_accepted_at IS NOT NULL OR project_state.status_accepted THEN
    RAISE EXCEPTION 'This proposal has been accepted. Record later scope or price changes as variations.'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_project_precontract_unlocked(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.guard_project_precontract_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  protected_fields constant text[] := ARRAY[
    'name', 'client_name', 'client_email', 'client_phone', 'client_address',
    'site_address', 'project_type', 'payment_terms',
    'brief_scope', 'brief_trade_sections', 'brief_completed', 'client_type',
    'lat', 'lng', 'region', 'potential_value', 'start_date',
    'proposal_introduction', 'scope_text', 'exclusions_text',
    'clarifications_text', 'gantt_phases', 'site_photos', 'tc_overrides',
    'payment_schedule', 'payment_schedule_type', 'selected_case_study_ids',
    'closing_statement', 'discount_pct', 'discount_reason', 'tc_tier',
    'risk_register',
    'validity_days', 'proposal_capability', 'proposal_company_name',
    'contract_exclusions', 'contract_clarifications',
    'proposal_status', 'proposal_sent_at', 'proposal_accepted_at',
    'proposal_accepted_by', 'proposal_accepted_ip'
  ];
  old_protected jsonb;
  new_protected jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.proposal_accepted_at IS NOT NULL
       OR lower(coalesce(to_jsonb(OLD) ->> 'proposal_status', '')) = 'accepted' THEN
      RAISE EXCEPTION 'Accepted proposals are contractual records and cannot be deleted.'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    INTO old_protected
    FROM jsonb_each(to_jsonb(OLD))
   WHERE key = ANY(protected_fields);

  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    INTO new_protected
    FROM jsonb_each(to_jsonb(NEW))
   WHERE key = ANY(protected_fields);

  IF old_protected IS DISTINCT FROM new_protected
     AND (OLD.proposal_accepted_at IS NOT NULL
          OR lower(coalesce(to_jsonb(OLD) ->> 'proposal_status', '')) = 'accepted') THEN
    RAISE EXCEPTION 'This proposal has been accepted. Record later scope changes as variations.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_estimate_precontract_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.assert_project_precontract_unlocked(OLD.project_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.project_id IS DISTINCT FROM OLD.project_id) THEN
    PERFORM public.assert_project_precontract_unlocked(NEW.project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_estimate_line_precontract_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_project_id uuid;
  new_project_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT project_id INTO old_project_id FROM public.estimates WHERE id = OLD.estimate_id;
    -- A missing parent here means an already-verified estimate delete is
    -- cascading. The estimate trigger owns that lock decision.
    IF old_project_id IS NULL AND TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    PERFORM public.assert_project_precontract_unlocked(old_project_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.estimate_id IS DISTINCT FROM OLD.estimate_id) THEN
    SELECT project_id INTO new_project_id FROM public.estimates WHERE id = NEW.estimate_id;
    PERFORM public.assert_project_precontract_unlocked(new_project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_estimate_component_precontract_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_project_id uuid;
  new_project_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT e.project_id INTO old_project_id
      FROM public.estimate_lines l
      JOIN public.estimates e ON e.id = l.estimate_id
     WHERE l.id = OLD.estimate_line_id;
    -- A missing parent here means an already-verified line/estimate delete is
    -- cascading. The nearest surviving parent trigger owns the lock decision.
    IF old_project_id IS NULL AND TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    PERFORM public.assert_project_precontract_unlocked(old_project_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.estimate_line_id IS DISTINCT FROM OLD.estimate_line_id) THEN
    SELECT e.project_id INTO new_project_id
      FROM public.estimate_lines l
      JOIN public.estimates e ON e.id = l.estimate_id
     WHERE l.id = NEW.estimate_line_id;
    PERFORM public.assert_project_precontract_unlocked(new_project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_project_precontract_fields ON public.projects;
CREATE TRIGGER trg_guard_project_precontract_fields
BEFORE UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_precontract_fields();

DROP TRIGGER IF EXISTS trg_guard_estimate_precontract_write ON public.estimates;
CREATE TRIGGER trg_guard_estimate_precontract_write
BEFORE INSERT OR UPDATE OR DELETE ON public.estimates
FOR EACH ROW EXECUTE FUNCTION public.guard_estimate_precontract_write();

DROP TRIGGER IF EXISTS trg_guard_estimate_line_precontract_write ON public.estimate_lines;
CREATE TRIGGER trg_guard_estimate_line_precontract_write
BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_lines
FOR EACH ROW EXECUTE FUNCTION public.guard_estimate_line_precontract_write();

DROP TRIGGER IF EXISTS trg_guard_estimate_component_precontract_write ON public.estimate_line_components;
CREATE TRIGGER trg_guard_estimate_component_precontract_write
BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_line_components
FOR EACH ROW EXECUTE FUNCTION public.guard_estimate_component_precontract_write();

COMMIT;
