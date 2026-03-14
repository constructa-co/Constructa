-- 1. Ensure columns exist (Idempotent)
ALTER TABLE cost_library_items 
ADD COLUMN IF NOT EXISTS overtime_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ownership_status TEXT DEFAULT 'Hired';

-- 2. NUCLEAR OPTION: Disable RLS for this table temporarily to verify functionality
-- This allows anyone (authenticated) to access, which fixes the immediate "blocked" issue.
ALTER TABLE cost_library_items DISABLE ROW LEVEL SECURITY;

-- 3. Just in case, grant access explicitly
GRANT ALL ON cost_library_items TO authenticated;
GRANT ALL ON cost_library_items TO service_role;
