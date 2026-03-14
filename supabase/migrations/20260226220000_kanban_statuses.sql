-- Standardize Kanban statuses
ALTER TABLE projects 
ALTER COLUMN status SET DEFAULT 'Lead';

-- Migrate any existing legacy statuses to the new naming convention
UPDATE projects SET status = 'Completed' WHERE status = 'Complete';
UPDATE projects SET status = 'Estimating' WHERE status IS NULL;
