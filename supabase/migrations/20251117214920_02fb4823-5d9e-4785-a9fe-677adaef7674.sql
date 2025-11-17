-- Fix Final High Priority Security Issues - Remaining Function Search Paths

-- Function: log_complaint_action
CREATE OR REPLACE FUNCTION public.log_complaint_action(
  p_complaint_id uuid, 
  p_action_type text, 
  p_action_description text, 
  p_old_values jsonb DEFAULT NULL::jsonb, 
  p_new_values jsonb DEFAULT NULL::jsonb, 
  p_ip_address text DEFAULT NULL::text, 
  p_user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    
    INSERT INTO complaint_audit_detailed (
      complaint_id,
      action_type,
      action_description,
      user_id,
      user_email,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      p_complaint_id,
      p_action_type,
      p_action_description,
      v_user_id,
      v_user_email,
      p_old_values,
      p_new_values,
      p_ip_address,
      p_user_agent,
      NOW()
    );
  END IF;
END;
$function$;

-- Function: update_user_session_activity (3 param version)
CREATE OR REPLACE FUNCTION public.update_user_session_activity(
  p_user_id uuid, 
  p_ip_address inet DEFAULT NULL::inet, 
  p_user_agent text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.user_sessions 
  SET 
    last_activity = now(),
    ip_address = COALESCE(p_ip_address, ip_address),
    user_agent = COALESCE(p_user_agent, user_agent)
  WHERE user_id = p_user_id 
    AND is_active = true
    AND login_time = (
      SELECT MAX(login_time) 
      FROM public.user_sessions 
      WHERE user_id = p_user_id AND is_active = true
    );
END;
$function$;

-- Function: update_user_session_activity (4 param version with session_id)
CREATE OR REPLACE FUNCTION public.update_user_session_activity(
  p_user_id uuid, 
  p_ip_address inet DEFAULT NULL::inet, 
  p_user_agent text DEFAULT NULL::text, 
  p_session_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF p_session_id IS NOT NULL THEN
        UPDATE public.user_sessions 
        SET 
            last_activity = now(),
            ip_address = COALESCE(p_ip_address, ip_address),
            user_agent = COALESCE(p_user_agent, user_agent)
        WHERE session_id = p_session_id;
        
        IF NOT FOUND THEN
            PERFORM public.log_user_session(p_user_id, p_ip_address, p_user_agent, p_session_id);
        END IF;
    ELSE
        UPDATE public.user_sessions 
        SET 
            last_activity = now(),
            ip_address = COALESCE(p_ip_address, ip_address),
            user_agent = COALESCE(p_user_agent, user_agent)
        WHERE user_id = p_user_id 
            AND is_active = true
            AND login_time = (
                SELECT MAX(login_time) 
                FROM public.user_sessions 
                WHERE user_id = p_user_id AND is_active = true
            );
            
        IF NOT FOUND THEN
            PERFORM public.log_user_session(p_user_id, p_ip_address, p_user_agent);
        END IF;
    END IF;
END;
$function$;