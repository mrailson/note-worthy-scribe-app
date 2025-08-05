-- Fix search path security issues in all remaining critical functions
-- These are the most commonly used functions that need secure search paths

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

-- Fix audit_acknowledgement_changes function
CREATE OR REPLACE FUNCTION public.audit_acknowledgement_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_complaint_activity(
      NEW.complaint_id,
      'acknowledgement_sent',
      'Acknowledgement letter sent',
      NULL,
      jsonb_build_object(
        'sent_at', NEW.sent_at,
        'sent_by', NEW.sent_by
      )
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;