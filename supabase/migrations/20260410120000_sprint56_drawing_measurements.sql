-- Sprint 56: Drawing Measurements
-- Persists manual measurements taken in the drawing viewer

CREATE TABLE IF NOT EXISTS drawing_measurements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_name    TEXT NOT NULL,
  measurement_type TEXT NOT NULL, -- linear | area | count
  label           TEXT NOT NULL DEFAULT '',
  value           NUMERIC(12,4) NOT NULL,  -- metres or m² or count
  unit            TEXT NOT NULL DEFAULT 'm',
  trade_section   TEXT,
  notes           TEXT,
  scale_px_per_m  NUMERIC(12,4),  -- calibration used when measured
  point_data      JSONB,          -- raw canvas points for audit/re-draw
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE drawing_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own measurements"
  ON drawing_measurements FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dm_user    ON drawing_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_project ON drawing_measurements(project_id);
