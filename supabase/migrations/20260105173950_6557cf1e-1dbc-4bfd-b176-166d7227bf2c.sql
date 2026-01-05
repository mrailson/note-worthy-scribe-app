-- Fix RLS for complaint_investigation_transcripts INSERT (align with transcript visibility rules)

DROP POLICY IF EXISTS "Authorized users can create investigation transcripts" ON public.complaint_investigation_transcripts;

CREATE POLICY "Authorized users can create investigation transcripts"
ON public.complaint_investigation_transcripts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = transcribed_by
  AND complaint_id IN (
    SELECT c.id
    FROM public.complaints c
    WHERE (
      c.created_by = auth.uid()
      OR c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
      OR public.is_system_admin(auth.uid())
    )
  )
);
