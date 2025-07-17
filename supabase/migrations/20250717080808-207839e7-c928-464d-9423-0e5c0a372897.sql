-- Create security definer functions to avoid infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can create their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON public.meetings;

DROP POLICY IF EXISTS "Users can view their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can create their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can update their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can delete their own transcripts" ON public.meeting_transcripts;

DROP POLICY IF EXISTS "Users can view their own summaries" ON public.meeting_summaries;
DROP POLICY IF EXISTS "Users can create their own summaries" ON public.meeting_summaries;
DROP POLICY IF EXISTS "Users can update their own summaries" ON public.meeting_summaries;
DROP POLICY IF EXISTS "Users can delete their own summaries" ON public.meeting_summaries;

-- Create new policies using security definer function
CREATE POLICY "Users can view their own meetings" 
ON public.meetings 
FOR SELECT 
USING (user_id = public.get_current_user_id());

CREATE POLICY "Users can create their own meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (user_id = public.get_current_user_id());

CREATE POLICY "Users can update their own meetings" 
ON public.meetings 
FOR UPDATE 
USING (user_id = public.get_current_user_id());

CREATE POLICY "Users can delete their own meetings" 
ON public.meetings 
FOR DELETE 
USING (user_id = public.get_current_user_id());

-- Policies for meeting_transcripts
CREATE POLICY "Users can view their own transcripts" 
ON public.meeting_transcripts 
FOR SELECT 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

CREATE POLICY "Users can create their own transcripts" 
ON public.meeting_transcripts 
FOR INSERT 
WITH CHECK (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

CREATE POLICY "Users can update their own transcripts" 
ON public.meeting_transcripts 
FOR UPDATE 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

CREATE POLICY "Users can delete their own transcripts" 
ON public.meeting_transcripts 
FOR DELETE 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

-- Policies for meeting_summaries
CREATE POLICY "Users can view their own summaries" 
ON public.meeting_summaries 
FOR SELECT 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

CREATE POLICY "Users can create their own summaries" 
ON public.meeting_summaries 
FOR INSERT 
WITH CHECK (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

CREATE POLICY "Users can update their own summaries" 
ON public.meeting_summaries 
FOR UPDATE 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));

CREATE POLICY "Users can delete their own summaries" 
ON public.meeting_summaries 
FOR DELETE 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = public.get_current_user_id()
));