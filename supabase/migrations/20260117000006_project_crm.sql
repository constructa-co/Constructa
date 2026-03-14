ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS client_address TEXT,
ADD COLUMN IF NOT EXISTS site_address TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS scope_description TEXT, -- For the "Intro" paragraph
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft'; -- Draft, Sent, Won, Lost
