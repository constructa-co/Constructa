-- Sprint 44: Xero Integration
-- OAuth connection storage, sync log, and invoice/expense Xero ID tracking

-- ── 1. Xero connection (one per user) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xero_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id         TEXT NOT NULL,          -- Xero organisation ID
  tenant_name       TEXT,                   -- Xero organisation display name
  access_token      TEXT NOT NULL,          -- short-lived (30 min), stored as-is
  refresh_token     TEXT NOT NULL,          -- long-lived (60 days)
  token_expires_at  TIMESTAMPTZ NOT NULL,
  scopes            TEXT,
  connected_at      TIMESTAMPTZ DEFAULT now(),
  last_sync_at      TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own xero_connections"
  ON xero_connections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 2. Sync log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xero_sync_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type     TEXT NOT NULL,   -- 'push_invoices' | 'pull_payments' | 'push_expenses' | 'full_sync'
  status        TEXT NOT NULL,   -- 'success' | 'error' | 'partial'
  items_synced  INTEGER NOT NULL DEFAULT 0,
  items_failed  INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  details       JSONB,           -- per-item results { invoiceId, xeroId, status, error }[]
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE xero_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own xero_sync_log"
  ON xero_sync_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_xero_sync_log_user ON xero_sync_log(user_id);

-- ── 3. Track Xero IDs on existing tables ─────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS xero_invoice_id TEXT,  -- Xero InvoiceID after push
  ADD COLUMN IF NOT EXISTS xero_synced_at   TIMESTAMPTZ;

ALTER TABLE project_expenses
  ADD COLUMN IF NOT EXISTS xero_bill_id   TEXT,   -- Xero BillID after push
  ADD COLUMN IF NOT EXISTS xero_synced_at TIMESTAMPTZ;
