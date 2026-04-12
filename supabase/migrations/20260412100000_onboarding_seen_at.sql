-- Sprint 58 gap-filler #5: onboarding tour tracking.
-- When NULL, the 3-step welcome tour shows on the home dashboard.
-- Once dismissed, we write now() so it never shows again.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_seen_at TIMESTAMPTZ;
