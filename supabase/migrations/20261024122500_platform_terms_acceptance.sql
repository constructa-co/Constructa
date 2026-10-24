-- A023: durable server-side record of platform terms acceptance.
--
-- One row records that an authenticated user explicitly accepted a named
-- revision of the platform terms of service, at a time stamped by the
-- database, not the browser. What this is:
--
--   - user identity: auth.users FK, written only via RLS that forces
--     user_id = auth.uid(), so a caller can never record acceptance for
--     anyone but the holder of the current session;
--   - revision: a technical document descriptor validated by a CHECK
--     constraint against an explicit allow-list. The user-visible terms
--     page (src/app/terms-of-service/page.tsx) is dated only "March 2026"
--     in prose; there is NO business-approved legal version identifier in
--     the product, so "platform-tos-2026-03" identifies the technical
--     revision of that visible document and makes no claim of legal
--     approval. Publishing a new revision requires a coordinated migration
--     (add the descriptor here) and code change (src/lib/platform-terms.ts);
--     until both exist the new revision is refused everywhere;
--   - time: accepted_at is DEFAULT now() and the application never sends a
--     timestamp column, so the recorded instant is the server's.
--
-- What this is NOT: it is not the twelve STANDARD_PROPOSAL_TERMS contract
-- clauses, it does not change any proposal/terms wording, it does not
-- re-enable or gate signup, and it adds no screen. Nothing in the
-- application calls the insert yet; the server action
-- (src/lib/platform-terms-actions.ts) is the recording boundary, wired to a
-- UI by the coordinator later. The table is immutable to clients: no
-- UPDATE or DELETE is granted to authenticated.
--
-- Column-narrow INSERT (A023 coordinator repair): authenticated receives
-- INSERT on (user_id, terms_document, accepted_revision) ONLY — never
-- table-wide INSERT. The primary key `id` and `accepted_at` therefore
-- cannot be named by any client (including a direct PostgREST client with
-- a valid session); the database's DEFAULT gen_random_uuid() / now() are
-- the only way they ever get a value. No service_role grant is made at
-- all: nothing writes this table except an authenticated session through
-- RLS, so no bypass or broad grant exists.
--
-- Idempotence: at most one current record per (user, document). A repeat
-- acceptance hits the unique constraint and is reported by the application
-- as already-recorded rather than failing.

BEGIN;

CREATE TABLE public.platform_terms_acceptances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    terms_document text NOT NULL,
    accepted_revision text NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT platform_terms_acceptances_owner UNIQUE (id, user_id),
    CONSTRAINT platform_terms_acceptances_one_current_record UNIQUE (user_id, terms_document),
    CONSTRAINT platform_terms_acceptances_known_document
        CHECK (terms_document = 'constructa-platform-terms-of-service'),
    CONSTRAINT platform_terms_acceptances_known_revision
        CHECK (accepted_revision IN ('platform-tos-2026-03'))
);

ALTER TABLE public.platform_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Signed-in users record and read only their own acceptance; they cannot
-- UPDATE or DELETE (no such grant below), so a record, once written, is
-- immutable from the application's point of view. INSERT is granted on the
-- three client-named columns only: id and accepted_at are database-
-- generated and unnameable by any client.
CREATE POLICY "Users record their own platform terms acceptance"
    ON public.platform_terms_acceptances FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users read their own platform terms acceptance"
    ON public.platform_terms_acceptances FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

REVOKE ALL PRIVILEGES ON TABLE public.platform_terms_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.platform_terms_acceptances TO authenticated;
GRANT INSERT (user_id, terms_document, accepted_revision)
    ON TABLE public.platform_terms_acceptances TO authenticated;

COMMIT;
