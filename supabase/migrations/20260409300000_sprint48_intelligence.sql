-- Sprint 48: Market Intelligence Product
-- API key infrastructure + usage logging for the benchmark data API

-- ── 1. API keys ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- user_id is NULL for B2B subscriber keys (external, non-contractor users)
  key_hash             TEXT UNIQUE NOT NULL,   -- SHA-256 of the full key (never store plaintext)
  key_prefix           TEXT NOT NULL,          -- first 16 chars for display e.g. "ck_live_a1b2c3d4"
  name                 TEXT NOT NULL DEFAULT 'Default',
  tier                 TEXT NOT NULL DEFAULT 'free'
                         CHECK (tier IN ('free', 'pro', 'enterprise')),
  rate_limit_per_hour  INTEGER NOT NULL DEFAULT 100,
  requests_total       INTEGER NOT NULL DEFAULT 0,
  last_used_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  revoked_at           TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- Contractors can see/manage their own keys
CREATE POLICY "users own api_keys"
  ON api_keys FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_user   ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash   ON api_keys(key_hash) WHERE is_active = true;

-- ── 2. API usage log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  query_params    JSONB,
  response_status INTEGER NOT NULL DEFAULT 200,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- No RLS — service-role only (admin reads, API route writes)
CREATE INDEX IF NOT EXISTS idx_api_usage_key    ON api_usage_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_time   ON api_usage_log(created_at);

-- ── 3. RPC: atomic increment for requests_total ───────────────────────────────
CREATE OR REPLACE FUNCTION increment_api_key_requests(key_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE api_keys
  SET    requests_total = requests_total + 1
  WHERE  id = key_id;
$$;
