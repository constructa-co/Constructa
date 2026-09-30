#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="$(pg_config --bindir)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/constructa-storage-policy.XXXXXX")"
PORT="${CONSTRUCTA_STORAGE_TEST_PG_PORT:-55454}"

cleanup() {
  if [[ -f "$TEST_DIR/data/postmaster.pid" ]]; then
    "$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$TEST_DIR/data" --auth=trust --no-locale >/dev/null
"$PG_BIN/pg_ctl" -D "$TEST_DIR/data" -l "$TEST_DIR/postgres.log" \
  -o "-p $PORT -k $TEST_DIR" start >/dev/null

PSQL=("$PG_BIN/psql" -X -v ON_ERROR_STOP=1 -h "$TEST_DIR" -p "$PORT" -d postgres)

"${PSQL[@]}" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL
);
CREATE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT (string_to_array(name, '/'))[
    1:array_length(string_to_array(name, '/'), 1) - 1
  ]
$$;

GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read proposal photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'proposal-photos');
CREATE POLICY "Auth upload proposal photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'proposal-photos');
CREATE POLICY "Anyone View Receipts" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "Auth Users Upload Receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');

INSERT INTO storage.buckets (id, public) VALUES
  ('proposal-photos', true),
  ('logos', true),
  ('receipts', true);
SQL

"${PSQL[@]}" \
  -f "$ROOT_DIR/supabase/migrations/20260930210000_harden_phase1_storage.sql" \
  >/dev/null

"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
     WHERE id = 'proposal-photos'
       AND public
       AND file_size_limit = 10485760
       AND allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
  ) THEN
    RAISE EXCEPTION 'Proposal image bucket constraints were not applied.';
  END IF;

  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'receipts' AND public) THEN
    RAISE EXCEPTION 'Receipt bucket is still public.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND policyname IN ('Public read proposal photos', 'Anyone View Receipts')
  ) THEN
    RAISE EXCEPTION 'Broad public object-list policy remains.';
  END IF;
END;
$$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
INSERT INTO storage.objects (bucket_id, name)
VALUES ('proposal-photos', '00000000-0000-0000-0000-000000000001/branding/logo.png');
RESET ROLE;
SQL

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
INSERT INTO storage.objects (bucket_id, name)
VALUES ('proposal-photos', '00000000-0000-0000-0000-000000000002/branding/logo.png');
SQL
then
  echo "storage-policy-suite: cross-tenant image insert unexpectedly succeeded" >&2
  exit 1
fi

if "${PSQL[@]}" <<'SQL' >/dev/null 2>&1
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
INSERT INTO storage.objects (bucket_id, name)
VALUES ('receipts', '00000000-0000-0000-0000-000000000001/receipt.pdf');
SQL
then
  echo "storage-policy-suite: gated receipt upload unexpectedly succeeded" >&2
  exit 1
fi

echo "storage-policy-suite: pass"
