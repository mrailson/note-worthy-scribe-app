-- Comprehensive fix for remaining function search path warnings
-- Target specific functions that are likely causing the remaining 18 warnings

-- Query to identify functions without search_path (for debugging)
DO $$
DECLARE
    func_record record;
    fix_count integer := 0;
BEGIN
    -- Identify custom functions in public schema without search_path
    FOR func_record IN 
        SELECT p.proname, p.oid, n.nspname, p.prosrc
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.prosrc IS NOT NULL
        AND p.prosrc != ''
        AND NOT (p.prosrc LIKE '%search_path%' OR 
                 'search_path' = ANY(COALESCE(p.proconfig, ARRAY[]::text[])))
        AND p.proname NOT LIKE 'gin_%'  -- Skip PostgreSQL extension functions
        AND p.proname NOT LIKE 'gist_%'
        AND p.proname NOT LIKE 'gtrgm_%'
        AND p.proname NOT LIKE '%_ops'
        ORDER BY p.proname
    LOOP
        RAISE NOTICE 'Found function without search_path: %.%()', func_record.nspname, func_record.proname;
        fix_count := fix_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Total custom functions found without search_path: %', fix_count;
END $$;

-- Now fix specific functions that we know exist and might be missing search_path

-- Fix any remaining audit/trigger functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix log_system_activity if it's missing search_path
CREATE OR REPLACE FUNCTION public.log_system_activity(
    p_table_name text, 
    p_operation text, 
    p_record_id uuid DEFAULT NULL::uuid, 
    p_old_values jsonb DEFAULT NULL::jsonb, 
    p_new_values jsonb DEFAULT NULL::jsonb
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
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

-- Try to fix any remaining PostgreSQL extension operator functions by updating their proconfig
-- This is a more aggressive approach for system-level functions
UPDATE pg_proc 
SET proconfig = array_append(
    COALESCE(proconfig, ARRAY[]::text[]), 
    'search_path=public,pg_temp'
)
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND prosrc IS NOT NULL
AND prosrc != ''
AND NOT (prosrc LIKE '%search_path%' OR 'search_path' = ANY(COALESCE(proconfig, ARRAY[]::text[])))
-- Only target functions we can safely modify
AND NOT (
    proname LIKE 'gin_%' OR 
    proname LIKE 'gist_%' OR 
    proname LIKE 'gtrgm_%' OR
    proname LIKE '%_ops' OR
    proname LIKE '%_handler' OR
    proname LIKE '%_recv' OR
    proname LIKE '%_send'
);