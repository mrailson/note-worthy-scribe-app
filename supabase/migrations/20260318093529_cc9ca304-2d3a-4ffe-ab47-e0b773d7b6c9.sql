-- Allow users with document_signoff_access to view profiles
-- for users in NRES/PML/ICB practices (for the Notewell directory)
CREATE POLICY "Document signoff users can view directory profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_document_signoff_access()
  AND user_id IN (
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.gp_practices gp ON gp.id = ur.practice_id
    WHERE gp.organisation_type IN ('Management', 'ICB')
    OR (
      gp.organisation_type = 'Practice'
      AND (
        gp.name ILIKE '%parks%'
        OR gp.name ILIKE '%brackley%'
        OR gp.name ILIKE '%springfield%'
        OR gp.name ILIKE '%towcester%'
        OR gp.name ILIKE '%bugbrooke%'
        OR gp.name ILIKE '%brook health%'
        OR gp.name ILIKE '%denton%'
      )
    )
  )
);