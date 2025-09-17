-- Comprehensive function search path fix - Phase 3
-- Target all remaining functions without search_path in a more systematic way

DO $$
DECLARE
    func_record RECORD;
    fixed_count integer := 0;
BEGIN
    -- Get all functions in public schema that don't have search_path set
    -- Focus on user-defined functions and commonly problematic ones
    FOR func_record IN 
        SELECT p.oid, p.proname, n.nspname, p.prokind
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        AND p.proname NOT IN ('array_recv', 'array_send')  -- Skip system functions that might cause issues
        ORDER BY p.proname
        LIMIT 15  -- Process in smaller batches
    LOOP
        BEGIN
            -- Add search path to function
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,extensions,pg_temp'
            )
            WHERE oid = func_record.oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to % function: %', func_record.prokind, func_record.proname;
            
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update function %: %', func_record.proname, SQLERRM;
        END;
    END LOOP;
    
    -- Also try to fix any custom operators that might be missing search_path
    FOR func_record IN 
        SELECT p.oid, p.proname, n.nspname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        JOIN pg_operator o ON p.oid = o.oprcode
        WHERE n.nspname = 'public' 
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        LIMIT 5
    LOOP
        BEGIN
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,extensions,pg_temp'
            )
            WHERE oid = func_record.oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to operator function: %', func_record.proname;
            
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update operator function %: %', func_record.proname, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Total functions processed in this batch: %', fixed_count;
    
    -- Log current state for debugging
    RAISE NOTICE 'Remaining functions without search_path: %', (
        SELECT count(*)
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
    );
END $$;