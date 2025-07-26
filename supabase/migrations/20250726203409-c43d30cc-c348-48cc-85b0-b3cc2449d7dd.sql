-- Update complaints RLS policy to remove blanket system admin access
-- System admins should only see complaints if assigned to the practice as complaints manager

DROP POLICY IF EXISTS "Users can view complaints for their practice or created by them" ON public.complaints;

CREATE POLICY "Users can view complaints for their practice or created by them" 
ON public.complaints 
FOR SELECT 
USING (
  (created_by = auth.uid()) OR 
  (practice_id = ANY(get_user_practice_ids(auth.uid())))
);

-- Also update other complaint-related tables to follow same principle
DROP POLICY IF EXISTS "Users can view acknowledgements for their practice complaints" ON public.complaint_acknowledgements;
DROP POLICY IF EXISTS "Users can view audit logs for their practice complaints" ON public.complaint_audit_detailed;
DROP POLICY IF EXISTS "Users can view audit log for their practice complaints" ON public.complaint_audit_log;
DROP POLICY IF EXISTS "Users can view compliance audit logs for their practice complai" ON public.complaint_compliance_audit;
DROP POLICY IF EXISTS "Users can view compliance checks for their practice complaints" ON public.complaint_compliance_checks;
DROP POLICY IF EXISTS "Users can view documents for their practice complaints" ON public.complaint_documents;
DROP POLICY IF EXISTS "Users can view involved parties for their practice complaints" ON public.complaint_involved_parties;
DROP POLICY IF EXISTS "Users can view notes for their practice complaints" ON public.complaint_notes;
DROP POLICY IF EXISTS "Users can view outcomes for their practice complaints" ON public.complaint_outcomes;
DROP POLICY IF EXISTS "Users can view responses for their practice complaints" ON public.complaint_responses;

-- Recreate all policies without blanket system admin access
CREATE POLICY "Users can view acknowledgements for their practice complaints" 
ON public.complaint_acknowledgements 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view audit logs for their practice complaints" 
ON public.complaint_audit_detailed 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view audit log for their practice complaints" 
ON public.complaint_audit_log 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view compliance audit logs for their practice complaints" 
ON public.complaint_compliance_audit 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view compliance checks for their practice complaints" 
ON public.complaint_compliance_checks 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view documents for their practice complaints" 
ON public.complaint_documents 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view involved parties for their practice complaints" 
ON public.complaint_involved_parties 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view notes for their practice complaints" 
ON public.complaint_notes 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view outcomes for their practice complaints" 
ON public.complaint_outcomes 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);

CREATE POLICY "Users can view responses for their practice complaints" 
ON public.complaint_responses 
FOR SELECT 
USING (
  complaint_id IN ( 
    SELECT c.id FROM complaints c
    WHERE ((c.practice_id = ANY(get_user_practice_ids(auth.uid()))) OR (c.created_by = auth.uid()))
  )
);