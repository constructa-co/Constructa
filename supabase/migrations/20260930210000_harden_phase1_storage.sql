-- Phase 1 keeps deliberately public proposal images downloadable by URL, but
-- object creation and mutation must stay inside the authenticated user's path.
-- Later-release receipt/contract/reporting surfaces remain private and gated.

BEGIN;

UPDATE storage.buckets
   SET public = true,
       file_size_limit = 10485760,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id IN ('proposal-photos', 'logos');

UPDATE storage.buckets
   SET public = false,
       file_size_limit = 10485760,
       allowed_mime_types = ARRAY[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'image/webp'
       ]
 WHERE id = 'receipts';

DROP POLICY IF EXISTS "Auth Upload Logos" ON storage.objects;
DROP POLICY IF EXISTS "Public View Logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read proposal photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload proposal photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users Upload Receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone View Receipts" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users Delete Own Receipts" ON storage.objects;
DROP POLICY IF EXISTS proposal_photos_owner_insert ON storage.objects;
DROP POLICY IF EXISTS proposal_photos_owner_update ON storage.objects;
DROP POLICY IF EXISTS proposal_photos_owner_delete ON storage.objects;

CREATE POLICY proposal_photos_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proposal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY proposal_photos_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'proposal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'proposal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY proposal_photos_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'proposal-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
