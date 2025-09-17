-- Fix remaining Extension Location warning - exclude system extensions
-- Only move extensions that can actually be moved (not core Supabase extensions)

DO $$
DECLARE
    ext_name text;
    system_extensions text[] := ARRAY[
        'plpgsql', 'pg_net', 'pgsodium', 'supabase_vault', 'pg_graphql', 
        'pg_stat_statements', 'pgcrypto', 'pgjwt', 'uuid-ossp', 'pgaudit'
    ];
BEGIN
    -- Find moveable extensions still in public schema
    FOR ext_name IN 
        SELECT e.extname 
        FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE n.nspname = 'public'
        AND e.extname != ALL(system_extensions)
        AND EXISTS (
            -- Only try to move if the extension supports SET SCHEMA
            SELECT 1 FROM pg_extension_update_paths(e.extname) LIMIT 1
        )
    LOOP
        BEGIN
            -- Try to move extension to extensions schema
            EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext_name);
            RAISE NOTICE 'Successfully moved extension % to extensions schema', ext_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not move extension % (this is expected for some system extensions): %', ext_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- Since some extensions cannot be moved, let's check if we can create wrapper functions
-- instead to isolate their usage

-- Create a status report of what extensions remain in public schema
DO $$
DECLARE
    ext_record record;
    public_ext_count integer := 0;
BEGIN
    FOR ext_record IN 
        SELECT e.extname, n.nspname as schema_name
        FROM pg_extension e 
        JOIN pg_namespace n ON e.extnamespace = n.oid 
        WHERE n.nspname = 'public'
    LOOP
        public_ext_count := public_ext_count + 1;
        RAISE NOTICE 'Extension % remains in public schema (may be system extension)', ext_record.extname;
    END LOOP;
    
    IF public_ext_count = 0 THEN
        RAISE NOTICE 'All moveable extensions have been relocated to extensions schema';
    END IF;
END $$;