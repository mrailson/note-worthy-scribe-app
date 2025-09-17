-- Identify and fix remaining functions missing search_path
-- Let's be more systematic about finding what's left

DO $$
DECLARE
    func_record RECORD;
    fixed_count integer := 0;
    remaining_functions text[] := '{}';
BEGIN
    RAISE NOTICE 'Searching for remaining functions without search_path...';
    
    -- First, let's see what functions are still missing search_path
    FOR func_record IN 
        SELECT p.proname, p.oid, n.nspname, p.prokind
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        ORDER BY p.proname
    LOOP
        remaining_functions := array_append(remaining_functions, func_record.proname);
    END LOOP;
    
    RAISE NOTICE 'Functions still missing search_path: %', array_to_string(remaining_functions, ', ');
    
    -- Now fix them systematically
    FOR func_record IN 
        SELECT p.proname, p.oid, n.nspname, p.prokind
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        ORDER BY p.proname
        LIMIT 20
    LOOP
        BEGIN
            -- Add search_path to function
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,pg_temp'
            )
            WHERE oid = func_record.oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Fixed search_path for function: % (type: %)', func_record.proname, func_record.prokind;
            
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update function %: %', func_record.proname, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Fixed search_path for % more functions', fixed_count;
END $$;