-- Diagnostic: Find exactly which functions are missing search_path
-- This will help us identify the specific functions causing the warnings

DO $$
DECLARE
    func_record RECORD;
    total_functions_without_search_path INTEGER := 0;
BEGIN
    RAISE NOTICE '=== DIAGNOSTIC: Functions missing search_path ===';
    
    -- Find all functions in public schema without proper search_path
    FOR func_record IN 
        SELECT 
            p.oid,
            p.proname as function_name,
            n.nspname as schema_name,
            p.prokind as function_kind,
            CASE 
                WHEN p.proconfig IS NULL THEN 'NULL'
                WHEN NOT (p.proconfig::text ~ 'search_path') THEN 'NO_SEARCH_PATH'
                ELSE 'HAS_SEARCH_PATH'
            END as search_path_status,
            p.proconfig::text as current_config
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public'
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        ORDER BY p.proname
        LIMIT 30  -- Show first 30 to avoid too much output
    LOOP
        total_functions_without_search_path := total_functions_without_search_path + 1;
        
        RAISE NOTICE 'Function: %.% (kind: %, status: %, config: %)', 
            func_record.schema_name, 
            func_record.function_name,
            func_record.function_kind,
            func_record.search_path_status,
            COALESCE(func_record.current_config, 'NULL');
    END LOOP;
    
    RAISE NOTICE '=== Total functions without search_path (showing first 30): % ===', total_functions_without_search_path;
    
    -- Get total count
    SELECT COUNT(*) INTO total_functions_without_search_path
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public'
    AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'));
    
    RAISE NOTICE '=== TOTAL functions in public schema without search_path: % ===', total_functions_without_search_path;
    
    -- Now let's try to fix functions with specific patterns
    UPDATE pg_proc 
    SET proconfig = array_append(
        COALESCE(proconfig, ARRAY[]::text[]), 
        'search_path=public,pg_temp'
    )
    WHERE oid IN (
        SELECT p.oid
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public'
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        AND p.proname ~ '^(get_|has_|is_|log_|update_|set_|validate_|check_|generate_|complete_|cleanup_|audit_|auto_|prevent_|protect_|monitor_)'
        LIMIT 10  -- Fix 10 at a time
    );
    
    GET DIAGNOSTICS total_functions_without_search_path = ROW_COUNT;
    RAISE NOTICE 'Fixed search_path for % functions with common patterns', total_functions_without_search_path;
    
END $$;