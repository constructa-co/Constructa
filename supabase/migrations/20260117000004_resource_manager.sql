-- 1. Add extra fields for Labour/Plant nuances
ALTER TABLE cost_library_items 
ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ownership_status TEXT DEFAULT 'Hired'; -- 'Owned' or 'Hired'

-- 2. Create a Policy to allow users to insert their own resources
-- Ensure RLS is enabled on the table (it likely is, but good practice to verify or assume it is from previous checks)
ALTER TABLE cost_library_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it conflicts or is too restrictive (Optional, depending on previous state. 
-- Assuming "Public Read" exists. We need "Users Manage Own".)

CREATE POLICY "Users Manage Own Resources" ON cost_library_items 
FOR ALL 
USING (auth.uid() = user_id OR tenant_id = auth.uid())
WITH CHECK (auth.uid() = user_id OR tenant_id = auth.uid());
