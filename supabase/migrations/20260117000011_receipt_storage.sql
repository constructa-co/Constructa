-- 1. Add Column
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2. Create Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies (Allow Auth users to upload/view)
-- Note: We use "ON CONFLICT" or "IF NOT EXISTS" logic conceptually, but for policies we drop/create to avoid errors if re-running
DROP POLICY IF EXISTS "Auth Users Upload Receipts" ON storage.objects;
CREATE POLICY "Auth Users Upload Receipts" ON storage.objects
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Anyone View Receipts" ON storage.objects;
CREATE POLICY "Anyone View Receipts" ON storage.objects
FOR SELECT TO public 
USING (bucket_id = 'receipts');
