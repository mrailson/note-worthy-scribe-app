-- Fix RLS for complaint_investigation_transcripts INSERT
-- Use complaint visibility (via complaints RLS) rather than duplicating access logic.

DROP POLICY IF EXISTS "Authorized users can create investigation transcripts" ON public.complaint_investigation_transcripts;

CREATE POLICY "Authorized users can create investigation transcripts"
ON public.complaint_investigation_transcripts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = transcribed_by
  AND EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_id
  )
);
