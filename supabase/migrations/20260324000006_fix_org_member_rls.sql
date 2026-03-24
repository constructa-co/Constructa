-- Fix circular RLS on organization_members.
-- Old policy used get_my_organizations() which reads organization_members itself — deadlock.
-- Replace with a direct user_id = auth.uid() check.

DROP POLICY IF EXISTS "org_member_select" ON public.organization_members;
DROP POLICY IF EXISTS "org_member_select_own" ON public.organization_members;
DROP POLICY IF EXISTS "org_member_insert_owner" ON public.organization_members;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;

-- Users can always read their own membership rows
CREATE POLICY "org_member_select_own" ON public.organization_members
FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own membership (needed for org bootstrap)
CREATE POLICY "org_member_insert_owner" ON public.organization_members
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can insert their own profile row
CREATE POLICY "profiles_insert_self" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());
