-- Public proposal links resolve through service-role-only publication RPCs.
-- Browser roles must never read mutable project or contractor profile rows.

BEGIN;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Revoke inherited/default privileges as well as any historical direct anon
-- grants. Authenticated access remains governed by its explicit grants and RLS.
REVOKE ALL PRIVILEGES ON TABLE public.projects FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon;

COMMIT;
