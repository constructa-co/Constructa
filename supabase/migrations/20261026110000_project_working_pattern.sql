-- SOURCE ONLY: not applied. Calendar migration is separate from consent QA authority.
BEGIN;

CREATE FUNCTION public.valid_programme_working_pattern(value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN value IS NULL THEN true
    WHEN jsonb_typeof(value) <> 'object' THEN false
    WHEN value - 'version' - 'weekdays' <> '{}'::jsonb THEN false
    WHEN value -> 'version' IS DISTINCT FROM '1'::jsonb THEN false
    WHEN jsonb_typeof(value -> 'weekdays') IS DISTINCT FROM 'array' THEN false
    ELSE jsonb_array_length(value -> 'weekdays') BETWEEN 1 AND 7
      AND (value -> 'weekdays') <@ '[0,1,2,3,4,5,6]'::jsonb
      AND (SELECT count(DISTINCT day) = count(*) FROM jsonb_array_elements(value -> 'weekdays') AS entries(day))
  END;
$$;

ALTER TABLE public.projects ADD COLUMN programme_working_pattern jsonb
  CONSTRAINT projects_working_pattern_valid CHECK (public.valid_programme_working_pattern(programme_working_pattern));

-- Reuse the existing accepted-record lock without replacing or relaxing its other fields.
CREATE FUNCTION public.guard_project_working_pattern()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.programme_working_pattern IS DISTINCT FROM OLD.programme_working_pattern THEN
    PERFORM public.assert_project_precontract_unlocked(OLD.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_project_working_pattern
BEFORE UPDATE OF programme_working_pattern ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_working_pattern();

COMMIT;
