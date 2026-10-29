-- SOURCE ONLY: not applied. v1 validator (20261026110000) plus strict v2 structural checks in one function body.
BEGIN;

CREATE OR REPLACE FUNCTION public.valid_programme_working_pattern(value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(
    CASE
      WHEN value IS NULL THEN true
      WHEN jsonb_typeof(value) <> 'object' THEN false
      WHEN NOT (value ? 'version') THEN false
      WHEN value -> 'version' = '1'::jsonb THEN
        CASE
          WHEN value - 'version' - 'weekdays' <> '{}'::jsonb THEN false
          WHEN jsonb_typeof(value -> 'weekdays') IS DISTINCT FROM 'array' THEN false
          ELSE jsonb_array_length(value -> 'weekdays') BETWEEN 1 AND 7
            AND (value -> 'weekdays') <@ '[0,1,2,3,4,5,6]'::jsonb
            AND (
              SELECT count(DISTINCT day) = count(*)
              FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
            )
        END
      WHEN value -> 'version' = '2'::jsonb THEN
        CASE
          WHEN NOT (value ? 'timezone' AND value ? 'weekdays' AND value ? 'intervals'
            AND value ? 'standardMinutesPerDay' AND value ? 'productivityPct') THEN false
          WHEN value - 'version' - 'timezone' - 'weekdays' - 'intervals' - 'standardMinutesPerDay' - 'productivityPct' <> '{}'::jsonb THEN false
          WHEN jsonb_typeof(value -> 'timezone') <> 'string' OR length(btrim(value ->> 'timezone')) NOT BETWEEN 1 AND 80 THEN false
          WHEN jsonb_typeof(value -> 'weekdays') <> 'array'
            OR jsonb_array_length(value -> 'weekdays') NOT BETWEEN 1 AND 7 THEN false
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
            WHERE jsonb_typeof(day) <> 'number'
               OR (day #>> '{}')::numeric IS DISTINCT FROM trunc((day #>> '{}')::numeric)
               OR (day #>> '{}')::int NOT BETWEEN 0 AND 6
          ) THEN false
          WHEN (
            SELECT count(DISTINCT (day #>> '{}')::int)
            FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
          ) <> jsonb_array_length(value -> 'weekdays') THEN false
          WHEN jsonb_typeof(value -> 'intervals') <> 'array'
            OR jsonb_array_length(value -> 'intervals') NOT BETWEEN 1 AND 21 THEN false
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(value -> 'intervals') AS entries(raw)
            WHERE jsonb_typeof(raw) <> 'object'
               OR raw - 'weekday' - 'startMinute' - 'endMinute' <> '{}'::jsonb
               OR jsonb_typeof(raw -> 'weekday') <> 'number'
               OR jsonb_typeof(raw -> 'startMinute') <> 'number'
               OR jsonb_typeof(raw -> 'endMinute') <> 'number'
               OR (raw ->> 'weekday')::numeric IS DISTINCT FROM trunc((raw ->> 'weekday')::numeric)
               OR (raw ->> 'startMinute')::numeric IS DISTINCT FROM trunc((raw ->> 'startMinute')::numeric)
               OR (raw ->> 'endMinute')::numeric IS DISTINCT FROM trunc((raw ->> 'endMinute')::numeric)
               OR (raw ->> 'weekday')::int NOT BETWEEN 0 AND 6
               OR (raw ->> 'startMinute')::int NOT BETWEEN 0 AND 1439
               OR (raw ->> 'endMinute')::int NOT BETWEEN 0 AND 1439
               OR (raw ->> 'startMinute')::int = (raw ->> 'endMinute')::int
               OR NOT (raw ->> 'weekday')::int = ANY (
                 SELECT (day #>> '{}')::int FROM jsonb_array_elements(value -> 'weekdays') AS entries(day)
               )
          ) THEN false
          WHEN jsonb_typeof(value -> 'standardMinutesPerDay') <> 'number'
            OR (value ->> 'standardMinutesPerDay')::numeric IS DISTINCT FROM trunc((value ->> 'standardMinutesPerDay')::numeric)
            OR (value ->> 'standardMinutesPerDay')::int NOT BETWEEN 1 AND 10080 THEN false
          WHEN jsonb_typeof(value -> 'productivityPct') <> 'number'
            OR (value ->> 'productivityPct')::numeric IS DISTINCT FROM trunc((value ->> 'productivityPct')::numeric)
            OR (value ->> 'productivityPct')::int NOT BETWEEN 1 AND 100 THEN false
          ELSE true
        END
      ELSE false
    END,
    false
  );
$$;

COMMIT;
