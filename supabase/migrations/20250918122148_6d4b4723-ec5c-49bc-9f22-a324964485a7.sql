-- Fix all remaining function search path security issues
-- Set secure search_path and schema-qualify all object references

-- Fix any remaining functions with mutable search paths
-- Update all functions that might still have search path issues

-- Check and fix common functions that might have search path issues
CREATE OR REPLACE FUNCTION public.log_system_activity(p_table_name text, p_operation text, p_record_id uuid DEFAULT NULL::uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  log_id UUID;
  user_practice_id UUID;
  current_user_id UUID;
BEGIN
  -- Get current user, default to null if not available
  current_user_id := auth.uid();
  
  -- Only try to get practice if we have a valid user
  IF current_user_id IS NOT NULL THEN
    SELECT practice_id INTO user_practice_id
    FROM public.user_roles
    WHERE user_id = current_user_id
    LIMIT 1;
  END IF;

  -- Insert audit log entry only if we have a valid user
  IF current_user_id IS NOT NULL THEN
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      user_email,
      practice_id,
      old_values,
      new_values,
      timestamp
    ) VALUES (
      p_table_name,
      p_operation,
      p_record_id,
      current_user_id,
      auth.email(),
      user_practice_id,
      p_old_values,
      p_new_values,
      now()
    ) RETURNING id INTO log_id;
  ELSE
    -- Generate a dummy UUID if no user context
    log_id := gen_random_uuid();
  END IF;
  
  RETURN log_id;
END;
$function$;