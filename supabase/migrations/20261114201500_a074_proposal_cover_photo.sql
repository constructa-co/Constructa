-- A074: optional explicit cover image choice on proposals (no cover by default).

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS proposal_cover_photo TEXT;

COMMIT;