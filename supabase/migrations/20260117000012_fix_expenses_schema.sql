-- 1. Create Table (Slice 11.0) if not exists
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assembly_id UUID REFERENCES assemblies(id),
  description TEXT NOT NULL,
  supplier TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own expenses" ON project_expenses;
CREATE POLICY "Users manage own expenses" ON project_expenses FOR ALL USING (auth.uid() = (SELECT user_id FROM projects WHERE id = project_expenses.project_id));

-- 2. Add Detail Columns (Slice 11.5)
ALTER TABLE project_expenses
ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'item',
ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS surcharge_cost NUMERIC(12,2) DEFAULT 0;

-- 3. Add Receipt URL (Slice 12.0)
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 4. Storage Bucket Setup
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
