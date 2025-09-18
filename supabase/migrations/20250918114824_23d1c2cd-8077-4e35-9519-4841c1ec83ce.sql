-- Fix any remaining SQL functions that might be missing search_path
-- These are likely SQL functions (not plpgsql) that need the search_path parameter

-- Fix log_security_event function (if it exists without search_path)
CREATE OR REPLACE FUNCTION public.log_security_event(event_type text, event_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Insert security event
    INSERT INTO public.security_events (event_type, event_details)
    VALUES (event_type, event_data);
END;
$function$;

-- Check if there are any other SQL functions that need search_path
-- Fix any SQL-language functions that might be missing search_path
DO $$
DECLARE
    func_rec RECORD;
    func_def TEXT;
BEGIN
    -- Loop through SQL functions that might need search_path
    FOR func_rec IN 
        SELECT p.proname, n.nspname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'sql')
          AND pg_get_functiondef(p.oid) NOT ILIKE '%SET search_path%'
          AND p.proname NOT LIKE 'pg_%'
        LIMIT 5
    LOOP
        RAISE NOTICE 'Found SQL function without search_path: %.%', func_rec.nspname, func_rec.proname;
    END LOOP;
END $$;