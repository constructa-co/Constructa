-- Final RLS fix for profiles — ensure all three policies exist cleanly
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_self_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_self_profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;

CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
