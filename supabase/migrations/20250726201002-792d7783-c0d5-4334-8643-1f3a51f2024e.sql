-- Update the complaints RLS policy to properly handle multi-practice assignments
DROP POLICY IF EXISTS "Users can view complaints for their practice or created by them" ON public.complaints;

CREATE POLICY "Users can view complaints for their practice or created by them" 
ON public.complaints 
FOR SELECT 
USING (
  is_system_admin() OR 
  (created_by = auth.uid()) OR 
  (practice_id = ANY(get_user_practice_ids(auth.uid())))
);