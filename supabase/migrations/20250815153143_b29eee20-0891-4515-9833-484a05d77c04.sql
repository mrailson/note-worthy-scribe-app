-- Fix the function security issue by adding proper security definer and search path
DROP FUNCTION IF EXISTS get_practice_role_display_name(practice_role);

CREATE OR REPLACE FUNCTION get_practice_role_display_name(role_enum practice_role)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT CASE role_enum
    WHEN 'gp_partner' THEN 'GP Partner'
    WHEN 'salaried_gp' THEN 'Salaried GP'
    WHEN 'reception_team' THEN 'Reception Team'
    WHEN 'admin_team' THEN 'Admin Team'
    WHEN 'secretaries' THEN 'Secretaries'
    ELSE 'Unknown'
  END;
$$;