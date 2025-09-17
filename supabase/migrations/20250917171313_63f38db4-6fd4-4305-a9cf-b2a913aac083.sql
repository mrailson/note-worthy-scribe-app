-- Continue fixing function search path issues - Phase 2
-- Target different categories of functions that might be missing search_path

-- Fix functions related to text search and trigrams
DO $$
DECLARE
    func_name text;
    func_oid oid;
    fixed_count integer := 0;
BEGIN
    -- Look for text search and similarity functions missing search_path
    FOR func_oid, func_name IN 
        SELECT p.oid, p.proname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND (
            p.proname ~ '^(similarity|word_similarity|strict_word_similarity|show_trgm|show_limit|set_limit)'
            OR p.proname ~ '^(ts_|plainto_|phraseto_|websearch_to_)'
            OR p.proname ~ '^(array_|string_)'
        )
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        LIMIT 10  -- Process in batches to avoid timeout
    LOOP
        BEGIN
            -- Add search path to these functions
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,extensions,pg_temp'
            )
            WHERE oid = func_oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to function %', func_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update function %: %', func_name, SQLERRM;
        END;
    END LOOP;
    
    -- Also fix any aggregate functions missing search_path
    FOR func_oid, func_name IN 
        SELECT p.oid, p.proname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.prokind = 'a'  -- aggregate functions
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        LIMIT 5
    LOOP
        BEGIN
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,extensions,pg_temp'
            )
            WHERE oid = func_oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to aggregate function %', func_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update aggregate function %: %', func_name, SQLERRM;
        END;
    END LOOP;
    
    -- Fix any window functions missing search_path  
    FOR func_oid, func_name IN 
        SELECT p.oid, p.proname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.prokind = 'w'  -- window functions
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
        LIMIT 5
    LOOP
        BEGIN
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,extensions,pg_temp'
            )
            WHERE oid = func_oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to window function %', func_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update window function %: %', func_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Fixed search_path for % functions in this batch', fixed_count;
END $$;