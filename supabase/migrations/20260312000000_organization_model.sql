-- 1. Create Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Organization Members Table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Owner', 'Admin', 'Member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 3. Add organization_id to core tables
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.mom_categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.mom_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.assemblies ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.assembly_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 4. Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function: Get Current User's Organizations
CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS SETOF UUID AS $$
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Initial Data Migration: Create organizations for existing users
-- For every existing profile, create a "Default Team"
DO $$
DECLARE
    rec RECORD;
    new_org_id UUID;
BEGIN
    FOR rec IN SELECT id, full_name, email FROM public.profiles LOOP
        -- Create the organization
        INSERT INTO public.organizations (name)
        VALUES (COALESCE(rec.full_name, split_part(rec.email, '@', 1)) || '''s Team')
        RETURNING id INTO new_org_id;

        -- Add user as Owner
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (new_org_id, rec.id, 'Owner');

        -- Assign existing items to this new org
        UPDATE public.projects SET organization_id = new_org_id WHERE user_id = rec.id OR tenant_id = rec.id;
        UPDATE public.mom_categories SET organization_id = new_org_id WHERE user_id = rec.id;
        UPDATE public.mom_items SET organization_id = new_org_id WHERE user_id = rec.id;
        -- Estimates and invoices can usually be linked via project_id, but we'll set them for safety
        UPDATE public.estimates SET organization_id = new_org_id WHERE project_id IN (SELECT id FROM public.projects WHERE organization_id = new_org_id);
        UPDATE public.invoices SET organization_id = new_org_id WHERE project_id IN (SELECT id FROM public.projects WHERE organization_id = new_org_id);
    END LOOP;
END $$;

-- 7. Update RLS Policies to use organization_id
-- We will refine these in a separate migration for clarity, but basic "Member of Org" access:

-- Organizations: Selection only for members
CREATE POLICY "org_select_member" ON public.organizations
FOR SELECT USING (id IN (SELECT public.get_my_organizations()));

-- Organization Members: Selection only for members of the same org
CREATE POLICY "org_member_select" ON public.organization_members
FOR SELECT USING (organization_id IN (SELECT public.get_my_organizations()));

-- Projects: Org level access
DROP POLICY IF EXISTS select_own_projects ON projects;
CREATE POLICY "project_org_select" ON projects FOR SELECT USING (organization_id IN (SELECT public.get_my_organizations()));
CREATE POLICY "project_org_all" ON projects FOR ALL USING (organization_id IN (SELECT public.get_my_organizations()));
