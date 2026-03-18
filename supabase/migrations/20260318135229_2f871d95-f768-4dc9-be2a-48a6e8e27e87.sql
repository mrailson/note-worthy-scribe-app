-- Allow anonymous users to read active surveys (needed for public survey submission RLS checks)
CREATE POLICY "Anon users can view active surveys"
ON public.surveys
FOR SELECT
TO anon
USING (status = 'active');