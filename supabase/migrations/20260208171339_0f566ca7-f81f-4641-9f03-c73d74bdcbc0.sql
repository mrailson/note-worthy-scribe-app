-- Fix: Remove end_date/start_date checks from public-facing RLS policies
-- The 'status' field is the authoritative control for survey availability.
-- If an admin keeps a survey 'active' past its end_date, it should remain accessible.

-- Drop the existing overly-restrictive policies
DROP POLICY IF EXISTS "Public can view active surveys by token" ON public.surveys;
DROP POLICY IF EXISTS "Authenticated users can view active public surveys" ON public.surveys;
DROP POLICY IF EXISTS "Public can view questions for active surveys" ON public.survey_questions;
DROP POLICY IF EXISTS "Authenticated can view questions for active surveys" ON public.survey_questions;

-- Recreate: anon can view active surveys (no date restriction)
CREATE POLICY "Public can view active surveys by token"
ON public.surveys
FOR SELECT
TO anon
USING (status = 'active');

-- Recreate: authenticated can view active public surveys (no date restriction)
CREATE POLICY "Authenticated users can view active public surveys"
ON public.surveys
FOR SELECT
TO authenticated
USING (status = 'active');

-- Recreate: anon can view questions for active surveys
CREATE POLICY "Public can view questions for active surveys"
ON public.survey_questions
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_questions.survey_id
    AND s.status = 'active'
  )
);

-- Recreate: authenticated can view questions for active surveys
CREATE POLICY "Authenticated can view questions for active surveys"
ON public.survey_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM surveys s
    WHERE s.id = survey_questions.survey_id
    AND s.status = 'active'
  )
);