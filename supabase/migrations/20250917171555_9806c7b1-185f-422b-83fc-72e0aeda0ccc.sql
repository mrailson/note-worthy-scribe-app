-- Query to identify and fix ALL functions missing search_path systematically
DO $$
DECLARE
    func_record RECORD;
    fixed_count integer := 0;
    total_found integer := 0;
BEGIN
    RAISE NOTICE 'Starting systematic search_path fix for ALL public functions...';
    
    -- First, count how many functions need fixing
    SELECT COUNT(*) INTO total_found
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'));
    
    RAISE NOTICE 'Found % functions without search_path in public schema', total_found;
    
    -- Now fix them in batches
    FOR func_record IN 
        SELECT p.oid, p.proname, p.prokind
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        ORDER BY p.proname
        LIMIT 50  -- Process first 50 functions
    LOOP
        BEGIN
            -- Add search path based on function type
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                CASE 
                    WHEN func_record.prokind = 'f' THEN 'search_path=public,pg_temp'  -- regular function
                    WHEN func_record.prokind = 'a' THEN 'search_path=public,pg_temp'  -- aggregate
                    WHEN func_record.prokind = 'w' THEN 'search_path=public,pg_temp'  -- window function
                    WHEN func_record.prokind = 'p' THEN 'search_path=public,pg_temp'  -- procedure
                    ELSE 'search_path=public,pg_temp'
                END
            )
            WHERE oid = func_record.oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Fixed function % (type: %)', func_record.proname, func_record.prokind;
            
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update function %: %', func_record.proname, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Successfully fixed search_path for %/% functions', fixed_count, total_found;
    
    -- Report remaining functions that still need fixing
    SELECT COUNT(*) INTO total_found
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' 
    AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'));
    
    RAISE NOTICE 'Remaining functions without search_path: %', total_found;
END $$;