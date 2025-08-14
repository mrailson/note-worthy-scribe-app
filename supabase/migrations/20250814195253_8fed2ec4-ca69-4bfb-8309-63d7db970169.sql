-- Fix Critical Security Issues

-- 1. Fix contractor data security - Add proper RLS policies
CREATE TABLE IF NOT EXISTS public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  email text,
  phone text,
  location text,
  trade_specialization text,
  availability_status text DEFAULT 'available',
  rating numeric(2,1),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on contractors table
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contractors
DROP POLICY IF EXISTS "Authenticated users can view contractors" ON public.contractors;
DROP POLICY IF EXISTS "Practice managers can manage contractors" ON public.contractors;

CREATE POLICY "Authenticated users can view contractors" 
ON public.contractors 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Practice managers can create contractors" 
ON public.contractors 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can update contractors" 
ON public.contractors 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role) OR
  created_by = auth.uid()
);

-- Update contractor_resumes RLS policies
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

-- Update contractor_experience RLS policies
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

-- Update contractor_recommendations RLS policies
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

-- Update contractor_notes RLS policies 
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

-- 2. Fix staff data security - Add proper RLS policies for staff_members
CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  first_name text,
  last_name text,
  email text,
  phone text,
  role text,
  hourly_rate numeric(8,2),
  practice_id uuid,
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS on staff_members table
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staff_members
DROP POLICY IF EXISTS "Practice managers can view staff for their practices" ON public.staff_members;
DROP POLICY IF EXISTS "Practice managers can manage staff for their practices" ON public.staff_members;

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
);

-- 3. Fix staff scheduling data security
CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid,
  assignment_date date,
  start_time time,
  end_time time,
  hours_worked numeric(4,2),
  practice_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on staff_assignments table
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;

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
);

-- Create shift_templates table if needed
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id uuid,
  template_name text,
  start_time time,
  end_time time,
  role_required text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on shift_templates table
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice managers can view shift templates for their practices" 
ON public.shift_templates 
FOR SELECT 
TO authenticated
USING (
  practice_id = ANY (get_user_practice_ids(auth.uid())) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can manage shift templates for their practices" 
ON public.shift_templates 
FOR ALL 
TO authenticated
USING (
  (practice_id = ANY (get_user_practice_ids(auth.uid())) AND 
   has_role(auth.uid(), 'practice_manager'::app_role)) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Create replacement_shifts table if needed
CREATE TABLE IF NOT EXISTS public.replacement_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_staff_id uuid,
  replacement_staff_id uuid,
  shift_date date,
  practice_id uuid,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on replacement_shifts table
ALTER TABLE public.replacement_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice managers can view replacements for their practices" 
ON public.replacement_shifts 
FOR SELECT 
TO authenticated
USING (
  practice_id = ANY (get_user_practice_ids(auth.uid())) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "Practice managers can manage replacements for their practices" 
ON public.replacement_shifts 
FOR ALL 
TO authenticated
USING (
  (practice_id = ANY (get_user_practice_ids(auth.uid())) AND 
   has_role(auth.uid(), 'practice_manager'::app_role)) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- 4. Fix security settings visibility - Update existing policies
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
USING (is_system_admin(auth.uid()));

-- 5. Fix staff hours summary visibility - Update existing policies
DROP POLICY IF EXISTS "Authenticated users can view hours summary" ON public.staff_hours_summary;
DROP POLICY IF EXISTS "System can manage hours summary" ON public.staff_hours_summary;

CREATE POLICY "Practice managers can view hours summary for their practices" 
ON public.staff_hours_summary 
FOR SELECT 
TO authenticated
USING (
  staff_member_id IN (
    SELECT id FROM public.staff_members 
    WHERE practice_id = ANY (get_user_practice_ids(auth.uid()))
  ) OR
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "System can manage hours summary" 
ON public.staff_hours_summary 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'system_admin'::app_role));

-- 6. Fix function search path issues - Update critical functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_practice_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY_AGG(DISTINCT practice_id)
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND practice_id IS NOT NULL;
$$;