-- Sprint 5 migrations

-- Add new profile columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS insurance_schedule jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_tc_overrides jsonb;

-- Fix profile RLS — add missing UPDATE policy
DROP POLICY IF EXISTS "update_self_profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "update_self_profile" ON public.profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Storage bucket for proposal photos
INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-photos', 'proposal-photos', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies for proposal-photos bucket
DROP POLICY IF EXISTS "Public read proposal photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload proposal photos" ON storage.objects;

CREATE POLICY "Public read proposal photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'proposal-photos');

CREATE POLICY "Auth upload proposal photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'proposal-photos' AND auth.role() = 'authenticated');
