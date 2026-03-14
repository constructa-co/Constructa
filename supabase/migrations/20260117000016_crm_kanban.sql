ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Lead', -- Lead, Estimating, Active, Complete
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'Extension', -- Extension, New Build, Renovation, Commercial
ADD COLUMN IF NOT EXISTS potential_value NUMERIC(12,2) DEFAULT 0; -- For manual override on Leads
