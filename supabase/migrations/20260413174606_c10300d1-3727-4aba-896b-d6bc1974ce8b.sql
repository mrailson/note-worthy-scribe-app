
-- Drop overly permissive storage policies
DROP POLICY IF EXISTS "Authenticated users can read evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own evidence files" ON storage.objects;

-- Create scoped read policy: owner folder match, buyback access, or admin
CREATE POLICY "Authenticated users can read evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'nres-claim-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_nres_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.nres_claim_evidence e
      JOIN public.nres_buyback_claims c ON c.id = e.claim_id
      JOIN public.nres_buyback_access a ON a.practice_key = c.practice_key AND a.user_id = auth.uid()
      WHERE e.file_path = name
    )
  )
);

-- Create scoped delete policy: owner folder match or admin only
CREATE POLICY "Authenticated users can delete their own evidence files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'nres-claim-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_nres_admin(auth.uid())
  )
);
