-- Allow public read access to anonymized feedback data
CREATE POLICY "Public can view anonymized feedback results"
ON public.practice_manager_feedback
FOR SELECT
TO public
USING (true);

-- Add helpful comment
COMMENT ON POLICY "Public can view anonymized feedback results" ON public.practice_manager_feedback 
IS 'Allows public viewing of feedback for aggregate statistics and anonymous comments display';