
-- Fix: update organisation_type for PCN entries and simplify the function
UPDATE gp_practices SET organisation_type = 'PCN' WHERE name ILIKE '%PCN%' AND id = 'c800c954-3928-4a37-a5c4-c4ff3e680333';

-- Simplified function: match PCN by name pattern rather than exact name match
CREATE OR REPLACE FUNCTION public.get_visible_practice_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(DISTINCT pid) FROM (
    -- User's own practice(s)
    SELECT ur.practice_id AS pid
    FROM user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.practice_id IS NOT NULL
    
    UNION
    
    -- If user is at a member practice, also see the PCN gp_practices entry
    -- Match: user's practice pcn_code → primary_care_networks → gp_practices with matching PCN name
    SELECT pcn_gp.id AS pid
    FROM user_roles ur
    JOIN gp_practices member ON member.id = ur.practice_id
    JOIN primary_care_networks pcn ON pcn.pcn_code = member.pcn_code
    JOIN gp_practices pcn_gp ON (
      pcn_gp.name ILIKE '%' || replace(replace(pcn.pcn_name, ' PCN', ''), ' and ', '%') || '%PCN%'
      OR pcn_gp.name ILIKE '%' || replace(replace(pcn.pcn_name, ' PCN', ''), ' and ', ' & ') || '%PCN%'
    )
    WHERE ur.user_id = p_user_id
      AND member.pcn_code IS NOT NULL
    
    UNION
    
    -- If user IS at a PCN entry, also see all member practices
    SELECT member.id AS pid
    FROM user_roles ur
    JOIN gp_practices pcn_gp ON pcn_gp.id = ur.practice_id AND pcn_gp.name ILIKE '%PCN%'
    JOIN primary_care_networks pcn ON (
      pcn_gp.name ILIKE '%' || replace(replace(pcn.pcn_name, ' PCN', ''), ' and ', '%') || '%PCN%'
      OR pcn_gp.name ILIKE '%' || replace(replace(pcn.pcn_name, ' PCN', ''), ' and ', ' & ') || '%PCN%'
    )
    JOIN gp_practices member ON member.pcn_code = pcn.pcn_code
    WHERE ur.user_id = p_user_id
  ) sub
  WHERE pid IS NOT NULL
$$;
