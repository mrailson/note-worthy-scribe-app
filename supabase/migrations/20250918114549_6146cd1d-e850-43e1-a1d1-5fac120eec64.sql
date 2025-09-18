-- Fix remaining search path security issues for database functions
-- Add SET search_path to the remaining functions that are missing this security parameter

-- Fix update_medical_corrections_updated_at function
CREATE OR REPLACE FUNCTION public.update_medical_corrections_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix get_comprehensive_drug_info function  
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

-- Fix get_practice_role_display_name function
CREATE OR REPLACE FUNCTION public.get_practice_role_display_name(role_enum practice_role)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE role_enum
    WHEN 'gp_partner' THEN 'GP Partner'
    WHEN 'salaried_gp' THEN 'Salaried GP'
    WHEN 'reception_team' THEN 'Reception Team'
    WHEN 'admin_team' THEN 'Admin Team'
    WHEN 'secretaries' THEN 'Secretaries'
    ELSE 'Unknown'
  END;
$function$;

-- Fix handle_new_user function (has no search_path in the schema)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$function$;