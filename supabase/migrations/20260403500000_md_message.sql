-- Add MD (Managing Director) message fields to profiles and closing statement to projects
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS md_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS md_message TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS closing_statement TEXT;
