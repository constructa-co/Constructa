ALTER TABLE projects ADD COLUMN IF NOT EXISTS selected_case_study_ids JSONB DEFAULT '[]'::jsonb;
