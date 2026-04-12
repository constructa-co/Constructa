-- Sprint 59: Supervisor / Sub-contractor Portal
-- Token-based read-only access for supervisors to view and acknowledge
-- contract obligations assigned to them.

CREATE TABLE IF NOT EXISTS supervisor_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  name        TEXT NOT NULL,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'supervisor',
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supervisor_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users manage their own tokens
CREATE POLICY "users_manage_own_supervisor_tokens"
  ON supervisor_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Public SELECT by token (for the portal page — no auth required)
CREATE POLICY "public_read_by_token"
  ON supervisor_tokens FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_supervisor_tokens_token ON supervisor_tokens(token);
CREATE INDEX IF NOT EXISTS idx_supervisor_tokens_project ON supervisor_tokens(project_id);

-- Add acknowledgment tracking to contract_obligations
ALTER TABLE contract_obligations
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
