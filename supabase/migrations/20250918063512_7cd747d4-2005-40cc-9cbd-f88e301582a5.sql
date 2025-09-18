-- Fix function search path security issues
-- Drop and recreate functions that don't have proper search_path settings

-- Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS public.cleanup_meeting_note_versions() CASCADE;

-- Recreate functions with proper search_path settings

-- 1. deduplicate_medicines function - add search_path
CREATE OR REPLACE FUNCTION public.deduplicate_medicines()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Remove duplicate medicines based on name and status_enum
  DELETE FROM traffic_light_medicines a
  USING traffic_light_medicines b
  WHERE a.id < b.id
    AND a.name = b.name
    AND a.status_enum = b.status_enum;
END;
$function$;

-- 2. get_comprehensive_drug_info function - add search_path
CREATE OR REPLACE FUNCTION public.get_comprehensive_drug_info(drug_name_param text)
 RETURNS TABLE(drug_name text, traffic_light_status text, bnf_chapter text, notes text, prior_approval_data jsonb, bnf_data jsonb, formulary_data jsonb, monitoring_data jsonb, populations_data jsonb, antimicrobial_data jsonb, devices_vaccines_data jsonb, links_data jsonb, last_reviewed_date date, icb_region text, source_document text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    tlm.name as drug_name,
    tlm.status_enum as traffic_light_status,
    tlm.bnf_chapter,
    tlm.notes,
    tlm.prior_approval_data,
    tlm.bnf_data,
    tlm.formulary_data,
    tlm.monitoring_data,
    tlm.populations_data,
    tlm.antimicrobial_data,
    tlm.devices_vaccines_data,
    tlm.links_data,
    tlm.last_reviewed_date,
    tlm.icb_region,
    tlm.source_document
  FROM traffic_light_medicines tlm
  WHERE tlm.name ILIKE '%' || drug_name_param || '%'
  ORDER BY 
    CASE WHEN tlm.name ILIKE drug_name_param || '%' THEN 1 ELSE 2 END,
    similarity(tlm.name, drug_name_param) DESC
  LIMIT 10;
$function$;

-- 3. icn_norm function - add search_path  
CREATE OR REPLACE FUNCTION public.icn_norm(input_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Basic normalisation: lowercase, remove extra spaces, remove common suffixes
    RETURN TRIM(
        LOWER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(input_name, '\s+', ' ', 'g'), -- normalise spaces
                    '\s*(tablet|capsule|injection|cream|ointment|spray|inhaler|solution|suspension|drops)s?\s*$', '', 'gi' -- remove formulation
                ),
                '\s*(mg|mcg|microgram|g|ml|%)\s*\d*\s*$', '', 'gi' -- remove dosage
            )
        )
    );
END;
$function$;