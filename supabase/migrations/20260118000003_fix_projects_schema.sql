-- Ensure columns exist for the new CRM features
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Estimating',
ADD COLUMN IF NOT EXISTS project_type TEXT DEFAULT 'Other';

-- Ensure the client_name column exists (created in earlier slices)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS client_name TEXT;
