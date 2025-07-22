-- Fix complaint system RLS policies to enforce practice-level data segregation
-- This is critical for NHS IT Governance compliance

-- First, drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view complaints" ON public.complaints;
DROP POLICY IF EXISTS "Authenticated users can view audit log" ON public.complaint_audit_log;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.complaint_documents;
DROP POLICY IF EXISTS "Authenticated users can view complaint notes" ON public.complaint_notes;
DROP POLICY IF EXISTS "Authenticated users can view responses" ON public.complaint_responses;

-- Create practice-aware complaint viewing policies
CREATE POLICY "Users can view complaints for their practice or created by them" 
ON public.complaints 
FOR SELECT 
USING (
  -- System admins can see all
  is_system_admin() OR
  -- Complaints managers can see complaints for their practice
  (has_role(auth.uid(), 'complaints_manager'::app_role) AND 
   practice_id = get_practice_manager_practice_id()) OR
  -- Users can see their own complaints
  created_by = auth.uid() OR
  -- Practice staff can see complaints for their practice
  (practice_id IN (
    SELECT ur.practice_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  ))
);

-- Create practice-aware audit log viewing
CREATE POLICY "Users can view audit log for their practice complaints" 
ON public.complaint_audit_log 
FOR SELECT 
USING (
  is_system_admin() OR
  (complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.practice_id IN (
      SELECT ur.practice_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid()
  ))
);

-- Create practice-aware document viewing
CREATE POLICY "Users can view documents for their practice complaints" 
ON public.complaint_documents 
FOR SELECT 
USING (
  is_system_admin() OR
  (complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.practice_id IN (
      SELECT ur.practice_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid()
  ))
);

-- Create practice-aware notes viewing
CREATE POLICY "Users can view notes for their practice complaints" 
ON public.complaint_notes 
FOR SELECT 
USING (
  is_system_admin() OR
  (complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.practice_id IN (
      SELECT ur.practice_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid()
  ))
);

-- Create practice-aware responses viewing
CREATE POLICY "Users can view responses for their practice complaints" 
ON public.complaint_responses 
FOR SELECT 
USING (
  is_system_admin() OR
  (complaint_id IN (
    SELECT c.id FROM public.complaints c
    WHERE c.practice_id IN (
      SELECT ur.practice_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid()
    ) OR c.created_by = auth.uid()
  ))
);