-- Fix remaining medium-priority security issues

-- 1. Fix any remaining functions with mutable search_path
-- Check and fix log_security_event and any other remaining functions

-- Update log_security_event function (if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'log_security_event' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    -- Drop and recreate with proper search_path
    DROP FUNCTION IF EXISTS public.log_security_event(text, text, jsonb, text, text) CASCADE;
    
    CREATE OR REPLACE FUNCTION public.log_security_event(
      p_event_type text,
      p_severity text,
      p_event_details jsonb DEFAULT '{}'::jsonb,
      p_ip_address text DEFAULT NULL,
      p_user_agent text DEFAULT NULL
    )
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $func$
    BEGIN
      INSERT INTO public.security_events (
        user_id,
        event_type,
        severity,
        event_details,
        ip_address,
        user_agent
      ) VALUES (
        auth.uid(),
        p_event_type,
        p_severity,
        p_event_details,
        p_ip_address,
        p_user_agent
      );
    END;
    $func$;
  END IF;
END $$;

-- 2. Move http extension from public schema to extensions schema
-- First create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: We cannot directly move the http extension as it requires superuser privileges
-- This will need to be done via Supabase dashboard or support
-- Document this in a comment
COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions. Note: http extension should be moved here from public schema via Supabase dashboard.';

-- 3. Add security comments and documentation
COMMENT ON SCHEMA public IS 'Public schema - all extensions should be in extensions schema, all functions should have explicit search_path set';

-- Create a view to help identify any remaining security issues
CREATE OR REPLACE VIEW public.security_audit_functions AS
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'SET'
    ELSE 'MUTABLE'
  END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public')
  AND p.prokind = 'f'
ORDER BY n.nspname, p.proname;