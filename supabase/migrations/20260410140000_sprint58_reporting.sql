-- Sprint 58: Reporting Module
-- Site photos, progress reports, weekly report records

CREATE TABLE IF NOT EXISTS site_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  caption       TEXT,
  taken_at      DATE,
  week_ending   DATE,
  uploaded_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE site_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own site_photos"
  ON site_photos FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_site_photos_project ON site_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_site_photos_user    ON site_photos(user_id);

-- ─── Progress Reports ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS progress_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_type       TEXT NOT NULL DEFAULT 'weekly', -- weekly | monthly | close_out
  week_ending       DATE NOT NULL,
  overall_progress  NUMERIC(5,2),  -- 0-100 %
  work_completed    TEXT,
  work_planned      TEXT,
  issues_risks      TEXT,
  instructions_received TEXT,
  weather_days_lost INT DEFAULT 0,
  labour_headcount  INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own progress_reports"
  ON progress_reports FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pr_project ON progress_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_pr_user    ON progress_reports(user_id);
