-- Fix: Remove end_date/start_date checks from INSERT policies too
-- The 'status' field is the sole authority for survey availability.

-- Fix survey_responses INSERT policy
DROP POLICY IF EXISTS "Anyone can submit responses to active surveys" ON public.survey_responses;

CREATE POLICY "Anyone can submit responses to active surveys"
ON public.survey_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_responses.survey_id
    AND s.status = 'active'
  )
);