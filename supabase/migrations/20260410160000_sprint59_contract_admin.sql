-- Sprint 59: Contract Administration Suite
-- Config-driven obligation engine for NEC / JCT / FIDIC / Bespoke

-- ─── Contract Settings (one row per project) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_type   TEXT NOT NULL,   -- NEC4_ECC | JCT_SBC | FIDIC_RED_1999 | BESPOKE etc.
  contract_option TEXT,            -- NEC Option A/B/C etc.
  award_date      DATE NOT NULL,
  start_date      DATE,
  completion_date DATE,
  -- Parties (stored as JSONB for flexibility across contract types)
  parties         JSONB NOT NULL DEFAULT '{}',
  -- e.g. { pm: "...", pm_org: "...", employer: "...", employer_org: "..." }
  contract_value  NUMERIC(14,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE contract_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contract_settings"
  ON contract_settings FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cs_project ON contract_settings(project_id);

-- ─── Contract Obligations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_obligations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_id        UUID,            -- linked contract_event (nullable for onAward obligations)
  obligation_type TEXT NOT NULL,   -- programme_submission | monthly_report | ce_quotation etc.
  label           TEXT NOT NULL,
  clause_ref      TEXT,
  party           TEXT NOT NULL,   -- contractor | employer | supervisor
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | complete | overdue | waived
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_obligations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contract_obligations"
  ON contract_obligations FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_co_project ON contract_obligations(project_id);
CREATE INDEX IF NOT EXISTS idx_co_event   ON contract_obligations(event_id);

-- ─── Contract Events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,   -- compensation_event | early_warning | variation | claim | eot etc.
  reference       TEXT,            -- CE-001, EW-001, VAR-001 etc.
  raised_by       TEXT NOT NULL DEFAULT 'contractor',   -- contractor | supervisor | employer
  date_raised     DATE NOT NULL,
  date_aware      DATE,            -- when contractor became aware (for time bar calc)
  time_bar_date   DATE,            -- computed: date_aware + contractorTimeBarDays
  status          TEXT NOT NULL DEFAULT 'open',  -- open | agreed | rejected | withdrawn | closed
  title           TEXT NOT NULL,
  description     TEXT,
  -- For NEC CEs: assessed_time (days), assessed_cost (£)
  assessed_time   INT,
  assessed_cost   NUMERIC(12,2),
  agreed_time     INT,
  agreed_cost     NUMERIC(12,2),
  -- AI-drafted notice (stored so user can edit before sending)
  drafted_notice  TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contract_events"
  ON contract_events FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ce_project ON contract_events(project_id);

-- ─── Contract Communications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_id        UUID,            -- linked contract_event (nullable)
  direction       TEXT NOT NULL,   -- sent | received
  comm_date       DATE NOT NULL,
  reference       TEXT,            -- doc/letter ref
  subject         TEXT NOT NULL,
  body            TEXT,
  from_party      TEXT,
  to_party        TEXT,
  storage_path    TEXT,            -- attachment in Supabase Storage
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contract_communications"
  ON contract_communications FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cc_project ON contract_communications(project_id);

-- ─── Claims ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_id        UUID,            -- linked contract_event (for CE/EoT that escalate)
  claim_type      TEXT NOT NULL,   -- ce_notification | eot | loss_and_expense | prolongation | disruption | adjudication
  reference       TEXT,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft',  -- draft | submitted | under_review | agreed | disputed | adjudication
  time_claimed    INT,             -- days
  cost_claimed    NUMERIC(14,2),
  time_agreed     INT,
  cost_agreed     NUMERIC(14,2),
  -- AI-generated content
  ai_narrative    TEXT,            -- drafted claim narrative
  ai_eot_calc     TEXT,            -- EOT calculation / delay analysis summary
  ai_le_schedule  TEXT,            -- loss & expense schedule
  -- Supporting data snapshot (JSONB of programme/variation/cost data used for AI draft)
  context_snapshot JSONB,
  date_submitted  DATE,
  date_agreed     DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own claims"
  ON claims FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(project_id);
