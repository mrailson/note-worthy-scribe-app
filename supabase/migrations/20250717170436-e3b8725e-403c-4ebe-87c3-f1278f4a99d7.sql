-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM (
  'system_admin',
  'practice_manager', 
  'gp',
  'administrator',
  'nurse',
  'receptionist',
  'user'
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  practice_id UUID REFERENCES public.practice_details(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role, practice_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'system_admin'
  )
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(role app_role, practice_id UUID, practice_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    ur.role,
    ur.practice_id,
    pd.practice_name
  FROM public.user_roles ur
  LEFT JOIN public.practice_details pd ON ur.practice_id = pd.id
  WHERE ur.user_id = _user_id
$$;

-- Add last_login column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create RLS policies for user_roles

-- System admins can view all user roles
CREATE POLICY "System admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_system_admin());

-- System admins can insert user roles
CREATE POLICY "System admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin());

-- System admins can update user roles
CREATE POLICY "System admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_system_admin());

-- System admins can delete user roles
CREATE POLICY "System admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_system_admin());

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Practice managers can view roles in their practice
CREATE POLICY "Practice managers can view practice roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  practice_id IN (
    SELECT ur.practice_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'practice_manager'
  )
);

-- Update profiles RLS to allow system admins to view all profiles
CREATE POLICY "System admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_system_admin());

-- System admins can update all profiles
CREATE POLICY "System admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_system_admin());

-- Create function to update last login
CREATE OR REPLACE FUNCTION public.update_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET last_login = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Create trigger to update last login when user signs in
CREATE OR REPLACE TRIGGER on_auth_user_signin
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.update_last_login();