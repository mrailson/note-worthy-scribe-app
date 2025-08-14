-- Fix Critical Security Issues - Clean up existing policies and implement secure access

-- 1. Fix contractor data security
-- Drop all existing insecure policies for contractors
DROP POLICY IF EXISTS "Users can create contractors" ON public.contractors;
DROP POLICY IF EXISTS "Users can delete contractors they created" ON public.contractors;
DROP POLICY IF EXISTS "Users can update contractors" ON public.contractors;

-- Add secure policies for contractors (keeping the already secure view policy)
CREATE POLICY "Authorized users can create contractors" 
ON public.contractors 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Authorized users can update contractors" 
ON public.contractors 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role) OR
  user_id = auth.uid()
);

CREATE POLICY "Authorized users can delete contractors" 
ON public.contractors 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role) OR
  user_id = auth.uid()
);

-- Fix contractor_resumes policies
DROP POLICY IF EXISTS "Users can upload contractor resumes" ON public.contractor_resumes;
DROP POLICY IF EXISTS "Users can view contractor resumes" ON public.contractor_resumes;

CREATE POLICY "Authorized users can upload contractor resumes" 
ON public.contractor_resumes 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = uploaded_by AND (
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'system_admin'::app_role)
  )
);

CREATE POLICY "Authorized users can view contractor resumes" 
ON public.contractor_resumes 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role) OR
  uploaded_by = auth.uid()
);

-- Fix contractor_experience policies
DROP POLICY IF EXISTS "System can manage contractor experience" ON public.contractor_experience;
DROP POLICY IF EXISTS "Users can view contractor experience" ON public.contractor_experience;

CREATE POLICY "Authorized users can view contractor experience" 
ON public.contractor_experience 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "System can manage contractor experience" 
ON public.contractor_experience 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Fix contractor_recommendations policies
DROP POLICY IF EXISTS "System can manage contractor recommendations" ON public.contractor_recommendations;
DROP POLICY IF EXISTS "Users can view contractor recommendations" ON public.contractor_recommendations;

CREATE POLICY "Authorized users can view contractor recommendations" 
ON public.contractor_recommendations 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "System can manage contractor recommendations" 
ON public.contractor_recommendations 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Fix contractor_notes policies 
DROP POLICY IF EXISTS "Users can create contractor notes" ON public.contractor_notes;
DROP POLICY IF EXISTS "Users can update their own contractor notes" ON public.contractor_notes;
DROP POLICY IF EXISTS "Users can view contractor notes" ON public.contractor_notes;

CREATE POLICY "Authorized users can create contractor notes" 
ON public.contractor_notes 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'system_admin'::app_role)
  )
);

CREATE POLICY "Authorized users can update contractor notes" 
ON public.contractor_notes 
FOR UPDATE 
TO authenticated
USING (
  auth.uid() = user_id AND (
    has_role(auth.uid(), 'practice_manager'::app_role) OR 
    has_role(auth.uid(), 'system_admin'::app_role)
  )
);

CREATE POLICY "Authorized users can view contractor notes" 
ON public.contractor_notes 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role) OR
  user_id = auth.uid()
);

-- 2. Fix staff_members security - Drop insecure policies
DROP POLICY IF EXISTS "Authenticated users can view staff members" ON public.staff_members;
DROP POLICY IF EXISTS "PCN and practice managers can insert staff members" ON public.staff_members;
DROP POLICY IF EXISTS "PCN and practice managers can update staff members" ON public.staff_members;
DROP POLICY IF EXISTS "PCN and practice managers can delete staff members" ON public.staff_members;

CREATE POLICY "Practice managers can view staff for their practices" 
ON public.staff_members 
FOR SELECT 
TO authenticated
USING (
  practice_id = ANY (get_user_practice_ids(auth.uid())) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can manage staff for their practices" 
ON public.staff_members 
FOR ALL 
TO authenticated
USING (
  (practice_id = ANY (get_user_practice_ids(auth.uid())) AND 
   has_role(auth.uid(), 'practice_manager'::app_role)) OR
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  (practice_id = ANY (get_user_practice_ids(auth.uid())) AND 
   has_role(auth.uid(), 'practice_manager'::app_role)) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- 3. Fix staff scheduling data security
DROP POLICY IF EXISTS "Authenticated users can view staff assignments" ON public.staff_assignments;
DROP POLICY IF EXISTS "Practice managers can manage staff assignments" ON public.staff_assignments;

CREATE POLICY "Practice managers can view assignments for their practices" 
ON public.staff_assignments 
FOR SELECT 
TO authenticated
USING (
  practice_id = ANY (get_user_practice_ids(auth.uid())) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can manage assignments for their practices" 
ON public.staff_assignments 
FOR ALL 
TO authenticated
USING (
  (practice_id = ANY (get_user_practice_ids(auth.uid())) AND 
   has_role(auth.uid(), 'practice_manager'::app_role)) OR
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  (practice_id = ANY (get_user_practice_ids(auth.uid())) AND 
   has_role(auth.uid(), 'practice_manager'::app_role)) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Fix shift_templates policies
DROP POLICY IF EXISTS "Authenticated users can view shift templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Practice managers can manage shift templates" ON public.shift_templates;

CREATE POLICY "Practice managers can view shift templates" 
ON public.shift_templates 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can manage shift templates" 
ON public.shift_templates 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Fix replacement_shifts policies
DROP POLICY IF EXISTS "Authenticated users can view replacement shifts" ON public.replacement_shifts;
DROP POLICY IF EXISTS "System admins can manage replacement shifts" ON public.replacement_shifts;

CREATE POLICY "Practice managers can view replacement shifts" 
ON public.replacement_shifts 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role) OR
  created_by = auth.uid()
);

CREATE POLICY "Practice managers can manage replacement shifts" 
ON public.replacement_shifts 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- 4. Fix security settings visibility
DROP POLICY IF EXISTS "Authenticated users can view security settings" ON public.security_settings;
DROP POLICY IF EXISTS "System admins can manage security settings" ON public.security_settings;

CREATE POLICY "System admins can view security settings" 
ON public.security_settings 
FOR SELECT 
TO authenticated
USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage security settings" 
ON public.security_settings 
FOR ALL 
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- 5. Fix staff hours summary visibility
DROP POLICY IF EXISTS "Authenticated users can view hours summary" ON public.staff_hours_summary;
DROP POLICY IF EXISTS "System can manage hours summary" ON public.staff_hours_summary;

CREATE POLICY "Practice managers can view hours summary for their practices" 
ON public.staff_hours_summary 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "System can manage hours summary" 
ON public.staff_hours_summary 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'system_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'system_admin'::app_role));