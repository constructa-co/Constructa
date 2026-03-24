-- Bootstrap orgs for users who have none, wire up their existing data
-- Uses SECURITY DEFINER context via a function to bypass RLS on mom tables

CREATE OR REPLACE FUNCTION public._bootstrap_org_for_users()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  -- Set active_organization_id for any profile still missing it
  UPDATE public.profiles p
  SET active_organization_id = om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = p.id
  AND p.active_organization_id IS NULL;
END;
$$;

SELECT public._bootstrap_org_for_users();

DROP FUNCTION public._bootstrap_org_for_users();
