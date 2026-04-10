-- Sprint 54: Accounting Reconciliation
-- Bank CSV import, auto-match, VAT periods, schema backfills

-- ── 1. Schema backfills (code already references these) ─────────────────────

-- payment_schedule_milestones (referenced in billing actions)
CREATE TABLE IF NOT EXISTS payment_schedule_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date     DATE,
  paid_date    DATE,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | invoiced | paid
  notes        TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_schedule_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own milestones"
  ON payment_schedule_milestones FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_psm_user    ON payment_schedule_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_psm_project ON payment_schedule_milestones(project_id);

-- archive_snapshots (referenced in management accounts benchmarking)
CREATE TABLE IF NOT EXISTS archive_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  contract_value  NUMERIC(12,2),
  total_invoiced  NUMERIC(12,2),
  total_received  NUMERIC(12,2),
  total_costs     NUMERIC(12,2),
  gross_margin    NUMERIC(5,2),
  retention_held  NUMERIC(12,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE archive_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own snapshots"
  ON archive_snapshots FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_snap_user    ON archive_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snap_project ON archive_snapshots(project_id);

-- ── 2. Bank transactions ─────────────────────────────────────────────────────
-- Imported from bank CSV. One row per bank statement line.
CREATE TABLE IF NOT EXISTS bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description     TEXT NOT NULL,
  reference       TEXT,                -- cheque no, sort code ref, etc.
  amount          NUMERIC(12,2) NOT NULL, -- positive = credit, negative = debit
  balance         NUMERIC(12,2),          -- running balance if in CSV
  source_file     TEXT,                   -- original filename for traceability
  import_batch_id UUID,                   -- groups rows from same import
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own transactions"
  ON bank_transactions FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_bt_user ON bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bt_date ON bank_transactions(transaction_date);

-- ── 3. Bank reconciliation ───────────────────────────────────────────────────
-- Links a bank transaction to an invoice (or marks as unmatched expense/other)
CREATE TABLE IF NOT EXISTS bank_reconciliation (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_transaction_id  UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  invoice_id           UUID REFERENCES invoices(id) ON DELETE SET NULL,
  match_type           TEXT NOT NULL DEFAULT 'manual', -- auto | manual | unmatched
  match_confidence     NUMERIC(3,2),  -- 0.0–1.0 for auto matches
  category             TEXT,          -- expense category if not matched to invoice
  project_id           UUID REFERENCES projects(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE bank_reconciliation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own reconciliation"
  ON bank_reconciliation FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_rec_user ON bank_reconciliation(user_id);
CREATE INDEX IF NOT EXISTS idx_rec_txn  ON bank_reconciliation(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_rec_inv  ON bank_reconciliation(invoice_id);

-- ── 4. VAT periods ───────────────────────────────────────────────────────────
-- Quarterly/monthly VAT periods for MTD reporting
CREATE TABLE IF NOT EXISTS vat_periods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  period_key        TEXT,              -- HMRC period key e.g. "24A1"
  vat_rate          NUMERIC(4,2) NOT NULL DEFAULT 20.00,
  output_vat        NUMERIC(12,2) NOT NULL DEFAULT 0,  -- VAT on sales
  input_vat         NUMERIC(12,2) NOT NULL DEFAULT 0,  -- VAT on purchases
  net_vat_due       NUMERIC(12,2) GENERATED ALWAYS AS (output_vat - input_vat) STORED,
  status            TEXT NOT NULL DEFAULT 'open',  -- open | submitted | paid
  submitted_at      TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vat_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own vat periods"
  ON vat_periods FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_vat_user ON vat_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_vat_period ON vat_periods(period_start, period_end);

-- ── 5. Overhead costs ────────────────────────────────────────────────────────
-- Head-office / overhead expenses not tied to a specific project
-- Feeds company P&L and overhead absorption calculation
CREATE TABLE IF NOT EXISTS overhead_costs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cost_date    DATE NOT NULL,
  category     TEXT NOT NULL,  -- Salaries | Rent | Utilities | Insurance | Other
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  vat_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier     TEXT,
  reference    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE overhead_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own overhead costs"
  ON overhead_costs FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_oc_user ON overhead_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_oc_date ON overhead_costs(cost_date);
