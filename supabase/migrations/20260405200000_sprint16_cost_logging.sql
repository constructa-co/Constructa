-- ── Sprint 16: Enhanced Cost Logging ─────────────────────────────────────────
-- 1. WBS linkage: estimate_line_id FK on project_expenses
-- 2. Receipt/document storage: receipt_url on project_expenses + Storage bucket
-- 3. Staff resource enhancements: rate_mode, hourly chargeout, extra benefit fields
-- 4. Plant resource enhancements: rate_mode, daily_chargeout_rate for simple mode

-- ── 1. estimate_line_id on project_expenses ───────────────────────────────────
ALTER TABLE project_expenses
  ADD COLUMN IF NOT EXISTS estimate_line_id UUID REFERENCES estimate_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_estimate_line
  ON project_expenses(estimate_line_id);

-- ── 2. receipt_url on project_expenses ────────────────────────────────────────
ALTER TABLE project_expenses
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- ── 2a. Supabase Storage: receipts bucket ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth Users Upload Receipts" ON storage.objects;
CREATE POLICY "Auth Users Upload Receipts" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Anyone View Receipts" ON storage.objects;
CREATE POLICY "Anyone View Receipts" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Auth Users Delete Own Receipts" ON storage.objects;
CREATE POLICY "Auth Users Delete Own Receipts" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 3. Staff resource: rate_mode + additional cost fields ────────────────────
ALTER TABLE staff_resources
  ADD COLUMN IF NOT EXISTS rate_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (rate_mode IN ('simple', 'full')),
  ADD COLUMN IF NOT EXISTS hourly_chargeout_rate NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_chargeout_rate NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS car_allowance_annual NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mobile_phone_annual NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- ── 4. Plant resource: rate_mode + simple daily chargeout ─────────────────────
ALTER TABLE plant_resources
  ADD COLUMN IF NOT EXISTS rate_mode TEXT NOT NULL DEFAULT 'full'
    CHECK (rate_mode IN ('simple', 'full')),
  ADD COLUMN IF NOT EXISTS daily_chargeout_rate NUMERIC(10,2) DEFAULT 0;

-- Update category constraint to new values
ALTER TABLE plant_resources DROP CONSTRAINT IF EXISTS plant_resources_category_check;
ALTER TABLE plant_resources ADD CONSTRAINT plant_resources_category_check
  CHECK (category IN ('heavy_plant', 'light_plant', 'lifting', 'temp_works', 'light_tools', 'specialist_tools', 'other'));
