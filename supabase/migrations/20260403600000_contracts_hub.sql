-- Add contracts-related fields to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tc_tier TEXT DEFAULT 'domestic';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS risk_register JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_exclusions TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_clarifications TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS uploaded_contract_text TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_review_flags JSONB DEFAULT '[]'::jsonb;
