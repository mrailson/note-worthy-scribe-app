-- Remove all Northants Medicines Lookup related tables and data
-- These tables were causing security warnings due to public access

-- Drop the tables that contain medical drug information
DROP TABLE IF EXISTS public.traffic_light_vocab CASCADE;
DROP TABLE IF EXISTS public.icn_policy_synonyms CASCADE;
DROP TABLE IF EXISTS public.icn_prior_approval CASCADE;
DROP TABLE IF EXISTS public.prior_approval_criteria CASCADE;

-- Also drop any views or functions that might depend on these tables
DROP VIEW IF EXISTS public.traffic_light_medicines_view CASCADE;
DROP FUNCTION IF EXISTS public.lookup_traffic_light_medicine(text) CASCADE;
DROP FUNCTION IF EXISTS public.search_medicines_by_name(text) CASCADE;

-- Log the cleanup for audit purposes
INSERT INTO public.system_audit_log (
    table_name,
    operation,
    user_id,
    user_email,
    new_values
) VALUES (
    'medicine_lookup_cleanup',
    'TABLES_DROPPED',
    auth.uid(),
    auth.email(),
    jsonb_build_object(
        'dropped_tables', ARRAY['traffic_light_vocab', 'icn_policy_synonyms', 'icn_prior_approval', 'prior_approval_criteria'],
        'reason', 'Security cleanup - removed public access to medical data',
        'timestamp', now()
    )
);