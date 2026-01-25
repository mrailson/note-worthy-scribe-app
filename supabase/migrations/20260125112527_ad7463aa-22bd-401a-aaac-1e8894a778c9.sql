-- Drop existing policies and recreate with fixed date logic
DROP POLICY IF EXISTS "Anyone can submit responses to active surveys" ON public.survey_responses;
DROP POLICY IF EXISTS "Anyone can submit answers with responses" ON public.survey_answers;

-- Recreate survey_responses INSERT policy with corrected end_date logic
CREATE POLICY "Anyone can submit responses to active surveys"
ON public.survey_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
    AND s.status = 'active'
    AND (s.start_date IS NULL OR s.start_date <= now())
    AND (s.end_date IS NULL OR (s.end_date + interval '1 day') >= now())
  )
);

-- Recreate survey_answers INSERT policy
CREATE POLICY "Anyone can submit answers with responses"
ON public.survey_answers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.survey_responses sr
    JOIN public.surveys s ON s.id = sr.survey_id
    WHERE sr.id = response_id
    AND s.status = 'active'
  )
);