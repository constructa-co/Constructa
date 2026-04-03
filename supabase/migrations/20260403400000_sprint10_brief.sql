-- Add fields to projects for Brief tab
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_scope TEXT;           -- Detailed scope from Brief tab
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_trade_sections TEXT[]; -- AI-suggested trade sections
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7);           -- From postcode lookup
ALTER TABLE projects ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);           -- From postcode lookup
ALTER TABLE projects ADD COLUMN IF NOT EXISTS region TEXT;                 -- e.g. "London", "South East"
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'domestic'; -- 'domestic' | 'commercial' | 'public'
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS programme_phases JSONB DEFAULT '[]'::jsonb;
-- programme_phases: [{ name, duration, unit, startOffset, manhours, manual_override }]
