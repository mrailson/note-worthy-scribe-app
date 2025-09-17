-- Fix Function Search Path Security Issues
-- This migration adds SET search_path = 'public', 'pg_temp' to all functions missing this security control

-- 1. update_user_settings_updated_at()
CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. update_meeting_notes_multi_updated_at()
CREATE OR REPLACE FUNCTION public.update_meeting_notes_multi_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. update_translation_sessions_updated_at()
CREATE OR REPLACE FUNCTION public.update_translation_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4. safe_unaccent(input_text text)
CREATE OR REPLACE FUNCTION public.safe_unaccent(input_text text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT unaccent(input_text);
$function$;

-- 5. delay_seconds(seconds integer)
CREATE OR REPLACE FUNCTION public.delay_seconds(seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM pg_sleep(seconds);
END;
$function$;

-- 6. update_consultation_history_updated_at()
CREATE OR REPLACE FUNCTION public.update_consultation_history_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 7. get_current_user_role(check_user_id uuid DEFAULT auth.uid())
CREATE OR REPLACE FUNCTION public.get_current_user_role(check_user_id uuid DEFAULT auth.uid())
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT role FROM public.user_roles 
  WHERE user_id = check_user_id 
  AND role = 'system_admin'
  LIMIT 1;
$function$;

-- 8. has_role(_user_id uuid, _role app_role)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- 9. is_system_admin(_user_id uuid DEFAULT auth.uid())
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  )
$function$;

-- 10. trigger_delayed_notes_generation()
CREATE OR REPLACE FUNCTION public.trigger_delayed_notes_generation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- Simple notification without complex logic to avoid deadlocks
  PERFORM pg_notify('meeting_completed', NEW.id::text);
  RETURN NEW;
END;
$function$;

-- 11. safe_similarity(text1 text, text2 text)
CREATE OR REPLACE FUNCTION public.safe_similarity(text1 text, text2 text)
 RETURNS real
 LANGUAGE sql
 IMMUTABLE
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT similarity(text1, text2);
$function$;

-- 12. is_practice_manager_for_practice(_user_id uuid, _practice_id uuid)
CREATE OR REPLACE FUNCTION public.is_practice_manager_for_practice(_user_id uuid, _practice_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'practice_manager'
      AND practice_id = _practice_id
  )
$function$;

-- 13. get_practice_manager_practice_id(_user_id uuid DEFAULT auth.uid())
CREATE OR REPLACE FUNCTION public.get_practice_manager_practice_id(_user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT practice_id
  FROM public.user_roles
  WHERE user_id = _user_id
    AND role = 'practice_manager'
  LIMIT 1
$function$;

-- 14. get_database_table_sizes()
CREATE OR REPLACE FUNCTION public.get_database_table_sizes()
 RETURNS TABLE(table_name text, size_bytes bigint, size_pretty text, row_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename AS table_name,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size_pretty,
    n_tup_ins - n_tup_del AS row_count
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$function$;

-- 15. log_session_access_attempt(p_session_id text, p_access_type text)
CREATE OR REPLACE FUNCTION public.log_session_access_attempt(p_session_id text, p_access_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- Log security event for session access attempts
  PERFORM public.log_security_event(
    'session_access_attempt',
    'medium',
    auth.uid(),
    auth.email(),
    NULL,
    NULL,
    jsonb_build_object(
      'session_id', p_session_id,
      'access_type', p_access_type,
      'timestamp', now()
    )
  );
END;
$function$;

-- 16. get_user_roles(_user_id uuid DEFAULT auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(role app_role, practice_id uuid, practice_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT 
    ur.role,
    ur.practice_id,
    pd.practice_name
  FROM public.user_roles ur
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  WHERE ur.user_id = _user_id
$function$;

-- 17. get_user_role_for_policy(check_user_id uuid DEFAULT auth.uid())
CREATE OR REPLACE FUNCTION public.get_user_role_for_policy(check_user_id uuid DEFAULT auth.uid())
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT role FROM public.user_roles 
  WHERE user_id = check_user_id 
  AND role = 'system_admin'
  LIMIT 1;
$function$;

-- 18. is_pcn_manager(_user_id uuid DEFAULT auth.uid())
CREATE OR REPLACE FUNCTION public.is_pcn_manager(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'pcn_manager'
  );
$function$;

-- 19. cleanup_stuck_meetings()
CREATE OR REPLACE FUNCTION public.cleanup_stuck_meetings()
 RETURNS TABLE(fixed_meetings_count integer, fixed_meeting_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  fixed_count integer := 0;
  meeting_ids uuid[];
BEGIN
  -- Find and fix meetings stuck in recording status but have content
  UPDATE meetings 
  SET 
    status = 'completed',
    end_time = COALESCE(end_time, updated_at, created_at + INTERVAL '2 hours'),
    updated_at = now()
  WHERE status = 'recording' 
    AND (
      word_count > 0 
      OR notes_generation_status = 'completed'
      OR created_at < now() - INTERVAL '4 hours' -- recordings older than 4 hours
    )
  RETURNING id INTO meeting_ids;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- Log the cleanup operation
  IF fixed_count > 0 THEN
    PERFORM log_system_activity(
      'meetings',
      'AUTO_CLEANUP_STUCK_RECORDINGS',
      NULL,
      jsonb_build_object(
        'fixed_count', fixed_count,
        'meeting_ids', meeting_ids,
        'cleanup_time', now()
      ),
      NULL
    );
  END IF;
  
  RETURN QUERY SELECT fixed_count, meeting_ids;
END;
$function$;

-- 20. trigger_queue_processing()
CREATE OR REPLACE FUNCTION public.trigger_queue_processing()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  pending_count INTEGER;
  result_json json;
BEGIN
  -- Count pending entries
  SELECT COUNT(*) INTO pending_count
  FROM meeting_notes_queue
  WHERE status = 'pending';
  
  -- Log the trigger attempt
  INSERT INTO system_audit_log (
    table_name,
    operation,
    user_id,
    new_values
  ) VALUES (
    'meeting_notes_queue',
    'MANUAL_TRIGGER',
    auth.uid(),
    jsonb_build_object(
      'pending_count', pending_count,
      'triggered_at', now()
    )
  );
  
  result_json := json_build_object(
    'success', true,
    'pending_entries', pending_count,
    'message', 'Queue processing trigger logged'
  );
  
  RETURN result_json;
END;
$function$;

-- 21. user_has_module_access(p_user_id uuid, p_module app_module)
CREATE OR REPLACE FUNCTION public.user_has_module_access(p_user_id uuid, p_module app_module)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_modules
    WHERE user_id = p_user_id
      AND module = p_module
      AND enabled = true
  );
$function$;

-- 22. create_default_attendee_templates(p_practice_id uuid, p_user_id uuid)
CREATE OR REPLACE FUNCTION public.create_default_attendee_templates(p_practice_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  -- Create a default "Regular Meeting" template
  INSERT INTO public.meeting_attendee_templates (
    practice_id, 
    template_name, 
    description, 
    is_default, 
    created_by
  ) VALUES (
    p_practice_id,
    'Regular Meeting',
    'Standard attendee list for regular practice meetings',
    true,
    p_user_id
  );
END;
$function$;