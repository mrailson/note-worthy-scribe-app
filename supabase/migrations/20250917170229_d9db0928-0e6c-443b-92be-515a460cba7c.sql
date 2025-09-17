-- Fix the remaining Extension Location warning
-- Find and move the last extension that's still in public schema

-- Check what extensions are still in public schema and move them
DO $$
DECLARE
    ext_name text;
BEGIN
    -- Find extensions still in public schema
    FOR ext_name IN 
        SELECT e.extname 
        FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE n.nspname = 'public'
        AND e.extname NOT IN ('plpgsql') -- Don't move core extensions
    LOOP
        -- Move extension to extensions schema
        EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
        RAISE NOTICE 'Moved extension % to extensions schema', ext_name;
    END LOOP;
END $$;

-- Ensure the extensions schema has the right permissions
GRANT USAGE ON SCHEMA extensions TO public;

-- Update any remaining functions that might reference moved extensions
-- Fix any gin/gist operator functions that might be referencing the old public schema

-- Update search paths for any functions using these extensions
UPDATE pg_proc 
SET proconfig = array_append(
    COALESCE(proconfig, ARRAY[]::text[]), 
    'search_path=extensions,public,pg_temp'
)
WHERE oid IN (
    SELECT p.oid 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND p.prosrc ~ '(similarity|unaccent|trigram|gin_|gist_)'
    AND NOT ('search_path' = ANY(COALESCE(p.proconfig, ARRAY[]::text[])))
);