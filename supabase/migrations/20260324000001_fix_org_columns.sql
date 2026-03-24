-- Add all missing organization columns (DDL only, no data changes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
