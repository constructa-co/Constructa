-- Stage 2G.2: reviewable drafts from a contractor's own website.
--
-- A draft holds what an import suggested, where each suggestion came from and
-- whether the contractor approved it. It is never read when a proposal is
-- built: proposals come from public.profiles, which only an explicit approval
-- changes. Each draft belongs to the contractor who made it and to no one else.

BEGIN;

CREATE TABLE public.company_import_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    source_url text NOT NULL,
    website text NOT NULL,
    -- When the contractor confirmed the website is theirs to use.
    permission_confirmed_at timestamptz NOT NULL,
    fetched_at timestamptz NOT NULL,
    pages jsonb NOT NULL DEFAULT '[]'::jsonb,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_import_drafts_source_url_http CHECK (source_url ~ '^https?://' AND char_length(source_url) <= 2000),
    CONSTRAINT company_import_drafts_website_http CHECK (website ~ '^https?://' AND char_length(website) <= 300),
    CONSTRAINT company_import_drafts_pages_array CHECK (jsonb_typeof(pages) = 'array' AND pg_column_size(pages) <= 16384),
    CONSTRAINT company_import_drafts_items_array CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) <= 65536)
);

CREATE INDEX company_import_drafts_user_created_idx
    ON public.company_import_drafts (user_id, created_at DESC);

ALTER TABLE public.company_import_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors read their own import drafts"
    ON public.company_import_drafts FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Contractors create their own import drafts"
    ON public.company_import_drafts FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Contractors update their own import drafts"
    ON public.company_import_drafts FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Contractors delete their own import drafts"
    ON public.company_import_drafts FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Where a draft came from and when is fixed once it is made; only the
-- per-item approval state changes afterwards.
CREATE FUNCTION public.company_import_drafts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.source_url IS DISTINCT FROM OLD.source_url
        OR NEW.website IS DISTINCT FROM OLD.website
        OR NEW.permission_confirmed_at IS DISTINCT FROM OLD.permission_confirmed_at
        OR NEW.fetched_at IS DISTINCT FROM OLD.fetched_at
        OR NEW.pages IS DISTINCT FROM OLD.pages
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'The source of an import draft cannot be changed.' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.company_import_drafts_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER company_import_drafts_guard
    BEFORE UPDATE ON public.company_import_drafts
    FOR EACH ROW EXECUTE FUNCTION public.company_import_drafts_guard();

REVOKE ALL PRIVILEGES ON TABLE public.company_import_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_import_drafts TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.company_import_drafts TO service_role;

COMMIT;
