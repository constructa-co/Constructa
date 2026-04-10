-- Sprint 51: Resource Planning & Portfolio Management

-- ── 1. staff_type on staff_resources ─────────────────────────────────────────
-- Distinguishes direct project labour from overhead/head-office staff
ALTER TABLE staff_resources
  ADD COLUMN IF NOT EXISTS staff_type TEXT NOT NULL DEFAULT 'direct_labour';
-- Values: 'direct_labour' | 'overhead'

-- ── 2. Resource allocations ───────────────────────────────────────────────────
-- Links a person (or role placeholder) to a project for a date range.
-- Created from programme phases + estimate manhours by the contractor.
CREATE TABLE IF NOT EXISTS resource_allocations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  staff_resource_id UUID REFERENCES staff_resources(id) ON DELETE SET NULL,
  -- If no named person yet (e.g. bidding stage), store the role/trade
  role_placeholder  TEXT,           -- e.g. "Carpenter", "Groundworker"
  trade_section     TEXT,           -- matches estimate trade section
  phase_name        TEXT,           -- which programme phase this covers
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  days_allocated    NUMERIC(6,1) NOT NULL DEFAULT 1,
  days_per_week     NUMERIC(3,1) NOT NULL DEFAULT 5, -- full-time default
  is_confirmed      BOOLEAN NOT NULL DEFAULT true,   -- false = tentative (bid stage)
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE resource_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own allocations"
  ON resource_allocations FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ra_user       ON resource_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_ra_project    ON resource_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_ra_staff      ON resource_allocations(staff_resource_id);
CREATE INDEX IF NOT EXISTS idx_ra_dates      ON resource_allocations(start_date, end_date);

-- ── 3. Staff absence ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_absence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_resource_id UUID NOT NULL REFERENCES staff_resources(id) ON DELETE CASCADE,
  absence_type      TEXT NOT NULL DEFAULT 'Holiday', -- Holiday|Sick|Training|Other
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_absence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own absences"
  ON staff_absence FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_absence_user  ON staff_absence(user_id);
CREATE INDEX IF NOT EXISTS idx_absence_staff ON staff_absence(staff_resource_id);
CREATE INDEX IF NOT EXISTS idx_absence_dates ON staff_absence(start_date, end_date);
