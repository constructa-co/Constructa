-- CON-044: planner autosave draft separate from proposal programme_phases.
-- Applies only when Rob runs migrations; app code detects the column before writing.

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS programme_planner_draft JSONB;

COMMENT ON COLUMN public.projects.programme_planner_draft IS
    'Unpublished detailed planner edits (phases + start_date). Proposal and client portal read programme_phases only.';