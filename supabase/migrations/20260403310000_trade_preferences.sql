-- Add trade preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_trades TEXT[] DEFAULT '{}';
-- Default to empty array — contractor selects during onboarding/profile
