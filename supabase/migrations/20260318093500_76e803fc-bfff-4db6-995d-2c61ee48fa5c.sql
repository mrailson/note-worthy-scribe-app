-- Allow users with document_signoff_access to view user_roles
-- for practices in the Notewell directory (NRES practices, PML, ICB)
CREATE OR REPLACE FUNCTION public.has_document_signoff_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND document_signoff_access = true
  )
$$;

CREATE POLICY "Document signoff users can view directory roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  has_document_signoff_access()
  AND practice_id IN (
    SELECT id FROM public.gp_practices
    WHERE organisation_type IN ('Management', 'ICB')
    OR (
      organisation_type = 'Practice'
      AND (
        name ILIKE '%parks%'
        OR name ILIKE '%brackley%'
        OR name ILIKE '%springfield%'
        OR name ILIKE '%towcester%'
        OR name ILIKE '%bugbrooke%'
        OR name ILIKE '%brook health%'
        OR name ILIKE '%denton%'
      )
    )
  )
);