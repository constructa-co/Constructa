-- Harden the legacy SECURITY DEFINER surface identified in issue #49.
-- Dead RPCs are removed rather than retained as undocumented bypasses. The
-- two service-owned benchmark functions remain explicit and fail closed.

BEGIN;

DROP FUNCTION IF EXISTS public.create_valuation_and_invoice(
  uuid, uuid, text, numeric, text
);
DROP FUNCTION IF EXISTS public.get_effective_rate(uuid, uuid);

CREATE OR REPLACE FUNCTION public.increment_api_key_requests(key_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.api_keys
     SET requests_total = requests_total + 1
   WHERE id = key_id;
$$;

REVOKE ALL ON FUNCTION public.increment_api_key_requests(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_api_key_requests(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_benchmark_on_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_consent boolean;
  v_project_type text;
  v_region text;
  v_cv numeric;
  v_cv_band text;
  v_snap record;
  v_sub_pct numeric;
BEGIN
  IF NEW.is_archived IS NOT TRUE OR OLD.is_archived IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT profile.data_consent
    INTO v_consent
    FROM public.profiles AS profile
   WHERE profile.id = NEW.user_id;
  IF v_consent IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT snapshot.*
    INTO v_snap
    FROM public.archive_snapshots AS snapshot
   WHERE snapshot.project_id = NEW.id
   ORDER BY snapshot.snapshot_date DESC
   LIMIT 1;

  IF v_snap IS NULL THEN
    RETURN NEW;
  END IF;

  v_project_type := NEW.project_type;
  v_region := NEW.site_address;
  v_cv := COALESCE(v_snap.contract_value, 0);
  v_cv_band := CASE
    WHEN v_cv < 50000 THEN '0-50k'
    WHEN v_cv < 100000 THEN '50k-100k'
    WHEN v_cv < 250000 THEN '100k-250k'
    WHEN v_cv < 500000 THEN '250k-500k'
    ELSE '500k+'
  END;

  SELECT CASE
           WHEN SUM(expense.amount) > 0 THEN
             round(
               SUM(
                 CASE WHEN expense.cost_type = 'subcontract'
                   THEN expense.amount ELSE 0 END
               ) * 100.0 / SUM(expense.amount),
               2
             )
           ELSE 0
         END
    INTO v_sub_pct
    FROM public.project_expenses AS expense
   WHERE expense.project_id = NEW.id;

  INSERT INTO public.project_benchmarks (
    project_type, region, contract_value_band,
    gross_margin_pct, planned_duration_days, actual_duration_days,
    programme_delay_days, variation_count, variation_rate_pct,
    subcontract_cost_pct
  ) VALUES (
    v_project_type,
    v_region,
    v_cv_band,
    v_snap.gross_margin_pct,
    v_snap.planned_duration_days,
    v_snap.actual_duration_days,
    v_snap.programme_delay_days,
    v_snap.variation_count,
    CASE WHEN v_cv > 0
      THEN round(
        COALESCE(v_snap.approved_variation_total, 0) * 100.0 / v_cv,
        2
      )
      ELSE 0
    END,
    v_sub_pct
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_benchmark_on_archive()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_benchmark_on_archive()
  TO service_role;

CREATE OR REPLACE FUNCTION public.fn_cv_band(v numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN v < 50000 THEN '0-50k'
    WHEN v < 100000 THEN '50k-100k'
    WHEN v < 250000 THEN '100k-250k'
    WHEN v < 500000 THEN '250k-500k'
    ELSE '500k+'
  END;
$$;

REVOKE ALL ON FUNCTION public.fn_cv_band(numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cv_band(numeric)
  TO service_role;

COMMIT;
