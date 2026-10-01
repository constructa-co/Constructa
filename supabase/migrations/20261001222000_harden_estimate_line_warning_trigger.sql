-- The Phase 1 project graph RPC uses an empty search path. Its estimate-line
-- insert fires this legacy canary trigger, so every relation reference must be
-- schema-qualified.

BEGIN;

CREATE OR REPLACE FUNCTION public.warn_if_many_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  line_count integer;
BEGIN
  SELECT count(*)
    INTO line_count
    FROM public.estimate_lines
   WHERE estimate_id = NEW.estimate_id;

  IF line_count > 500 THEN
    RAISE WARNING 'Estimate % now has % line items, which exceeds the recommended limit of 500.',
      NEW.estimate_id,
      line_count;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
