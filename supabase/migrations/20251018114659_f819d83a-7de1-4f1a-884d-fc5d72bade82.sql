-- Update SELECT policy on complaint_outcomes to allow system admins to view all
DO $$
BEGIN
  -- Drop existing SELECT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complaint_outcomes' 
      AND policyname = 'Users can view outcomes for their practice complaints'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view outcomes for their practice complaints" ON public.complaint_outcomes';
  END IF;
END $$;

-- Create improved SELECT policy including system admin access
CREATE POLICY "Users and admins can view complaint outcomes"
ON public.complaint_outcomes
FOR SELECT
USING (
  is_system_admin(auth.uid()) OR
  complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE (c.practice_id = ANY (get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid())
  )
);
