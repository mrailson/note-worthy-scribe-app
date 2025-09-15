-- Fix complaint data security vulnerabilities
-- Remove conflicting policies and implement proper role-based access control

-- First, drop all existing complaint table policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "System admins and practice users can create complaints" ON public.complaints;
DROP POLICY IF EXISTS "System admins and practice users can view complaints" ON public.complaints;
DROP POLICY IF EXISTS "System admins and practice users can update complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can view complaints for their practice or created by them" ON public.complaints;
DROP POLICY IF EXISTS "Complaints managers and admins can update complaints" ON public.complaints;

-- Create secure, role-based policies for complaints table
CREATE POLICY "Authorized users can create complaints" ON public.complaints
FOR INSERT TO authenticated
WITH CHECK (
  -- Only system admins, practice managers, or complaints managers can create complaints
  is_system_admin(auth.uid()) OR 
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'complaints_manager'::app_role) OR
  -- Or users assigned to the practice where complaint is being created
  (practice_id = ANY (get_user_practice_ids(auth.uid())))
);

CREATE POLICY "Authorized users can view complaints" ON public.complaints
FOR SELECT TO authenticated
USING (
  -- System admins can see all
  is_system_admin(auth.uid()) OR
  -- Users can see complaints for their practices only
  (practice_id = ANY (get_user_practice_ids(auth.uid()))) OR
  -- Complaint creators can see their own
  (created_by = auth.uid())
);

CREATE POLICY "Authorized users can update complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (
  -- System admins can update all
  is_system_admin(auth.uid()) OR
  -- Practice/complaints managers can update complaints in their practices
  (has_role(auth.uid(), 'practice_manager'::app_role) AND practice_id = ANY (get_user_practice_ids(auth.uid()))) OR
  (has_role(auth.uid(), 'complaints_manager'::app_role) AND practice_id = ANY (get_user_practice_ids(auth.uid()))) OR
  -- Creators can update their own complaints
  (created_by = auth.uid())
);

-- Fix complaint_templates security - restrict access to authorized users only
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.complaint_templates;
CREATE POLICY "Authorized users can view complaint templates" ON public.complaint_templates
FOR SELECT TO authenticated
USING (
  -- Only system admins, practice managers, or complaints managers can view templates
  is_system_admin(auth.uid()) OR 
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'complaints_manager'::app_role)
);

-- Fix complaint_signatures - ensure practice membership verification
DROP POLICY IF EXISTS "Users can view their own signatures" ON public.complaint_signatures;
CREATE POLICY "Authorized users can view complaint signatures" ON public.complaint_signatures
FOR SELECT TO authenticated
USING (
  -- Users can only see signatures for practices they're assigned to
  (auth.uid() = user_id) AND 
  (practice_id IS NULL OR practice_id = ANY (get_user_practice_ids(auth.uid())))
);

-- Strengthen complaint_involved_parties access control
DROP POLICY IF EXISTS "Authenticated users can manage involved parties" ON public.complaint_involved_parties;
CREATE POLICY "Authorized managers can manage involved parties" ON public.complaint_involved_parties
FOR ALL TO authenticated
USING (
  -- Only system admins, practice managers, or complaints managers
  is_system_admin(auth.uid()) OR
  (has_role(auth.uid(), 'practice_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))) OR
  (has_role(auth.uid(), 'complaints_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))))
)
WITH CHECK (
  is_system_admin(auth.uid()) OR
  (has_role(auth.uid(), 'practice_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))) OR
  (has_role(auth.uid(), 'complaints_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))))
);

-- Strengthen complaint_compliance_checks access control
DROP POLICY IF EXISTS "Authenticated users can manage compliance checks" ON public.complaint_compliance_checks;
CREATE POLICY "Authorized managers can manage compliance checks" ON public.complaint_compliance_checks
FOR ALL TO authenticated
USING (
  -- Only system admins, practice managers, or complaints managers
  is_system_admin(auth.uid()) OR
  (has_role(auth.uid(), 'practice_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))) OR
  (has_role(auth.uid(), 'complaints_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))))
)
WITH CHECK (
  is_system_admin(auth.uid()) OR
  (has_role(auth.uid(), 'practice_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid())))) OR
  (has_role(auth.uid(), 'complaints_manager'::app_role) AND 
   complaint_id IN (SELECT c.id FROM complaints c WHERE c.practice_id = ANY (get_user_practice_ids(auth.uid()))))
);