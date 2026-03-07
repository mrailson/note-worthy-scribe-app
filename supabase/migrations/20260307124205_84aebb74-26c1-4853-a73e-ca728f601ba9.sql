-- RLS for policy_library_access
CREATE POLICY "PM can view access records for their practice"
  ON public.policy_library_access FOR SELECT
  TO authenticated
  USING (
    public.is_practice_manager_for_practice(auth.uid(), practice_id)
    OR user_id = auth.uid()
    OR is_system_admin()
  );

CREATE POLICY "PM can insert access records for their practice"
  ON public.policy_library_access FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_practice_manager_for_practice(auth.uid(), practice_id)
    OR is_system_admin()
  );

CREATE POLICY "PM can update access records for their practice"
  ON public.policy_library_access FOR UPDATE
  TO authenticated
  USING (
    public.is_practice_manager_for_practice(auth.uid(), practice_id)
    OR is_system_admin()
  );

CREATE POLICY "PM can delete access records for their practice"
  ON public.policy_library_access FOR DELETE
  TO authenticated
  USING (
    public.is_practice_manager_for_practice(auth.uid(), practice_id)
    OR is_system_admin()
  );

-- Update policy_completions RLS
DROP POLICY IF EXISTS "Users can view their own policy completions" ON public.policy_completions;
DROP POLICY IF EXISTS "Users can view own or practice policies" ON public.policy_completions;

CREATE POLICY "Users can view own or practice policies"
  ON public.policy_completions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (practice_id IS NOT NULL AND public.get_policy_library_access(auth.uid(), practice_id) IN ('read', 'edit'))
    OR (practice_id IS NOT NULL AND public.is_practice_manager_for_practice(auth.uid(), practice_id))
    OR is_system_admin()
  );

DROP POLICY IF EXISTS "Users can update their own policy completions" ON public.policy_completions;
DROP POLICY IF EXISTS "Users can update own or practice policies with edit access" ON public.policy_completions;

CREATE POLICY "Users can update own or practice policies with edit access"
  ON public.policy_completions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (practice_id IS NOT NULL AND public.get_policy_library_access(auth.uid(), practice_id) = 'edit')
    OR (practice_id IS NOT NULL AND public.is_practice_manager_for_practice(auth.uid(), practice_id))
    OR is_system_admin()
  );

DROP POLICY IF EXISTS "Users can delete their own policy completions" ON public.policy_completions;
DROP POLICY IF EXISTS "Owner or PM can delete policy completions" ON public.policy_completions;

CREATE POLICY "Owner or PM can delete policy completions"
  ON public.policy_completions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (practice_id IS NOT NULL AND public.is_practice_manager_for_practice(auth.uid(), practice_id))
    OR is_system_admin()
  );

-- Update policy_versions RLS
DROP POLICY IF EXISTS "Users can view own policy versions" ON public.policy_versions;
DROP POLICY IF EXISTS "Users can view own or practice policy versions" ON public.policy_versions;

CREATE POLICY "Users can view own or practice policy versions"
  ON public.policy_versions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.policy_completions pc
      WHERE pc.id = policy_versions.policy_id
        AND pc.practice_id IS NOT NULL
        AND (
          public.get_policy_library_access(auth.uid(), pc.practice_id) IN ('read', 'edit')
          OR public.is_practice_manager_for_practice(auth.uid(), pc.practice_id)
        )
    )
    OR is_system_admin()
  );

DROP POLICY IF EXISTS "Users can update own policy versions" ON public.policy_versions;
DROP POLICY IF EXISTS "Users can update own or practice policy versions" ON public.policy_versions;

CREATE POLICY "Users can update own or practice policy versions"
  ON public.policy_versions FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.policy_completions pc
      WHERE pc.id = policy_versions.policy_id
        AND pc.practice_id IS NOT NULL
        AND (
          public.get_policy_library_access(auth.uid(), pc.practice_id) = 'edit'
          OR public.is_practice_manager_for_practice(auth.uid(), pc.practice_id)
        )
    )
    OR is_system_admin()
  );