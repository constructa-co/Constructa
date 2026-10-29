-- SOURCE ONLY: not applied. Extends calendar JSON validation for explicit local timezone + intervals.
BEGIN;

CREATE OR REPLACE FUNCTION public.valid_programme_working_pattern(value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN value IS NULL THEN true
    WHEN jsonb_typeof(value) <> 'object' THEN false
    WHEN value -> 'version' IS DISTINCT FROM '1'::jsonb
     AND value -> 'version' IS DISTINCT FROM '2'::jsonb THEN false
    WHEN value -> 'version' = '1'::jsonb THEN
      value - 'version' - 'weekdays' = '{}'::jsonb
      AND jsonb_typeof(value -> 'weekdays') = 'array'
      AND jsonb_array_length(value -> 'weekdays') BETWEEN 1 AND 7
      AND (value -> 'weekdays') <@ '[0,1,2,3,4,5,6]'::jsonb
      AND (SELECT count(DISTINCT day) = count(*) FROM jsonb_array_elements(value -> 'weekdays') AS entries(day))
    WHEN value -> 'version' = '2'::jsonb THEN
      value - 'version' - 'timezone' - 'weekdays' - 'intervals' - 'standardMinutesPerDay' - 'productivityPct' = '{}'::jsonb
      AND jsonb_typeof(value -> 'timezone') = 'string'
      AND length(value ->> 'timezone') BETWEEN 1 AND 80
      AND jsonb_typeof(value -> 'weekdays') = 'array'
      AND jsonb_array_length(value -> 'weekdays') BETWEEN 1 AND 7
      AND jsonb_typeof(value -> 'intervals') = 'array'
      AND jsonb_array_length(value -> 'intervals') BETWEEN 1 AND 21
      AND jsonb_typeof(value -> 'standardMinutesPerDay') = 'number'
      AND (value ->> 'standardMinutesPerDay')::int BETWEEN 1 AND 10080
      AND jsonb_typeof(value -> 'productivityPct') = 'number'
      AND (value ->> 'productivityPct')::int BETWEEN 1 AND 100
    ELSE false
  END;
$$;

COMMIT;
