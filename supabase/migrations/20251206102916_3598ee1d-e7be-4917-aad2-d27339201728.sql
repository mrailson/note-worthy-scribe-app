-- Drop overly permissive 'System can manage/update' policies and replace with service_role only
-- These policies had qual:true and roles:{public} which bypassed RLS

-- live_meeting_notes_versions: Drop and recreate with service_role
DROP POLICY IF EXISTS "System can manage live meeting note versions" ON public.live_meeting_notes_versions;
CREATE POLICY "Service role can manage live meeting note versions" 
ON public.live_meeting_notes_versions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- meeting_auto_notes: Drop and recreate with service_role  
DROP POLICY IF EXISTS "System can manage auto notes" ON public.meeting_auto_notes;
CREATE POLICY "Service role can manage auto notes" 
ON public.meeting_auto_notes 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- meeting_notes_multi: Drop INSERT and UPDATE policies, recreate with service_role
DROP POLICY IF EXISTS "System can insert meeting notes" ON public.meeting_notes_multi;
DROP POLICY IF EXISTS "System can update meeting notes" ON public.meeting_notes_multi;
CREATE POLICY "Service role can insert meeting notes" 
ON public.meeting_notes_multi 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update meeting notes" 
ON public.meeting_notes_multi 
FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

-- transcript_cleaning_jobs: Drop INSERT and UPDATE policies, recreate with service_role
DROP POLICY IF EXISTS "System can insert transcript cleaning jobs" ON public.transcript_cleaning_jobs;
DROP POLICY IF EXISTS "System can update transcript cleaning jobs" ON public.transcript_cleaning_jobs;
CREATE POLICY "Service role can insert transcript cleaning jobs" 
ON public.transcript_cleaning_jobs 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update transcript cleaning jobs" 
ON public.transcript_cleaning_jobs 
FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

-- transcript_cleaning_stats: Drop and recreate with service_role
DROP POLICY IF EXISTS "System can manage transcript cleaning stats" ON public.transcript_cleaning_stats;
CREATE POLICY "Service role can manage transcript cleaning stats" 
ON public.transcript_cleaning_stats 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);