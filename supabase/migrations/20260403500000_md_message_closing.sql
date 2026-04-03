-- Add MD (Managing Director) message and closing statement fields to profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS md_name TEXT,
    ADD COLUMN IF NOT EXISTS md_message TEXT,
    ADD COLUMN IF NOT EXISTS closing_statement TEXT;
