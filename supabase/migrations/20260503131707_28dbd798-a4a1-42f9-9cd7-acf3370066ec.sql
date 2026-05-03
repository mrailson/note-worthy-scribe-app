
-- 1. approval_audit_log: tighten INSERT to documents owned by inserter
DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON public.approval_audit_log;
CREATE POLICY "Users can insert audit entries for own documents"
ON public.approval_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  document_id IN (SELECT id FROM public.approval_documents WHERE sender_id = auth.uid())
);

-- 2. nres_board_members / nres_board_actions / nres_board_action_documents: scope SELECT
DROP POLICY IF EXISTS "Users can view board members" ON public.nres_board_members;
CREATE POLICY "Users can view own or admin board members"
ON public.nres_board_members
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_nres_admin());

DROP POLICY IF EXISTS "Authenticated users can view all board actions" ON public.nres_board_actions;
CREATE POLICY "Users can view own or admin board actions"
ON public.nres_board_actions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_nres_admin());

DROP POLICY IF EXISTS "Users can view action documents" ON public.nres_board_action_documents;
CREATE POLICY "Users can view own or admin action documents"
ON public.nres_board_action_documents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_nres_admin());

-- 3. meeting_attendance: scope INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON public.meeting_attendance;
CREATE POLICY "Users can insert attendance they record"
ON public.meeting_attendance
FOR INSERT
TO authenticated
WITH CHECK (recorded_by = auth.uid() OR public.is_nres_admin());

DROP POLICY IF EXISTS "Authenticated users can update attendance" ON public.meeting_attendance;
CREATE POLICY "Recorders or admins can update attendance"
ON public.meeting_attendance
FOR UPDATE
TO authenticated
USING (recorded_by = auth.uid() OR public.is_nres_admin())
WITH CHECK (recorded_by = auth.uid() OR public.is_nres_admin());

-- 4. enn_insurance_checklist: restrict UPDATE to admins
DROP POLICY IF EXISTS "Authenticated users can update insurance checklist" ON public.enn_insurance_checklist;
CREATE POLICY "Admins can update insurance checklist"
ON public.enn_insurance_checklist
FOR UPDATE
TO authenticated
USING (public.is_system_admin(auth.uid()) OR public.is_nres_admin())
WITH CHECK (public.is_system_admin(auth.uid()) OR public.is_nres_admin());

-- 5. nres_recruitment_audit: scope SELECT to admins, restrict INSERT to authenticated NRES admin or recruiter (admin-only here)
DROP POLICY IF EXISTS "Authenticated users can read recruitment audit" ON public.nres_recruitment_audit;
CREATE POLICY "Admins can read recruitment audit"
ON public.nres_recruitment_audit
FOR SELECT
TO authenticated
USING (public.is_nres_admin() OR public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert recruitment audit" ON public.nres_recruitment_audit;
CREATE POLICY "Admins can insert recruitment audit"
ON public.nres_recruitment_audit
FOR INSERT
TO authenticated
WITH CHECK (public.is_nres_admin() OR public.is_system_admin(auth.uid()));

-- 6. domain_dictionary: restrict writes to system admins
DROP POLICY IF EXISTS "Authenticated users can insert dictionary entries" ON public.domain_dictionary;
DROP POLICY IF EXISTS "Authenticated users can update dictionary entries" ON public.domain_dictionary;
DROP POLICY IF EXISTS "Authenticated users can delete dictionary entries" ON public.domain_dictionary;
CREATE POLICY "Admins can insert dictionary entries"
ON public.domain_dictionary FOR INSERT TO authenticated
WITH CHECK (public.is_system_admin(auth.uid()));
CREATE POLICY "Admins can update dictionary entries"
ON public.domain_dictionary FOR UPDATE TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));
CREATE POLICY "Admins can delete dictionary entries"
ON public.domain_dictionary FOR DELETE TO authenticated
USING (public.is_system_admin(auth.uid()));

-- 7. contractor-documents storage bucket: enforce per-user folder ownership
DROP POLICY IF EXISTS "Authenticated can view contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete contractor documents" ON storage.objects;

CREATE POLICY "Users can view own contractor documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contractor-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_system_admin(auth.uid()))
);
CREATE POLICY "Users can upload own contractor documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contractor-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update own contractor documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contractor-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_system_admin(auth.uid()))
);
CREATE POLICY "Users can delete own contractor documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contractor-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_system_admin(auth.uid()))
);
