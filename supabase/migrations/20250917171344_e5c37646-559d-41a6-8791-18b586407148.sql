-- Target our custom application functions specifically
-- These are the functions we've created that might be missing search_path

-- Fix search_path for our custom application functions
DO $$
DECLARE
    func_name text;
    func_oid oid;
    fixed_count integer := 0;
BEGIN
    -- Target our custom functions by name patterns
    FOR func_oid, func_name IN 
        SELECT p.oid, p.proname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN (
            'get_meeting_full_transcript',
            'cleanup_stuck_meetings',
            'get_user_modules',
            'log_security_event',
            'get_user_practice_ids',
            'update_staff_hours_summary',
            'audit_complaint_changes',
            'log_system_activity',
            'update_chunk_word_count',
            'validate_meeting_transcript_save',
            'user_has_meeting_access',
            'check_transcript_integrity',
            'emergency_detect_transcript_data_loss',
            'generate_complaint_reference',
            'get_current_user_role',
            'has_role',
            'set_data_retention_date',
            'complete_meeting',
            'get_combined_transcript',
            'get_meeting_transcript',
            'get_pcn_manager_practice_ids',
            'auto_generate_incident_reference'
        )
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
    LOOP
        BEGIN
            -- Add search path to our custom functions
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,pg_temp'
            )
            WHERE oid = func_oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to custom function %', func_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update custom function %: %', func_name, SQLERRM;
        END;
    END LOOP;
    
    -- Also check trigger functions
    FOR func_oid, func_name IN 
        SELECT p.oid, p.proname
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN (
            'update_complaint_status_on_acknowledgement',
            'update_complaint_status_on_outcome',
            'update_updated_at_column',
            'auto_generate_reference',
            'auto_generate_incident_reference',
            'update_translation_sessions_updated_at',
            'update_user_settings_updated_at',
            'protect_system_admin_updates',
            'update_medical_corrections_updated_at',
            'protect_primary_admin',
            'monitor_user_session',
            'update_meeting_shares_on_signup',
            'update_gp_practices_updated_at',
            'prevent_self_privilege_escalation'
        )
        AND (p.proconfig IS NULL OR NOT (p.proconfig::text ~ 'search_path'))
    LOOP
        BEGIN
            UPDATE pg_proc 
            SET proconfig = array_append(
                COALESCE(proconfig, ARRAY[]::text[]), 
                'search_path=public,pg_temp'
            )
            WHERE oid = func_oid;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE 'Added search_path to trigger function %', func_name;
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not update trigger function %: %', func_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Fixed search_path for % custom functions in this batch', fixed_count;
END $$;