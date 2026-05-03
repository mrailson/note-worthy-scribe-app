
-- 1. fridge_temperature_alerts: drop public read
DROP POLICY IF EXISTS "Public can view temperature alerts for readings" ON public.fridge_temperature_alerts;

-- 2. nres_system_roles: drop broad read, restrict to own row (admin policy already exists)
DROP POLICY IF EXISTS "Authenticated can read system roles" ON public.nres_system_roles;
CREATE POLICY "Users can read their own system role"
ON public.nres_system_roles
FOR SELECT
TO authenticated
USING (lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 3. claim_audit_log: replace open insert with scoped insert
DROP POLICY IF EXISTS "audit_insert" ON public.claim_audit_log;
CREATE POLICY "audit_insert_scoped"
ON public.claim_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_nres_claims_read_role(public.auth_email())
  OR claim_line_id IN (
    SELECT id FROM public.claim_lines
    WHERE submitted_by = public.auth_email() OR declared_by = public.auth_email()
  )
);

-- 4. approval_audit_log: drop anon insert
DROP POLICY IF EXISTS "Anon can insert audit entries" ON public.approval_audit_log;

-- 5. inbound_emails: drop wide-open policies, scope to practice managers/complaints managers
DROP POLICY IF EXISTS "Authenticated users can view inbound emails" ON public.inbound_emails;
DROP POLICY IF EXISTS "Authenticated users can update inbound emails" ON public.inbound_emails;
DROP POLICY IF EXISTS "Authenticated users can delete inbound emails" ON public.inbound_emails;

CREATE POLICY "Practice members can view inbound emails"
ON public.inbound_emails
FOR SELECT
TO authenticated
USING (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can update inbound emails"
ON public.inbound_emails
FOR UPDATE
TO authenticated
USING (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'practice_manager'::app_role)
    OR public.has_role(auth.uid(), 'complaints_manager'::app_role)
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
  )
)
WITH CHECK (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
);

CREATE POLICY "Practice managers can delete inbound emails"
ON public.inbound_emails
FOR DELETE
TO authenticated
USING (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'practice_manager'::app_role)
    OR public.has_role(auth.uid(), 'complaints_manager'::app_role)
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
  )
);

-- 6. nres_candidate_feedback: drop broad read, restrict to own + admins
DROP POLICY IF EXISTS "Users can view all candidate feedback" ON public.nres_candidate_feedback;
CREATE POLICY "Users can view their own feedback or admins all"
ON public.nres_candidate_feedback
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_nres_admin(auth.uid())
);

-- 7. compliments: scope by practice membership
DROP POLICY IF EXISTS "Authenticated users can view compliments" ON public.compliments;
DROP POLICY IF EXISTS "Authenticated users can update compliments" ON public.compliments;

CREATE POLICY "Practice members can view compliments"
ON public.compliments
FOR SELECT
TO authenticated
USING (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice members can update compliments"
ON public.compliments
FOR UPDATE
TO authenticated
USING (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  OR public.has_role(auth.uid(), 'system_admin'::app_role)
);

-- 8. Storage: contractor-documents — require auth
DROP POLICY IF EXISTS "Users can view contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update contractor documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete contractor documents" ON storage.objects;

CREATE POLICY "Authenticated can view contractor documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contractor-documents');

CREATE POLICY "Authenticated can upload contractor documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contractor-documents');

CREATE POLICY "Authenticated can update contractor documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contractor-documents');

CREATE POLICY "Authenticated can delete contractor documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contractor-documents');

-- 9. Storage: inbound-email-attachments — require auth + practice ownership via inbound_emails
DROP POLICY IF EXISTS "Authenticated users can read inbound email attachments" ON storage.objects;

CREATE POLICY "Practice members can read inbound email attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inbound-email-attachments'
  AND (
    public.has_role(auth.uid(), 'system_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.inbound_emails ie
      WHERE ie.practice_id = ANY (public.get_user_practice_ids(auth.uid()))
        AND (objects.name LIKE ie.id::text || '/%' OR objects.name LIKE '%/' || ie.id::text || '/%')
    )
  )
);

-- 10. Storage: lg bucket — path-based ownership (first folder segment = uid)
DROP POLICY IF EXISTS "Authenticated users can read lg images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own lg files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lg images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own lg files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete lg images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own lg files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload lg images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own lg folder" ON storage.objects;

CREATE POLICY "Owners can read lg files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lg'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
  )
);

CREATE POLICY "Owners can upload lg files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lg'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update lg files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lg'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
  )
);

CREATE POLICY "Owners can delete lg files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lg'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
  )
);

-- 11. Storage: claim-evidence bucket — path-based ownership
DROP POLICY IF EXISTS "claim_evidence_read" ON storage.objects;
DROP POLICY IF EXISTS "claim_evidence_upload" ON storage.objects;

CREATE POLICY "Owners can read claim evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'claim-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_nres_admin(auth.uid())
  )
);

CREATE POLICY "Owners can upload claim evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'claim-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
