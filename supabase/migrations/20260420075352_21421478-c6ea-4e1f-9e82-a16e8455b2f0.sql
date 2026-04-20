-- ============================================================================
-- Recordings Bucket — Owner-based RLS (Option A)
-- ============================================================================
-- Closes Security Finding #2: previously any authed user could read any
-- recording in the bucket. After this migration, only the uploader (owner)
-- can SELECT/INSERT/UPDATE/DELETE their own audio objects.
--
-- Server-side edge functions (standalone-whisper, transcribe-offline-meeting,
-- auto-generate-meeting-notes, consolidate-meeting-chunks, etc.) use the
-- service-role key which bypasses RLS, so the audio processing pipeline is
-- unaffected.
--
-- Audit on 2026-04-20: 180 objects in bucket, all with owner populated,
-- all owned by authenticated users. Safe to apply.
-- ============================================================================

-- 1. Drop any existing recordings-bucket policies on storage.objects so we
--    start from a known clean state. (Names below match whatever may have
--    been created historically; IF EXISTS is safe.)
DROP POLICY IF EXISTS "Recordings: authenticated read"          ON storage.objects;
DROP POLICY IF EXISTS "Recordings: authenticated insert"        ON storage.objects;
DROP POLICY IF EXISTS "Recordings: authenticated update"        ON storage.objects;
DROP POLICY IF EXISTS "Recordings: authenticated delete"        ON storage.objects;
DROP POLICY IF EXISTS "Recordings: public read"                 ON storage.objects;
DROP POLICY IF EXISTS "Users can upload recordings"             ON storage.objects;
DROP POLICY IF EXISTS "Users can read recordings"               ON storage.objects;
DROP POLICY IF EXISTS "Users can update recordings"             ON storage.objects;
DROP POLICY IF EXISTS "Users can delete recordings"             ON storage.objects;
DROP POLICY IF EXISTS "Recordings owner select"                 ON storage.objects;
DROP POLICY IF EXISTS "Recordings owner insert"                 ON storage.objects;
DROP POLICY IF EXISTS "Recordings owner update"                 ON storage.objects;
DROP POLICY IF EXISTS "Recordings owner delete"                 ON storage.objects;

-- 2. Make sure the bucket is private (not publicly listable / downloadable
--    by anonymous URL). Service-role and signed URLs still work.
UPDATE storage.buckets
SET public = false
WHERE id = 'recordings';

-- 3. Owner-based policies. `owner` is set automatically by Supabase Storage
--    on upload to the uploading user's auth.uid().
CREATE POLICY "Recordings owner select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'recordings'
  AND owner = auth.uid()
);

CREATE POLICY "Recordings owner insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'recordings'
  AND owner = auth.uid()
);

CREATE POLICY "Recordings owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'recordings'
  AND owner = auth.uid()
);

CREATE POLICY "Recordings owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'recordings'
  AND owner = auth.uid()
);

-- ============================================================================
-- ROLLBACK (emergency only — restores previous wide-open access)
-- ============================================================================
-- Uncomment the block below and run it as a separate migration if you need
-- to revert. NOTE: this re-opens the security hole — only use if a critical
-- workflow breaks and you need a temporary restore window.
--
-- DROP POLICY IF EXISTS "Recordings owner select" ON storage.objects;
-- DROP POLICY IF EXISTS "Recordings owner insert" ON storage.objects;
-- DROP POLICY IF EXISTS "Recordings owner update" ON storage.objects;
-- DROP POLICY IF EXISTS "Recordings owner delete" ON storage.objects;
--
-- CREATE POLICY "Recordings: authenticated read"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'recordings');
--
-- CREATE POLICY "Recordings: authenticated insert"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'recordings');
-- ============================================================================