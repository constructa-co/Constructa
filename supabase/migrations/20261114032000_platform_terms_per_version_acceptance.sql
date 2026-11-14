-- A023 F2: per-user, per-version platform terms acceptance.
-- DRAFT ONLY — not applied by automation; Rob approves before `supabase db push`.
-- Follows 20261024122500_platform_terms_acceptance.sql, which is already applied
-- to QA and is deliberately NOT edited.
--
-- Why: that migration allowed one acceptance row per (user, document)
-- (platform_terms_acceptances_one_current_record). Once a second terms revision
-- is published, a user who accepted the first could never record the second,
-- so re-acceptance would be impossible. This migration relaxes the uniqueness
-- to (user_id, terms_document, accepted_revision): one immutable row per user
-- per revision, so a new revision adds a row and the older row is kept as the
-- historical record.
--
-- What does NOT change:
--   - columns, RLS policies and grants: authenticated keeps SELECT and the
--     column-narrow INSERT (user_id, terms_document, accepted_revision);
--     no UPDATE or DELETE, no service_role grant;
--   - the known-document and known-revision CHECK constraints. Publishing a
--     new revision still needs a later, separate migration that replaces
--     platform_terms_acceptances_known_revision with the extended allow-list,
--     coordinated with src/lib/platform-terms.ts. Until both exist the new
--     revision is refused at every boundary.
--
-- Ordering: the new constraint is added BEFORE the old one is dropped, inside
-- one transaction, so there is no window without a uniqueness guarantee.
-- Existing rows already satisfy the wider key (it is a superset of the old
-- one), so the ADD cannot fail on current data.
--
-- Application impact: for the one recognised revision the behaviour is
-- identical (a repeat acceptance still hits a unique violation and is reported
-- as already-recorded). The new unique index also serves the enforcement
-- lookup (user_id, terms_document, accepted_revision).

BEGIN;

ALTER TABLE public.platform_terms_acceptances
    ADD CONSTRAINT platform_terms_acceptances_one_record_per_revision
    UNIQUE (user_id, terms_document, accepted_revision);

ALTER TABLE public.platform_terms_acceptances
    DROP CONSTRAINT platform_terms_acceptances_one_current_record;

COMMIT;
