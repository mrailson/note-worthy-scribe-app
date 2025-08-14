-- Fix the remaining contractor_competencies table security issue

-- Enable RLS on contractor_competencies table
ALTER TABLE public.contractor_competencies ENABLE ROW LEVEL SECURITY;

-- Add secure policies for contractor_competencies
CREATE POLICY "Authorized users can view contractor competencies" 
ON public.contractor_competencies 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "System can manage contractor competencies" 
ON public.contractor_competencies 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Fix any remaining function search path issues by updating key functions
CREATE OR REPLACE FUNCTION public.validate_meeting_access_and_log(p_meeting_id uuid, p_content_type text DEFAULT 'general'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

CREATE OR REPLACE FUNCTION public.log_meeting_content_access(p_meeting_id uuid, p_content_type text, p_action text DEFAULT 'view'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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