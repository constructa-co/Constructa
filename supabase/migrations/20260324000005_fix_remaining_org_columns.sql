-- Add missing organization_id columns to remaining tables

ALTER TABLE public.assemblies ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.assembly_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.assembly_options ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Link estimate_lines to org via their estimate -> project -> org chain
UPDATE public.estimate_lines el
SET organization_id = p.organization_id
FROM public.estimates e
JOIN public.projects p ON p.id = e.project_id
WHERE el.estimate_id = e.id
AND el.organization_id IS NULL
AND p.organization_id IS NOT NULL;

-- Link assemblies: they belong to a user, find org via organization_members
-- assemblies have user_id referencing profiles
UPDATE public.assemblies a
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE a.user_id = om.user_id
AND a.organization_id IS NULL;

-- Link assembly_items via their assembly
UPDATE public.assembly_items ai
SET organization_id = a.organization_id
FROM public.assemblies a
WHERE ai.assembly_id = a.id
AND ai.organization_id IS NULL
AND a.organization_id IS NOT NULL;
