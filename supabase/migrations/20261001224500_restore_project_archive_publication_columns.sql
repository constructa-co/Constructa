-- Reconcile project publication/archive fields that exist in the recovered
-- live schema but whose original migration was never committed.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS proposal_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID,
  ADD COLUMN IF NOT EXISTS archive_reason TEXT;

COMMIT;
