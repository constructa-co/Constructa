ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS scope_text TEXT, -- Dedicated scope narrative
ADD COLUMN IF NOT EXISTS exclusions_text TEXT,
ADD COLUMN IF NOT EXISTS clarifications_text TEXT;
