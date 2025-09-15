-- Complete the complaint security fix by strengthening remaining tables

-- Restrict access to complaint documents - only authorized staff
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON public.complaint_documents;
CREATE POLICY "Authorized users can upload complaint documents" ON public.complaint_documents
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can upload documents
  (auth.uid() = uploaded_by) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role) OR
    -- Or users assigned to the practice where complaint belongs
    complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))
  )
);

-- Restrict access to complaint notes - only authorized staff
DROP POLICY IF EXISTS "Authenticated users can create complaint notes" ON public.complaint_notes;
CREATE POLICY "Authorized users can create complaint notes" ON public.complaint_notes
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can create notes
  (auth.uid() = created_by) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role) OR
    -- Or users assigned to the practice where complaint belongs
    complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))
  )
);

-- Restrict access to complaint responses - only authorized staff
DROP POLICY IF EXISTS "Authenticated users can create responses" ON public.complaint_responses;
CREATE POLICY "Authorized users can create complaint responses" ON public.complaint_responses
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can create responses
  (auth.uid() = sent_by) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role) OR
    -- Or users assigned to the practice where complaint belongs
    complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))
  )
);

-- Restrict access to investigation transcripts - only authorized staff
DROP POLICY IF EXISTS "Authenticated users can create investigation transcripts" ON public.complaint_investigation_transcripts;
CREATE POLICY "Authorized users can create investigation transcripts" ON public.complaint_investigation_transcripts
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can create transcripts
  (auth.uid() = transcribed_by) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role) OR
    -- Or users assigned to the practice where complaint belongs
    complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))
  )
);

-- Restrict investigation evidence upload to authorized staff only
DROP POLICY IF EXISTS "Authenticated users can create investigation evidence" ON public.complaint_investigation_evidence;
DROP POLICY IF EXISTS "Authenticated users can upload investigation evidence" ON public.complaint_investigation_evidence;
CREATE POLICY "Authorized users can upload investigation evidence" ON public.complaint_investigation_evidence
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can upload evidence
  (auth.uid() = uploaded_by) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role) OR
    -- Or users assigned to the practice where complaint belongs
    complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))
  )
);

-- Create audit logging policy for sensitive operations
CREATE POLICY "Log sensitive complaint operations" ON public.complaint_audit_log
FOR INSERT TO authenticated
WITH CHECK (
  -- Only authenticated users can create audit logs (system will populate this)
  auth.uid() = performed_by
);

-- Restrict audit detailed logs to system use only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.complaint_audit_detailed;
CREATE POLICY "System can insert detailed audit logs" ON public.complaint_audit_detailed
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins or authorized complaint handlers can create detailed audit logs
  (auth.uid() = user_id) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role)
  )
);

-- Restrict compliance audit logs to authorized staff
DROP POLICY IF EXISTS "System can insert compliance audit logs" ON public.complaint_compliance_audit;
CREATE POLICY "Authorized users can create compliance audit logs" ON public.complaint_compliance_audit
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can create compliance logs
  (auth.uid() = user_id) AND (
    is_system_admin(auth.uid()) OR 
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'complaints_manager'::app_role)
  )
);