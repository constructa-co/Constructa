-- Define the browser-role Data API contract for the Phase 1 launch path.
-- RLS remains the row boundary; grants decide whether a role may reach a
-- table at all. Revoke first so historical projects and fresh projects converge.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_buildups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_delivery_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.profiles,
    public.organizations,
    public.organization_members,
    public.projects,
    public.estimates,
    public.estimate_lines,
    public.estimate_line_components,
    public.rate_buildups,
    public.cost_library_items,
    public.labour_rates,
    public.estimate_dependencies,
    public.proposal_publications,
    public.proposal_publication_events,
    public.proposal_delivery_attempts
FROM PUBLIC, anon, authenticated;

-- Contractor account and organization bootstrap are trigger-owned. Browser
-- users can maintain only their own profile under the existing self policies.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.organizations TO authenticated;
GRANT SELECT ON TABLE public.organization_members TO authenticated;

-- Phase 1 project, estimate and programme editing. Existing RLS policies and
-- accepted-record guards continue to enforce tenant and lifecycle boundaries.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimate_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimate_line_components TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_buildups TO authenticated;
GRANT SELECT ON TABLE public.cost_library_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.labour_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.estimate_dependencies TO authenticated;

-- Published content is written through guarded RPCs. Authenticated owners may
-- read their ledger rows, but cannot mutate the immutable publication record.
GRANT SELECT ON TABLE public.proposal_publications TO authenticated;
GRANT SELECT ON TABLE public.proposal_publication_events TO authenticated;
GRANT SELECT ON TABLE public.proposal_delivery_attempts TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
    public.profiles,
    public.organizations,
    public.organization_members,
    public.projects,
    public.estimates,
    public.estimate_lines,
    public.estimate_line_components,
    public.rate_buildups,
    public.cost_library_items,
    public.labour_rates,
    public.estimate_dependencies,
    public.proposal_publications,
    public.proposal_publication_events,
    public.proposal_delivery_attempts
TO service_role;

REVOKE ALL PRIVILEGES ON SEQUENCE public.proposal_publication_events_id_seq
FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON SEQUENCE public.proposal_publication_events_id_seq
TO service_role;

-- New public-schema objects created by the migration owner fail closed. Every
-- future object must receive a deliberate role disposition in its migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
-- PostgreSQL's built-in PUBLIC EXECUTE default is global. A per-schema revoke
-- cannot override it, so remove it at the migration-owner level and require
-- every subsequent function migration to grant execution deliberately.
ALTER DEFAULT PRIVILEGES
    REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
