-- Create enum for available modules
CREATE TYPE public.app_module AS ENUM (
  'gp_scribe',
  'meeting_recorder', 
  'complaints_system',
  'ai_4_pm',
  'enhanced_access'
);

-- Create user modules table to track which modules users have access to
CREATE TABLE public.user_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module app_module NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

-- Users can view their own modules
CREATE POLICY "Users can view their own modules"
ON public.user_modules
FOR SELECT
USING (auth.uid() = user_id);

-- System admins can manage all modules
CREATE POLICY "System admins can manage all modules"
ON public.user_modules
FOR ALL
USING (is_system_admin());

-- Users can view modules for their practice users (if they're practice managers)
CREATE POLICY "Practice managers can view practice user modules"
ON public.user_modules
FOR SELECT
USING (
  user_id IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.practice_id = ANY(get_user_practice_ids(auth.uid()))
  )
);

-- Add trigger for updating timestamps
CREATE TRIGGER update_user_modules_updated_at
  BEFORE UPDATE ON public.user_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to grant module access to a user
CREATE OR REPLACE FUNCTION public.grant_user_module(
  p_user_id UUID,
  p_module app_module,
  p_granted_by UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  module_id UUID;
BEGIN
  -- Insert or update module access
  INSERT INTO public.user_modules (user_id, module, enabled, granted_by)
  VALUES (p_user_id, p_module, true, p_granted_by)
  ON CONFLICT (user_id, module) 
  DO UPDATE SET 
    enabled = true,
    granted_by = p_granted_by,
    updated_at = now()
  RETURNING id INTO module_id;
  
  -- Log the module grant
  PERFORM public.log_system_activity(
    'user_modules',
    'MODULE_GRANTED',
    p_user_id,
    NULL,
    jsonb_build_object(
      'module', p_module,
      'granted_by', p_granted_by
    )
  );
  
  RETURN module_id;
END;
$$;

-- Function to revoke module access from a user
CREATE OR REPLACE FUNCTION public.revoke_user_module(
  p_user_id UUID,
  p_module app_module
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE public.user_modules
  SET enabled = false, updated_at = now()
  WHERE user_id = p_user_id AND module = p_module;
  
  -- Log the module revocation
  PERFORM public.log_system_activity(
    'user_modules',
    'MODULE_REVOKED',
    p_user_id,
    jsonb_build_object('module', p_module),
    NULL
  );
  
  RETURN FOUND;
END;
$$;

-- Function to check if user has module access
CREATE OR REPLACE FUNCTION public.user_has_module_access(
  p_user_id UUID,
  p_module app_module
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_modules
    WHERE user_id = p_user_id
      AND module = p_module
      AND enabled = true
  );
$$;

-- Function to get user's enabled modules
CREATE OR REPLACE FUNCTION public.get_user_modules(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(module app_module, granted_at TIMESTAMP WITH TIME ZONE, granted_by UUID)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
  SELECT um.module, um.granted_at, um.granted_by
  FROM public.user_modules um
  WHERE um.user_id = p_user_id
    AND um.enabled = true
  ORDER BY um.granted_at DESC;
$$;