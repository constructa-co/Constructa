-- Close the organization self-membership escalation identified in issue #48.
-- Signup bootstrap remains trigger-only. Cohort users cannot add themselves to
-- another organization, and team invitations remain outside the Phase 1 launch.

BEGIN;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_member_insert_owner"
  ON public.organization_members;

REVOKE INSERT, UPDATE, DELETE
  ON public.organization_members
  FROM anon, authenticated;

GRANT SELECT
  ON public.organization_members
  TO authenticated;

GRANT ALL
  ON public.organization_members
  TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_org_id uuid;
  full_name_val text;
BEGIN
  full_name_val := NEW.raw_user_meta_data->>'full_name';

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, full_name_val);

  INSERT INTO public.organizations (name)
  VALUES (
    COALESCE(NULLIF(full_name_val, ''), split_part(NEW.email, '@', 1))
      || '''s Team'
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'Owner');

  UPDATE public.profiles
     SET active_organization_id = new_org_id
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT membership.organization_id
    FROM public.organization_members AS membership
   WHERE membership.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_organizations()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organizations()
  TO authenticated, service_role;

COMMIT;
