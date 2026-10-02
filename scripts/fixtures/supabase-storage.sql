-- Minimal platform-managed Storage surface required by application migrations.
-- Supabase Storage creates these objects outside the application's migration
-- history; the postgres image alone does not include them.
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $bootstrap$
BEGIN
  IF to_regprocedure('storage.foldername(text)') IS NULL THEN
    EXECUTE $function$
      CREATE FUNCTION storage.foldername(name text)
      RETURNS text[]
      LANGUAGE sql
      IMMUTABLE
      AS 'SELECT (string_to_array(name, ''/''))[1:array_length(string_to_array(name, ''/''), 1) - 1]'
    $function$;
  END IF;
END
$bootstrap$;
