-- Allow anonymous users to read practice branding info when an active survey references the practice
CREATE POLICY "Anyone can view practice branding for active surveys"
ON public.practice_details
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.practice_id = practice_details.id
    AND s.status = 'active'
    AND (s.show_practice_logo = true OR s.branding_level IS DISTINCT FROM 'none')
  )
);