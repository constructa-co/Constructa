-- Converge the replayed archive snapshot with recovered live metadata while
-- preserving values stored under the legacy Sprint 54 column names.

BEGIN;

DO $reconcile$
DECLARE
  rename_pair text[];
BEGIN
  FOREACH rename_pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['total_received', 'total_paid'],
    ARRAY['total_costs', 'total_costs_posted'],
    ARRAY['gross_margin', 'gross_margin_pct'],
    ARRAY['retention_held', 'retention_outstanding']
  ]
  LOOP
    IF EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'archive_snapshots'
         AND column_name = rename_pair[1]
    ) AND NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'archive_snapshots'
         AND column_name = rename_pair[2]
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.archive_snapshots RENAME COLUMN %I TO %I',
        rename_pair[1],
        rename_pair[2]
      );
    END IF;
  END LOOP;
END;
$reconcile$;

ALTER TABLE public.archive_snapshots
  ADD COLUMN IF NOT EXISTS total_paid NUMERIC,
  ADD COLUMN IF NOT EXISTS total_costs_posted NUMERIC,
  ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS retention_outstanding NUMERIC,
  ADD COLUMN IF NOT EXISTS final_account_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS final_account_status TEXT,
  ADD COLUMN IF NOT EXISTS planned_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS actual_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS programme_delay_days INTEGER,
  ADD COLUMN IF NOT EXISTS variation_count INTEGER,
  ADD COLUMN IF NOT EXISTS approved_variation_total NUMERIC;

DO $snapshot_date$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'archive_snapshots'
       AND column_name = 'snapshot_date'
       AND data_type = 'date'
  ) THEN
    ALTER TABLE public.archive_snapshots
      ALTER COLUMN snapshot_date TYPE TIMESTAMPTZ
      USING snapshot_date::timestamp AT TIME ZONE 'UTC';
  END IF;
END;
$snapshot_date$;

UPDATE public.archive_snapshots
   SET created_at = now()
 WHERE created_at IS NULL;

ALTER TABLE public.archive_snapshots
  ALTER COLUMN snapshot_date SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

COMMIT;
