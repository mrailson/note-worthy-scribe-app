-- Fix public survey submission: allow inserting survey_answers without requiring SELECT access to survey_responses
-- Root cause: survey_responses INSERT succeeds, but survey_answers INSERT fails because its RLS policy joins survey_responses,
-- and normal respondents typically cannot SELECT survey_responses.

-- 1) Helper function that safely checks response -> active survey, without exposing row data
CREATE OR REPLACE FUNCTION public.can_submit_survey_answer(_response_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.survey_responses sr
    JOIN public.surveys s ON s.id = sr.survey_id
    WHERE sr.id = _response_id
      AND s.status = 'active'
      AND (s.start_date IS NULL OR s.start_date <= now())
      AND (s.end_date IS NULL OR (s.end_date + interval '1 day') >= now())
  );
$$;

REVOKE ALL ON FUNCTION public.can_submit_survey_answer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_submit_survey_answer(uuid) TO anon, authenticated;

-- 2) Replace the insert policy for survey_answers to use the function
DROP POLICY IF EXISTS "Anyone can submit answers with responses" ON public.survey_answers;

CREATE POLICY "Anyone can submit answers with responses"
ON public.survey_answers
FOR INSERT
TO anon, authenticated
WITH CHECK (public.can_submit_survey_answer(response_id));
