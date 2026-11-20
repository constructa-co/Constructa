-- CON-073: durable pipeline stage history.
--
-- SOURCE ONLY. Not applied to any database. Creates the relation that
-- appendPipelineStageHistory (src/lib/pipeline-stage-history.ts) already writes
-- to: project_pipeline_stage_events(project_id, user_id, from_status, to_status).
-- Until it is applied the app keeps its schema-gate behaviour and shows the
-- "history not confirmed" warning after a confirmed stage move.
--
-- Append-only and owner-scoped: the owner of a project may read and insert
-- events for it; no app role may update or delete them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_pipeline_stage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    from_status text NOT NULL,
    to_status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT project_pipeline_stage_events_from_len CHECK (char_length(from_status) BETWEEN 1 AND 60),
    CONSTRAINT project_pipeline_stage_events_to_len CHECK (char_length(to_status) BETWEEN 1 AND 60),
    CONSTRAINT project_pipeline_stage_events_changed CHECK (from_status <> to_status)
);

CREATE INDEX IF NOT EXISTS project_pipeline_stage_events_project_idx
    ON public.project_pipeline_stage_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_pipeline_stage_events_user_idx
    ON public.project_pipeline_stage_events (user_id);

ALTER TABLE public.project_pipeline_stage_events ENABLE ROW LEVEL SECURITY;

-- Default privileges no longer reach Data API roles (phase1 grants), so grant
-- exactly what the server action needs: read and append for the signed-in user.
REVOKE ALL ON TABLE public.project_pipeline_stage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.project_pipeline_stage_events TO authenticated;
GRANT ALL ON TABLE public.project_pipeline_stage_events TO service_role;

DROP POLICY IF EXISTS project_pipeline_stage_events_select_own ON public.project_pipeline_stage_events;
CREATE POLICY project_pipeline_stage_events_select_own
    ON public.project_pipeline_stage_events FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects p
             WHERE p.id = project_pipeline_stage_events.project_id
               AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS project_pipeline_stage_events_insert_own ON public.project_pipeline_stage_events;
CREATE POLICY project_pipeline_stage_events_insert_own
    ON public.project_pipeline_stage_events FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.projects p
             WHERE p.id = project_pipeline_stage_events.project_id
               AND p.user_id = auth.uid()
        )
    );

COMMENT ON TABLE public.project_pipeline_stage_events IS
    'Append-only audit of confirmed pipeline stage moves. Owner read/insert only; no update or delete for app roles.';

COMMIT;
