-- Fix: Bootstrap organizations for existing users
-- Safely adds all missing columns, then creates orgs for users who have none

-- Step 1: Add active_organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.organizations(id);

-- Step 2: Ensure organization_id columns exist on data tables
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.mom_categories ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.mom_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Step 3: Create org + membership for any user who has none
DO $$
DECLARE
  rec RECORD;
  new_org_id UUID;
BEGIN
  FOR rec IN
    SELECT p.id, p.full_name, p.email
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members om WHERE om.user_id = p.id
    )
  LOOP
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(rec.full_name, split_part(rec.email, '@', 1)) || '''s Team')
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, rec.id, 'Owner');

    UPDATE public.projects
      SET organization_id = new_org_id
      WHERE user_id = rec.id AND organization_id IS NULL;

    UPDATE public.mom_categories
      SET organization_id = new_org_id
      WHERE user_id = rec.id AND organization_id IS NULL;

    UPDATE public.mom_items
      SET organization_id = new_org_id
      WHERE user_id = rec.id AND organization_id IS NULL;
  END LOOP;
END $$;

-- Step 4: Set active_organization_id for any profile still missing it
UPDATE public.profiles p
SET active_organization_id = om.organization_id
FROM public.organization_members om
WHERE om.user_id = p.id
AND p.active_organization_id IS NULL;
