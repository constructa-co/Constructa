-- 1. Add active_organization_id to Profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES public.organizations(id);

-- 2. Update New User Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  full_name_val TEXT;
BEGIN
  -- Extract full name from metadata
  full_name_val := new.raw_user_meta_data->>'full_name';

  -- 1. Create Profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, full_name_val);

  -- 2. Create Default Organization
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(full_name_val, split_part(new.email, '@', 1)) || '''s Team')
  RETURNING id INTO new_org_id;

  -- 3. Add user as Owner
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, new.id, 'Owner');

  -- 4. Set active organization for user
  UPDATE public.profiles SET active_organization_id = new_org_id WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
