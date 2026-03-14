-- 1. Commercial Settings
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Monthly Valuations, 14 days terms',
ADD COLUMN IF NOT EXISTS retention_percent NUMERIC(5,2) DEFAULT 0.0; -- e.g. 5.0

-- 2. Valuations (The Header)
CREATE TABLE IF NOT EXISTS valuations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  application_number INTEGER NOT NULL,
  valuation_date DATE DEFAULT CURRENT_DATE,
  gross_total NUMERIC(12,2) NOT NULL, -- Total Value of work done to date
  retention_amount NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL, -- The amount claimed THIS time
  status TEXT DEFAULT 'Draft', -- Draft, Submitted, Paid, Overdue
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Valuation Lines (The Detail)
CREATE TABLE IF NOT EXISTS valuation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_id UUID REFERENCES valuations(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES estimates(id), -- Link to the task (e.g. Foundations)
  progress_percent NUMERIC(5,2) DEFAULT 0, -- e.g. 50%
  line_value NUMERIC(12,2) NOT NULL -- The monetary value of that progress
);

-- RLS
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own valuations" ON valuations FOR ALL USING (auth.uid() = (SELECT user_id FROM projects WHERE id = valuations.project_id));
CREATE POLICY "Users manage own valuation lines" ON valuation_lines FOR ALL USING (auth.uid() = (SELECT user_id FROM projects WHERE id = (SELECT project_id FROM valuations WHERE id = valuation_lines.valuation_id)));
