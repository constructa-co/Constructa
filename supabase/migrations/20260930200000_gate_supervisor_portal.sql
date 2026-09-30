-- The supervisor portal is outside Phase 1. Remove its enumerable anonymous
-- token policy and keep token management owner/project scoped until a later
-- hashed-token, revocable server boundary is deliberately implemented.

BEGIN;

ALTER TABLE public.supervisor_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_by_token"
  ON public.supervisor_tokens;
DROP POLICY IF EXISTS "users_manage_own_supervisor_tokens"
  ON public.supervisor_tokens;
DROP POLICY IF EXISTS supervisor_tokens_owner_select
  ON public.supervisor_tokens;
DROP POLICY IF EXISTS supervisor_tokens_owner_insert
  ON public.supervisor_tokens;
DROP POLICY IF EXISTS supervisor_tokens_owner_update
  ON public.supervisor_tokens;
DROP POLICY IF EXISTS supervisor_tokens_owner_delete
  ON public.supervisor_tokens;

CREATE POLICY supervisor_tokens_owner_select
  ON public.supervisor_tokens
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.projects AS project
       WHERE project.id = supervisor_tokens.project_id
         AND project.user_id = auth.uid()
    )
  );

CREATE POLICY supervisor_tokens_owner_insert
  ON public.supervisor_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.projects AS project
       WHERE project.id = project_id
         AND project.user_id = auth.uid()
    )
  );

CREATE POLICY supervisor_tokens_owner_update
  ON public.supervisor_tokens
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.projects AS project
       WHERE project.id = supervisor_tokens.project_id
         AND project.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.projects AS project
       WHERE project.id = project_id
         AND project.user_id = auth.uid()
    )
  );

CREATE POLICY supervisor_tokens_owner_delete
  ON public.supervisor_tokens
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.projects AS project
       WHERE project.id = supervisor_tokens.project_id
         AND project.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.supervisor_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisor_tokens
  TO authenticated;
GRANT ALL ON public.supervisor_tokens TO service_role;

COMMIT;
