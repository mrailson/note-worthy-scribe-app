-- Add branding settings to surveys table
ALTER TABLE public.surveys 
ADD COLUMN IF NOT EXISTS show_practice_logo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS branding_level TEXT DEFAULT 'none' 
  CHECK (branding_level IN ('none', 'name', 'name_address', 'full'));

-- Fix the RLS policy for public survey access - the end_date should include the full day
-- Drop the old policy first
DROP POLICY IF EXISTS "Public can view active surveys by token" ON public.surveys;

-- Create new policy with fixed date comparison (end of day)
CREATE POLICY "Public can view active surveys by token"
ON public.surveys FOR SELECT
TO anon
USING (
  status = 'active'
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR (end_date + interval '1 day') >= now())
);

-- Also allow authenticated users to view public surveys (when visiting the public URL)
DROP POLICY IF EXISTS "Authenticated users can view active public surveys" ON public.surveys;
CREATE POLICY "Authenticated users can view active public surveys"
ON public.surveys FOR SELECT
TO authenticated
USING (
  status = 'active'
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR (end_date + interval '1 day') >= now())
);

-- Add public access to survey_questions for authenticated users viewing public surveys
DROP POLICY IF EXISTS "Authenticated can view questions for active surveys" ON public.survey_questions;
CREATE POLICY "Authenticated can view questions for active surveys"
ON public.survey_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
      AND s.status = 'active'
      AND (s.start_date IS NULL OR s.start_date <= now())
      AND (s.end_date IS NULL OR (s.end_date + interval '1 day') >= now())
  )
);

-- Fix the anon policy for questions too
DROP POLICY IF EXISTS "Public can view questions for active surveys" ON public.survey_questions;
CREATE POLICY "Public can view questions for active surveys"
ON public.survey_questions FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_id
      AND s.status = 'active'
      AND (s.start_date IS NULL OR s.start_date <= now())
      AND (s.end_date IS NULL OR (s.end_date + interval '1 day') >= now())
  )
);