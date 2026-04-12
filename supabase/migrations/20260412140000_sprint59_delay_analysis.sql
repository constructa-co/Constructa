-- Sprint 59: SCL Delay Analysis Protocol
-- Stores the results of each delay analysis run across the 4 SCL
-- methodologies (As-Planned vs As-Built, Time Impact Analysis,
-- Collapsed As-Built, Windows Analysis).

CREATE TABLE IF NOT EXISTS delay_analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  claim_id         UUID REFERENCES claims(id) ON DELETE SET NULL,
  methodology      TEXT NOT NULL,          -- as_planned_vs_as_built | time_impact | collapsed_as_built | windows
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',  -- draft | final
  analysis_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  window_size_days INT,                    -- for windows analysis (typically 28 or 30)
  results          JSONB NOT NULL DEFAULT '{}',
  ai_narrative     TEXT,
  input_snapshot   JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE delay_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_delay_analyses"
  ON delay_analyses FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_delay_analyses_project ON delay_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_delay_analyses_claim ON delay_analyses(claim_id);
