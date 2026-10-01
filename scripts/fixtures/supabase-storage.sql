-- Minimal platform-managed Storage surface required by application migrations.
-- Supabase Storage creates these objects outside the application's migration
-- history; the postgres image alone does not include them.
CREATE SCHEMA storage;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  public boolean DEFAULT false
);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/')[:array_length(string_to_array(name, '/'), 1) - 1]
$$;
