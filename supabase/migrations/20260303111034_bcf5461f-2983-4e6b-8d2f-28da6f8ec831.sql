
-- Security definer function: get all practice_ids visible to a user
-- Includes their own practice(s) AND any PCN practice that covers their member practices
CREATE OR REPLACE FUNCTION public.get_visible_practice_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(DISTINCT pid) FROM (
    -- User's own practice(s) from user_roles
    SELECT ur.practice_id AS pid
    FROM user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.practice_id IS NOT NULL
    
    UNION
    
    -- PCN entries in gp_practices that cover the user's member practices
    -- e.g. user is at Towcester (pcn_code U07902) → also sees entries from "Brackley & Towcester PCN" gp_practices row
    SELECT pcn_gp.id AS pid
    FROM user_roles ur
    JOIN gp_practices member ON member.id = ur.practice_id
    JOIN primary_care_networks pcn ON pcn.pcn_code = member.pcn_code
    JOIN gp_practices pcn_gp ON pcn_gp.name ILIKE '%' || split_part(pcn.pcn_name, ' PCN', 1) || '%'
      AND pcn_gp.organisation_type = 'PCN'
    WHERE ur.user_id = p_user_id
      AND member.pcn_code IS NOT NULL
    
    UNION
    
    -- If user IS at a PCN practice, also see all member practices
    SELECT member.id AS pid
    FROM user_roles ur
    JOIN gp_practices pcn_gp ON pcn_gp.id = ur.practice_id
    JOIN gp_practices member ON member.pcn_code = (
      SELECT pcn2.pcn_code FROM primary_care_networks pcn2 
      WHERE pcn_gp.name ILIKE '%' || split_part(pcn2.pcn_name, ' PCN', 1) || '%'
      LIMIT 1
    )
    WHERE ur.user_id = p_user_id
      AND pcn_gp.organisation_type = 'PCN'
  ) sub
  WHERE pid IS NOT NULL
$$;

-- Update the RLS policy to use the new function
DROP POLICY IF EXISTS "Practice members can view practice hours entries" ON public.nres_hours_entries;
CREATE POLICY "Practice members can view practice hours entries"
ON public.nres_hours_entries FOR SELECT
TO authenticated
USING (
  practice_id = ANY(public.get_visible_practice_ids(auth.uid()))
);

DROP POLICY IF EXISTS "Practice members can view practice expenses" ON public.nres_expenses;
CREATE POLICY "Practice members can view practice expenses"
ON public.nres_expenses FOR SELECT
TO authenticated
USING (
  practice_id = ANY(public.get_visible_practice_ids(auth.uid()))
);
