-- Fix profiles_select_practice_managers policy to only apply to authenticated users
-- Currently it applies to ALL roles including anon, creating a security vulnerability

DROP POLICY IF EXISTS "profiles_select_practice_managers" ON public.profiles;

CREATE POLICY "profiles_select_practice_managers" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  user_id IN (
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.practice_id = ANY(public.get_user_practice_ids(auth.uid()))
  ) 
  AND public.has_role(auth.uid(), 'practice_manager'::app_role)
);

-- Also enable FORCE ROW LEVEL SECURITY to prevent bypass by table owners
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;