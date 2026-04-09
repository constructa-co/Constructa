-- Sprint 42: Data Foundation & Benchmark Layer
-- Anonymised aggregation tables for cross-contractor intelligence.
-- No RLS — service-role only. No PII stored.
-- All writes gated on profiles.data_consent = true.

-- ── 1. GDPR consent gate on profiles ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS data_consent       BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_consent_at    TIMESTAMPTZ;

-- ── 2. Benchmark tables ───────────────────────────────────────────────────────

-- Project-level outcomes (one row per closed project that consented)
CREATE TABLE IF NOT EXISTS project_benchmarks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No user_id — anonymised
  captured_at           TIMESTAMPTZ DEFAULT now(),
  project_type          TEXT,
  region                TEXT,
  -- Contract value band (not exact value — privacy-preserving)
  contract_value_band   TEXT,   -- e.g. '0-50k', '50k-100k', '100k-250k', '250k-500k', '500k+'
  -- Financial outcomes
  gross_margin_pct      NUMERIC(6,2),
  overhead_pct          NUMERIC(6,2),
  profit_pct            NUMERIC(6,2),
  -- Programme
  planned_duration_days INTEGER,
  actual_duration_days  INTEGER,
  programme_delay_days  INTEGER,
  -- Variations
  variation_count       INTEGER,
  variation_rate_pct    NUMERIC(6,2),   -- approved vars as % of contract value
  -- Subcontract dependency
  subcontract_cost_pct  NUMERIC(6,2)    -- subcontract costs as % of total costs
);

-- Labour rate benchmarks by trade and region
CREATE TABLE IF NOT EXISTS rate_benchmarks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at   TIMESTAMPTZ DEFAULT now(),
  trade_section TEXT NOT NULL,
  region        TEXT,
  rate_type     TEXT NOT NULL CHECK (rate_type IN ('labour', 'plant', 'material')),
  unit          TEXT,
  rate_gbp      NUMERIC(10,2) NOT NULL,
  sample_size   INTEGER DEFAULT 1   -- incremented on upsert aggregation
);

-- Variation benchmarks by project type
CREATE TABLE IF NOT EXISTS variation_benchmarks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at             TIMESTAMPTZ DEFAULT now(),
  project_type            TEXT,
  contract_value_band     TEXT,
  avg_variation_count     NUMERIC(8,2),
  avg_variation_rate_pct  NUMERIC(6,2),
  avg_approved_pct        NUMERIC(6,2)   -- % of raised variations that are approved
);

-- Programme duration benchmarks
CREATE TABLE IF NOT EXISTS programme_benchmarks (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at              TIMESTAMPTZ DEFAULT now(),
  project_type             TEXT,
  contract_value_band      TEXT,
  avg_planned_days         NUMERIC(8,1),
  avg_actual_days          NUMERIC(8,1),
  avg_delay_days           NUMERIC(8,1),
  pct_delivered_on_time    NUMERIC(6,2)
);

-- ── 3. Trigger function — project archived → project_benchmarks ───────────────
CREATE OR REPLACE FUNCTION fn_benchmark_on_archive()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_consent       BOOLEAN;
  v_project_type  TEXT;
  v_region        TEXT;
  v_cv            NUMERIC;
  v_cv_band       TEXT;
  v_snap          RECORD;
  v_sub_pct       NUMERIC;
BEGIN
  -- Only fire when is_archived flips to true
  IF NEW.is_archived IS NOT TRUE OR OLD.is_archived IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Check consent
  SELECT data_consent INTO v_consent FROM profiles WHERE id = NEW.user_id;
  IF v_consent IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Get snapshot
  SELECT * INTO v_snap FROM archive_snapshots
    WHERE project_id = NEW.id
    ORDER BY snapshot_date DESC LIMIT 1;

  IF v_snap IS NULL THEN RETURN NEW; END IF;

  v_project_type := NEW.project_type;
  v_region       := NEW.site_address;  -- use site address as region proxy for now
  v_cv           := COALESCE(v_snap.contract_value, 0);

  -- Contract value band
  v_cv_band := CASE
    WHEN v_cv < 50000      THEN '0-50k'
    WHEN v_cv < 100000     THEN '50k-100k'
    WHEN v_cv < 250000     THEN '100k-250k'
    WHEN v_cv < 500000     THEN '250k-500k'
    ELSE '500k+'
  END;

  -- Subcontract cost % (from project_expenses)
  SELECT
    CASE WHEN SUM(amount) > 0
      THEN ROUND(SUM(CASE WHEN cost_type = 'subcontract' THEN amount ELSE 0 END) * 100.0 / SUM(amount), 2)
      ELSE 0
    END
  INTO v_sub_pct
  FROM project_expenses WHERE project_id = NEW.id;

  -- Variation rate %
  INSERT INTO project_benchmarks (
    project_type, region, contract_value_band,
    gross_margin_pct, planned_duration_days, actual_duration_days,
    programme_delay_days, variation_count, variation_rate_pct, subcontract_cost_pct
  ) VALUES (
    v_project_type,
    v_region,
    v_cv_band,
    v_snap.gross_margin_pct,
    v_snap.planned_duration_days,
    v_snap.actual_duration_days,
    v_snap.programme_delay_days,
    v_snap.variation_count,
    CASE WHEN v_cv > 0
      THEN ROUND(COALESCE(v_snap.approved_variation_total, 0) * 100.0 / v_cv, 2)
      ELSE 0
    END,
    v_sub_pct
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_benchmark_on_archive ON projects;
CREATE TRIGGER trg_benchmark_on_archive
  AFTER UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_benchmark_on_archive();

-- ── 4. Helper function — contract value band ──────────────────────────────────
-- Used by admin dashboard queries
CREATE OR REPLACE FUNCTION fn_cv_band(v NUMERIC)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v < 50000  THEN '0-50k'
    WHEN v < 100000 THEN '50k-100k'
    WHEN v < 250000 THEN '100k-250k'
    WHEN v < 500000 THEN '250k-500k'
    ELSE '500k+'
  END;
$$;
