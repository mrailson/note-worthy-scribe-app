DROP POLICY IF EXISTS "View risk assessments for own complaints" ON public.complaint_indemnity_risk_assessments;
DROP POLICY IF EXISTS "Insert risk assessments for own complaints" ON public.complaint_indemnity_risk_assessments;
DROP POLICY IF EXISTS "Update risk assessments for own complaints" ON public.complaint_indemnity_risk_assessments;
DROP POLICY IF EXISTS "Delete risk assessments for own complaints" ON public.complaint_indemnity_risk_assessments;

CREATE POLICY "View risk assessments for authorised complaints"
ON public.complaint_indemnity_risk_assessments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_indemnity_risk_assessments.complaint_id
      AND (
        public.is_system_admin(auth.uid())
        OR c.created_by = auth.uid()
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'practice_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'complaints_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.complaints_manager_access = true
          )
        )
      )
  )
);

CREATE POLICY "Create risk assessments for authorised complaints"
ON public.complaint_indemnity_risk_assessments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_indemnity_risk_assessments.complaint_id
      AND (
        public.is_system_admin(auth.uid())
        OR c.created_by = auth.uid()
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'practice_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'complaints_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.complaints_manager_access = true
          )
        )
      )
  )
);

CREATE POLICY "Update risk assessments for authorised complaints"
ON public.complaint_indemnity_risk_assessments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_indemnity_risk_assessments.complaint_id
      AND (
        public.is_system_admin(auth.uid())
        OR c.created_by = auth.uid()
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'practice_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'complaints_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.complaints_manager_access = true
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_indemnity_risk_assessments.complaint_id
      AND (
        public.is_system_admin(auth.uid())
        OR c.created_by = auth.uid()
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'practice_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'complaints_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.complaints_manager_access = true
          )
        )
      )
  )
);

CREATE POLICY "Delete risk assessments for authorised complaints"
ON public.complaint_indemnity_risk_assessments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.complaints c
    WHERE c.id = complaint_indemnity_risk_assessments.complaint_id
      AND (
        public.is_system_admin(auth.uid())
        OR c.created_by = auth.uid()
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'practice_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND public.has_role(auth.uid(), 'complaints_manager'::public.app_role)
        )
        OR (
          c.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.complaints_manager_access = true
          )
        )
      )
  )
);