-- Cohort AI bounds: four more features may be given a usage budget.
--
-- The budget covered two features (profile.rewrite, company.introduction).
-- This lets four existing AI text features that a cohort contractor can
-- reach be put behind the same budget:
--
--   brief.suggest               tidy a job description (Brief)
--   proposal.wording            tidy a proposal field (Review and send)
--   case-studies.enhance        tidy a case study's two sections
--   schedule.programme-update   write a weekly progress update (Programme)
--
-- That makes six features. It is still NOT an application-wide limit: other
-- AI features, outside the cohort launch profile, have no usage budget.
--
-- ALL FOUR ARE SEEDED DISABLED. This migration changes no allowance: the
-- 'contractor' and 'global' rows are not touched, and company.introduction
-- stays off. Nothing here switches anything on.
--
-- Rollout consequence, stated so nobody is surprised: the application code
-- that goes with this migration calls these four features only through the
-- budget. While their rows are disabled the buttons answer "not available"
-- and make no call. Those buttons work today. Deploying the code without an
-- owner-approved activation (which also has to settle the allowance for six
-- features) therefore turns four existing AI buttons off. That is a
-- deliberate, disclosed gate, and the activation is a separate migration.

BEGIN;

ALTER TABLE public.ai_generation_features DROP CONSTRAINT ai_generation_features_known;
ALTER TABLE public.ai_generation_features ADD CONSTRAINT ai_generation_features_known CHECK (feature IN (
    'company.introduction',
    'profile.rewrite',
    'brief.suggest',
    'proposal.wording',
    'case-studies.enhance',
    'schedule.programme-update'
));

-- Only the interview's wording is written from fingerprinted sources. The
-- other five carry no fingerprint.
ALTER TABLE public.ai_generation_attempts DROP CONSTRAINT ai_generation_attempts_fingerprint;
ALTER TABLE public.ai_generation_attempts ADD CONSTRAINT ai_generation_attempts_fingerprint CHECK (
    (feature = 'company.introduction' AND source_fingerprint IS NOT NULL AND source_fingerprint ~ '^[0-9a-f]{32}$')
    OR (feature <> 'company.introduction' AND source_fingerprint IS NULL)
);

-- Explicitly off, each with the most output one call may reserve.
INSERT INTO public.ai_generation_features (feature, enabled, max_reserve_output_tokens) VALUES
    ('brief.suggest', false, 700),
    ('proposal.wording', false, 2000),
    ('case-studies.enhance', false, 1000),
    ('schedule.programme-update', false, 900);

COMMIT;
