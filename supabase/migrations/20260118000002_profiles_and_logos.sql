-- 1. Create Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  bio_text TEXT, -- "About Us"
  usp_text TEXT, -- "Why Choose Us"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile" ON profiles
    FOR ALL USING (auth.uid() = user_id);

-- 2. Create Storage for Logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth Upload Logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Public View Logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'logos');
CREATE POLICY "Auth Update Logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
CREATE POLICY "Auth Delete Logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');
