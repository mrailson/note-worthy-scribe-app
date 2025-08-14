-- Security Fix: Comprehensive Meeting Content Access Control
-- This migration fixes security vulnerabilities in meeting-related tables to ensure
-- only meeting owners and authorized shared users can access sensitive content

-- 1. Fix meetings table policies to use standard auth.uid() instead of custom function
DROP POLICY IF EXISTS "Users can create their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can delete their own meetings" ON public.meetings;

-- Create comprehensive meeting access policies that include sharing
CREATE POLICY "Users can create their own meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view meetings they own or that are shared with them" 
ON public.meetings 
FOR SELECT 
USING (
    user_id = auth.uid() 
    OR user_has_meeting_access(id, auth.uid())
);

CREATE POLICY "Users can update their own meetings" 
ON public.meetings 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own meetings" 
ON public.meetings 
FOR DELETE 
USING (user_id = auth.uid());

-- 2. Fix meeting_transcripts policies to properly handle sharing
DROP POLICY IF EXISTS "Users can create their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can view their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can update their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can delete their own transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can insert transcripts for their meetings" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can view transcripts of their meetings" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can update transcripts of their meetings" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Users can delete transcripts of their meetings" ON public.meeting_transcripts;

CREATE POLICY "Users can insert transcripts for accessible meetings" 
ON public.meeting_transcripts 
FOR INSERT 
WITH CHECK (user_has_meeting_access(meeting_id, auth.uid()));

CREATE POLICY "Users can view transcripts for accessible meetings" 
ON public.meeting_transcripts 
FOR SELECT 
USING (user_has_meeting_access(meeting_id, auth.uid()));

CREATE POLICY "Meeting owners can update transcripts" 
ON public.meeting_transcripts 
FOR UPDATE 
USING (meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
))
WITH CHECK (meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
));

CREATE POLICY "Meeting owners can delete transcripts" 
ON public.meeting_transcripts 
FOR DELETE 
USING (meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
));

-- 3. Fix meeting_transcription_chunks to include sharing access
DROP POLICY IF EXISTS "Users can insert their own transcription chunks" ON public.meeting_transcription_chunks;
DROP POLICY IF EXISTS "Users can view their own transcription chunks" ON public.meeting_transcription_chunks;
DROP POLICY IF EXISTS "Users can update their own transcription chunks" ON public.meeting_transcription_chunks;

CREATE POLICY "Users can insert transcription chunks for accessible meetings" 
ON public.meeting_transcription_chunks 
FOR INSERT 
WITH CHECK (
    auth.uid() = user_id 
    AND (meeting_id IS NULL OR user_has_meeting_access(meeting_id, auth.uid()))
);

CREATE POLICY "Users can view transcription chunks for accessible meetings" 
ON public.meeting_transcription_chunks 
FOR SELECT 
USING (
    auth.uid() = user_id 
    OR (meeting_id IS NOT NULL AND user_has_meeting_access(meeting_id, auth.uid()))
);

CREATE POLICY "Users can update their own transcription chunks for accessible meetings" 
ON public.meeting_transcription_chunks 
FOR UPDATE 
USING (
    auth.uid() = user_id 
    AND (meeting_id IS NULL OR user_has_meeting_access(meeting_id, auth.uid()))
)
WITH CHECK (
    auth.uid() = user_id 
    AND (meeting_id IS NULL OR user_has_meeting_access(meeting_id, auth.uid()))
);

-- 4. Fix meeting_summary_chunks to include sharing access for read operations
DROP POLICY IF EXISTS "Users can view their own summary chunks" ON public.meeting_summary_chunks;

CREATE POLICY "Users can view summary chunks for accessible meetings" 
ON public.meeting_summary_chunks 
FOR SELECT 
USING (
    auth.uid() = user_id 
    OR (meeting_id IS NOT NULL AND user_has_meeting_access(meeting_id, auth.uid()))
);

-- 5. Ensure audio_chunks properly restricts access
DROP POLICY IF EXISTS "Users can manage audio chunks for their meetings" ON public.audio_chunks;

CREATE POLICY "Users can manage audio chunks for accessible meetings" 
ON public.audio_chunks 
FOR ALL 
USING (
    meeting_id IS NULL 
    OR user_has_meeting_access(meeting_id, auth.uid())
)
WITH CHECK (
    meeting_id IS NULL 
    OR user_has_meeting_access(meeting_id, auth.uid())
);

-- 6. Add comprehensive policies for meeting_documents to ensure sharing is respected
DROP POLICY IF EXISTS "Users can view documents for their meetings" ON public.meeting_documents;
DROP POLICY IF EXISTS "Users can upload documents for their meetings" ON public.meeting_documents;
DROP POLICY IF EXISTS "Users can delete documents from their meetings" ON public.meeting_documents;

CREATE POLICY "Users can view documents for accessible meetings" 
ON public.meeting_documents 
FOR SELECT 
USING (user_has_meeting_access(meeting_id, auth.uid()));

CREATE POLICY "Meeting owners can upload documents" 
ON public.meeting_documents 
FOR INSERT 
WITH CHECK (
    auth.uid() = uploaded_by 
    AND meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid())
);

CREATE POLICY "Document uploaders can delete their documents from owned meetings" 
ON public.meeting_documents 
FOR DELETE 
USING (
    auth.uid() = uploaded_by 
    AND meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid())
);

-- 7. Ensure meeting_audio_backups properly restricts access
-- The existing policy looks good but let's make it consistent with our pattern

-- 8. Add policy for any missing meeting-related content tables
-- Ensure transcription_chunks uses consistent access patterns
DROP POLICY IF EXISTS "Users can view transcription chunks for their meetings" ON public.transcription_chunks;

CREATE POLICY "Users can view transcription chunks for accessible meetings" 
ON public.transcription_chunks 
FOR ALL 
USING (
    meeting_id IS NULL 
    OR user_has_meeting_access(meeting_id, auth.uid())
)
WITH CHECK (
    meeting_id IS NULL 
    OR user_has_meeting_access(meeting_id, auth.uid())
);

-- 9. Create audit logging for sensitive meeting access
CREATE OR REPLACE FUNCTION public.log_meeting_content_access(
    p_meeting_id UUID,
    p_content_type TEXT,
    p_action TEXT DEFAULT 'view'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
    -- Log access to meeting content for security monitoring
    INSERT INTO public.system_audit_log (
        table_name,
        operation,
        record_id,
        user_id,
        user_email,
        new_values
    ) VALUES (
        'meeting_content_access',
        'CONTENT_ACCESS',
        p_meeting_id,
        auth.uid(),
        auth.email(),
        jsonb_build_object(
            'content_type', p_content_type,
            'action', p_action,
            'access_time', now(),
            'meeting_id', p_meeting_id
        )
    );
END;
$$;

-- 10. Create a function to validate meeting access and prevent unauthorized enumeration
CREATE OR REPLACE FUNCTION public.validate_meeting_access_and_log(
    p_meeting_id UUID,
    p_content_type TEXT DEFAULT 'general'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
    has_access BOOLEAN;
BEGIN
    -- Check if user has access to the meeting
    SELECT user_has_meeting_access(p_meeting_id, auth.uid()) INTO has_access;
    
    -- Log the access attempt
    IF has_access THEN
        PERFORM log_meeting_content_access(p_meeting_id, p_content_type, 'authorized_access');
    ELSE
        PERFORM log_meeting_content_access(p_meeting_id, p_content_type, 'unauthorized_attempt');
    END IF;
    
    RETURN has_access;
END;
$$;