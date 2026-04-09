-- Sprint 41: CIS Compliance
-- UK Construction Industry Scheme — subcontractor deduction tracking

-- ── 1. CIS fields on profiles ─────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cis_registered        BOOLEAN    DEFAULT false,
  ADD COLUMN IF NOT EXISTS cis_contractor_utr    TEXT,
  ADD COLUMN IF NOT EXISTS cis_paye_reference    TEXT,
  ADD COLUMN IF NOT EXISTS cis_accounts_office_ref TEXT;

-- ── 2. Subcontractor register ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cis_subcontractors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  trading_name        TEXT,
  utr                 TEXT,                        -- 10-digit Unique Taxpayer Reference
  company_number      TEXT,                        -- Companies House number (if ltd)
  verification_number TEXT,                        -- HMRC verification reference (e.g. V123456789)
  cis_status          TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (cis_status IN ('gross', 'standard', 'higher', 'unverified')),
  last_verified_at    DATE,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cis_subcontractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own cis_subcontractors"
  ON cis_subcontractors FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cis_subcontractors_user ON cis_subcontractors(user_id);

-- ── 3. CIS payment records ────────────────────────────────────────────────────
-- Each record = one payment to a subcontractor, with deduction calculation
CREATE TABLE IF NOT EXISTS cis_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  subcontractor_id      UUID NOT NULL REFERENCES cis_subcontractors(id) ON DELETE RESTRICT,
  payment_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  gross_payment         NUMERIC(12,2) NOT NULL,
  materials_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- materials element (not subject to CIS)
  labour_amount         NUMERIC(12,2) GENERATED ALWAYS AS (gross_payment - materials_amount) STORED,
  deduction_rate        NUMERIC(5,2)  NOT NULL DEFAULT 20, -- 0, 20, or 30
  deduction_amount      NUMERIC(12,2) GENERATED ALWAYS AS (
                          ROUND((gross_payment - materials_amount) * deduction_rate / 100, 2)
                        ) STORED,
  net_payment           NUMERIC(12,2) GENERATED ALWAYS AS (
                          gross_payment - ROUND((gross_payment - materials_amount) * deduction_rate / 100, 2)
                        ) STORED,
  -- Tax month: always the 6th of the month in which this payment falls
  -- (i.e. if payment_date >= 6th, tax month = current month's 6th;
  --  if payment_date < 6th, tax month = previous month's 6th)
  -- Computed and stored by the application (6th of the tax month covering this payment)
  tax_month_start       DATE NOT NULL,
  statement_sent        BOOLEAN NOT NULL DEFAULT false,
  description           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cis_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own cis_payments"
  ON cis_payments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cis_payments_user        ON cis_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_cis_payments_project     ON cis_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_cis_payments_subcontractor ON cis_payments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_cis_payments_tax_month   ON cis_payments(tax_month_start);
