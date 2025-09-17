-- Complete Function Search Path Security Fix
-- Fix remaining functions missing SET search_path parameter

-- Fix trigger_auto_meeting_notes() - this is likely missing
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
    transcript_count INTEGER := 0;
    batch_uuid UUID;
    existing_notes_count INTEGER := 0;
BEGIN
    -- Only proceed if status changed TO 'completed' from a different status
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        
        -- Check if notes already exist to prevent duplicates
        SELECT COUNT(*) INTO existing_notes_count
        FROM public.meeting_summaries 
        WHERE meeting_id = NEW.id;
        
        -- Skip if notes already exist
        IF existing_notes_count > 0 THEN
            RAISE LOG 'Notes already exist for meeting %, skipping trigger', NEW.id;
            RETURN NEW;
        END IF;
        
        -- Check if meeting has transcript content from any source
        SELECT COUNT(*) INTO transcript_count
        FROM public.meeting_transcription_chunks mtc
        WHERE mtc.meeting_id = NEW.id 
        AND mtc.transcription_text IS NOT NULL 
        AND LENGTH(TRIM(mtc.transcription_text)) > 0;
        
        -- Also check legacy transcript tables if no chunks found
        IF transcript_count = 0 THEN
            SELECT COUNT(*) INTO transcript_count
            FROM public.meeting_transcripts mt
            WHERE mt.meeting_id = NEW.id 
            AND mt.content IS NOT NULL 
            AND LENGTH(TRIM(mt.content)) > 0;
        END IF;
        
        -- Also check legacy transcription_chunks table
        IF transcript_count = 0 THEN
            SELECT COUNT(*) INTO transcript_count
            FROM public.transcription_chunks tc
            WHERE tc.meeting_id = NEW.id 
            AND tc.transcript_text IS NOT NULL 
            AND LENGTH(TRIM(tc.transcript_text)) > 0;
        END IF;
        
        -- Only trigger if we have transcript content
        IF transcript_count > 0 THEN
            -- Set notes generation status
            NEW.notes_generation_status = 'queued';
            
            -- Generate batch ID for detailed notes
            batch_uuid := gen_random_uuid();
            
            -- Queue DETAILED notes generation (changed from 'standard' to 'detailed')
            INSERT INTO public.meeting_notes_queue (meeting_id, status, note_type, batch_id, detail_level)
            VALUES (NEW.id, 'pending', 'detailed', batch_uuid, 'detailed')
            ON CONFLICT (meeting_id, note_type) 
            DO UPDATE SET 
                status = 'pending',
                batch_id = batch_uuid,
                updated_at = now(),
                retry_count = 0,
                error_message = NULL;
            
            -- Use pg_notify to trigger detailed notes generation
            PERFORM pg_notify('auto_generate_detailed_notes', json_build_object(
                'meeting_id', NEW.id,
                'batch_id', batch_uuid,
                'note_type', 'detailed',
                'delay_seconds', 3
            )::text);
            
            RAISE LOG 'Triggered auto DETAILED notes generation for meeting: % with batch: %', NEW.id, batch_uuid;
        ELSE
            RAISE LOG 'No transcript content found for meeting: %, skipping notes generation', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fix get_user_modules function
CREATE OR REPLACE FUNCTION public.get_user_modules(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(module app_module, granted_at timestamp with time zone, granted_by uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT um.module, um.granted_at, um.granted_by
  FROM public.user_modules um
  WHERE um.user_id = p_user_id
    AND um.enabled = true
  ORDER BY um.granted_at DESC;
$function$;

-- Fix get_security_setting function
CREATE OR REPLACE FUNCTION public.get_security_setting(setting_name text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT setting_value 
  FROM public.security_settings 
  WHERE setting_name = $1 AND is_active = true
  LIMIT 1;
$function$;

-- Fix is_session_valid function
CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  session_timeout_minutes INTEGER;
  last_activity_time TIMESTAMP WITH TIME ZONE;
  is_active_session BOOLEAN;
BEGIN
  -- Get session timeout setting
  session_timeout_minutes := get_security_setting('session_timeout_minutes')::INTEGER;
  
  -- Check if session exists and is active
  SELECT 
    us.last_activity,
    us.is_active
  INTO 
    last_activity_time,
    is_active_session
  FROM public.user_sessions us
  WHERE us.session_id = p_session_id;
  
  -- Return false if session not found or inactive
  IF last_activity_time IS NULL OR NOT is_active_session THEN
    RETURN false;
  END IF;
  
  -- Check if session has timed out
  IF last_activity_time < (NOW() - (session_timeout_minutes || ' minutes')::INTERVAL) THEN
    -- Mark session as inactive
    UPDATE public.user_sessions 
    SET is_active = false, 
        logout_time = NOW(),
        logout_reason = 'timeout'
    WHERE session_id = p_session_id;
    
    RETURN false;
  END IF;
  
  -- Update last activity
  UPDATE public.user_sessions 
  SET last_activity = NOW()
  WHERE session_id = p_session_id;
  
  RETURN true;
END;
$function$;

-- Fix get_user_practice_assignments function
CREATE OR REPLACE FUNCTION public.get_user_practice_assignments(p_user_id uuid)
 RETURNS TABLE(practice_id uuid, practice_name text, role app_role, assigned_at timestamp with time zone, assigned_by uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT 
    ur.practice_id,
    COALESCE(pd.practice_name, gp.name) as practice_name,
    ur.role,
    ur.assigned_at,
    ur.assigned_by
  FROM public.user_roles ur
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  LEFT JOIN public.gp_practices gp ON ur.practice_id = gp.id
  WHERE ur.user_id = p_user_id
  ORDER BY ur.assigned_at DESC;
$function$;

-- Fix remove_user_from_practice function  
CREATE OR REPLACE FUNCTION public.remove_user_from_practice(p_user_id uuid, p_practice_id uuid, p_role app_role DEFAULT NULL::app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- CRITICAL: Never remove system_admin roles
  IF p_role = 'system_admin' OR (p_role IS NULL AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id 
    AND practice_id = p_practice_id 
    AND role = 'system_admin'
  )) THEN
    -- Log the blocked attempt
    PERFORM public.log_system_activity(
      'user_roles',
      'BLOCKED_SYSTEM_ADMIN_REMOVAL',
      p_user_id,
      jsonb_build_object(
        'practice_id', p_practice_id,
        'attempted_role', p_role,
        'blocked_by', 'system_protection',
        'blocked_at', now()
      ),
      NULL
    );
    
    RAISE EXCEPTION 'Cannot remove system_admin roles. System administrators are protected.';
  END IF;

  -- If role specified, remove specific role assignment (but never system_admin)
  IF p_role IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id 
      AND practice_id = p_practice_id 
      AND role = p_role
      AND role != 'system_admin'; -- Extra protection
  ELSE
    -- Remove all role assignments for this practice (but never system_admin)
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id 
      AND practice_id = p_practice_id
      AND role != 'system_admin'; -- Extra protection
  END IF;

  -- Log the removal
  PERFORM public.log_system_activity(
    'user_roles',
    'PRACTICE_ASSIGNMENT_REMOVED',
    p_user_id,
    jsonb_build_object(
      'practice_id', p_practice_id,
      'role', p_role,
      'removed_by', auth.uid()
    ),
    NULL
  );

  RETURN FOUND;
END;
$function$;

-- Fix get_users_with_practices function
CREATE OR REPLACE FUNCTION public.get_users_with_practices()
 RETURNS TABLE(user_id uuid, email text, full_name text, last_login timestamp with time zone, practice_assignments jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT 
    p.user_id,
    p.email,
    p.full_name,
    p.last_login,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'practice_id', ur.practice_id,
          'practice_name', COALESCE(pd.practice_name, gp.name),
          'role', ur.role,
          'assigned_at', ur.assigned_at
        )
      ) FILTER (WHERE ur.practice_id IS NOT NULL),
      '[]'::jsonb
    ) as practice_assignments
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  LEFT JOIN public.gp_practices gp ON ur.practice_id = gp.id
  GROUP BY p.user_id, p.email, p.full_name, p.last_login
  ORDER BY p.full_name;
$function$;

-- Fix assign_user_to_practice function
CREATE OR REPLACE FUNCTION public.assign_user_to_practice(p_user_id uuid, p_practice_id uuid, p_role app_role, p_assigned_by uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  role_id UUID;
BEGIN
  -- Check if assignment already exists
  SELECT id INTO role_id
  FROM public.user_roles
  WHERE user_id = p_user_id 
    AND practice_id = p_practice_id 
    AND role = p_role;

  -- If not exists, create new assignment
  IF role_id IS NULL THEN
    INSERT INTO public.user_roles (user_id, practice_id, role, assigned_by)
    VALUES (p_user_id, p_practice_id, p_role, p_assigned_by)
    RETURNING id INTO role_id;
    
    -- Log the assignment
    PERFORM public.log_system_activity(
      'user_roles',
      'PRACTICE_ASSIGNMENT',
      p_user_id,
      NULL,
      jsonb_build_object(
        'practice_id', p_practice_id,
        'role', p_role,
        'assigned_by', p_assigned_by
      )
    );
  END IF;

  RETURN role_id;
END;
$function$;