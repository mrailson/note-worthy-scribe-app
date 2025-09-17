-- CRITICAL FIX: Enable RLS on system_extensions_info table
ALTER TABLE public.system_extensions_info ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for system extensions info (system admin access only)
CREATE POLICY "System admins can view extension info" 
ON public.system_extensions_info 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage extension info" 
ON public.system_extensions_info 
FOR ALL 
USING (is_system_admin(auth.uid())) 
WITH CHECK (is_system_admin(auth.uid()));

-- Now continue with fixing more function search path issues
-- Let's target some of the remaining PostgreSQL extension functions

-- Fix any remaining gin/gist functions from pg_trgm that might not have search_path
DO $$
DECLARE
    func_name text;
    func_oid oid;
BEGIN
    -- Look for functions that might be related to extensions but missing search_path
    FOR func_oid, func_name IN 
        SELECT p.oid, p.proname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname ~ '^(gin_|gist_|gtrgm_)'
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
    LOOP
        BEGIN
            -- Add search path to these extension-related functions
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=extensions,public,pg_temp'
            )
            WHERE oid = func_oid;
            
            RAISE NOTICE 'Added search_path to function %', func_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update function %: %', func_name, SQLERRM;
        END;
    END LOOP;
END $$;