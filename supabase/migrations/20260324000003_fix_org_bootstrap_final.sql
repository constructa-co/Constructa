-- Final bootstrap: create orgs for existing users who have none

ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  rec RECORD;
  new_org_id UUID;
BEGIN
  FOR rec IN SELECT id, full_name, email FROM public.profiles
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = rec.id) THEN

      INSERT INTO public.organizations (name)
      VALUES (COALESCE(rec.full_name, split_part(rec.email, '@', 1)) || '''s Team')
      RETURNING id INTO new_org_id;

      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (new_org_id, rec.id, 'Owner');

      UPDATE public.projects
        SET organization_id = new_org_id
        WHERE user_id = rec.id AND organization_id IS NULL;

      UPDATE public.profiles
        SET active_organization_id = new_org_id
        WHERE id = rec.id AND active_organization_id IS NULL;

    END IF;
  END LOOP;
END $$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
