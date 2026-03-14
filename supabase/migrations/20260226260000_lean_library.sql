-- Create the simplified "Flat-Smart" Cost Library table
CREATE TABLE IF NOT EXISTS cost_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category TEXT NOT NULL,          -- e.g., "1. Preliminaries"
    sub_category TEXT NOT NULL,      -- e.g., "Site Setup & Welfare"
    item_code TEXT UNIQUE NOT NULL,  -- e.g., "1.1.01"
    short_name TEXT NOT NULL,        -- e.g., "Site Cabin (6m)"
    description TEXT,                -- e.g., "Weekly hire of standard site office"
    unit TEXT NOT NULL,              -- e.g., "Week"
    rate NUMERIC(12, 2) NOT NULL,    -- e.g., 85.00
    is_system BOOLEAN DEFAULT true,  -- true for master items, false for user custom items
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE cost_library ENABLE ROW LEVEL SECURITY;

-- 1. Read access: Allow ALL authenticated users to view the catalog
CREATE POLICY "cost_library_read_all" 
ON cost_library FOR SELECT 
TO authenticated 
USING (true);

-- 2. Write access: Only the system (service_role) can insert/update master data
-- This prevents standard users from tampering with the global rate library
CREATE POLICY "cost_library_insert_admin" 
ON cost_library FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);

-- Adding an index for faster category-based lookups
CREATE INDEX IF NOT EXISTS idx_cost_library_category ON cost_library(category, sub_category);
