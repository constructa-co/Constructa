-- Add organization_id to estimates, link existing ones via their project
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Link existing estimates to the org of their parent project
UPDATE public.estimates e
SET organization_id = p.organization_id
FROM public.projects p
WHERE e.project_id = p.id
AND e.organization_id IS NULL
AND p.organization_id IS NOT NULL;
