-- SOURCE ONLY: not applied. Strict v1/v2 JSON validation (replaces prior validator body).
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
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
        WHERE jsonb_typeof(day) <> 'number'
           OR (day #>> '{}')::numeric <> trunc((day #>> '{}')::numeric)
           OR (day #>> '{}')::int NOT BETWEEN 0 AND 6
      )
      AND (
        SELECT count(DISTINCT (day #>> '{}')::int)
        FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
      ) = jsonb_array_length(value -> 'weekdays')
    WHEN value -> 'version' = '2'::jsonb THEN
      value - 'version' - 'timezone' - 'weekdays' - 'intervals' - 'standardMinutesPerDay' - 'productivityPct' = '{}'::jsonb
      AND jsonb_typeof(value -> 'timezone') = 'string'
      AND length(btrim(value ->> 'timezone')) BETWEEN 1 AND 80
      AND jsonb_typeof(value -> 'weekdays') = 'array'
      AND jsonb_array_length(value -> 'weekdays') BETWEEN 1 AND 7
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
        WHERE jsonb_typeof(day) <> 'number'
           OR (day #>> '{}')::numeric <> trunc((day #>> '{}')::numeric)
           OR (day #>> '{}')::int NOT BETWEEN 0 AND 6
      )
      AND (
        SELECT count(DISTINCT (day #>> '{}')::int)
        FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
      ) = jsonb_array_length(value -> 'weekdays')
      AND jsonb_typeof(value -> 'intervals') = 'array'
      AND jsonb_array_length(value -> 'intervals') BETWEEN 1 AND 21
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(value -> 'intervals') AS entries(raw)
        WHERE jsonb_typeof(raw) <> 'object'
           OR raw - 'weekday' - 'startMinute' - 'endMinute' <> '{}'::jsonb
           OR jsonb_typeof(raw -> 'weekday') <> 'number'
           OR jsonb_typeof(raw -> 'startMinute') <> 'number'
           OR jsonb_typeof(raw -> 'endMinute') <> 'number'
           OR (raw ->> 'weekday')::int NOT BETWEEN 0 AND 6
           OR (raw ->> 'startMinute')::int NOT BETWEEN 0 AND 1439
           OR (raw ->> 'endMinute')::int NOT BETWEEN 0 AND 1439
           OR (raw ->> 'startMinute')::int = (raw ->> 'endMinute')::int
           OR NOT (raw ->> 'weekday')::int = ANY (
             SELECT (day #>> '{}')::int FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
           )
      )
      AND jsonb_typeof(value -> 'standardMinutesPerDay') = 'number'
      AND (value ->> 'standardMinutesPerDay')::numeric = trunc((value ->> 'standardMinutesPerDay')::numeric)
      AND (value ->> 'standardMinutesPerDay')::int BETWEEN 1 AND 10080
      AND jsonb_typeof(value -> 'productivityPct') = 'number'
      AND (value ->> 'productivityPct')::numeric = trunc((value ->> 'productivityPct')::numeric)
      AND (value ->> 'productivityPct')::int BETWEEN 1 AND 100
    ELSE false
  END;
$$;

COMMIT;
