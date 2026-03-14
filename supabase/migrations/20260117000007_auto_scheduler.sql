ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS start_delay_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_duration_days INTEGER; -- If NULL, use calculated
