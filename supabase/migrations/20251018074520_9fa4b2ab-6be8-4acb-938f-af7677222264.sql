-- Create system settings table
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only system admins can manage settings
CREATE POLICY "System admins can manage settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Insert default setting for consultation examples
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
  'consultation_examples_visibility',
  '{"enabled": true}'::jsonb,
  'Controls whether GP consultation examples and patient meeting type are available'
);

-- Add column to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN show_consultation_examples BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.user_roles.show_consultation_examples IS 
'User-specific override for consultation examples visibility. NULL = use system default, true = always show, false = always hide';

-- Create helper function to check consultation examples visibility
CREATE OR REPLACE FUNCTION public.can_view_consultation_examples(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_override BOOLEAN;
  system_default BOOLEAN;
BEGIN
  -- Get user-specific override from any of their roles
  SELECT show_consultation_examples INTO user_override
  FROM public.user_roles
  WHERE user_id = _user_id
    AND show_consultation_examples IS NOT NULL
  LIMIT 1;
  
  -- If user has an explicit override, use it
  IF user_override IS NOT NULL THEN
    RETURN user_override;
  END IF;
  
  -- Otherwise, check system default
  SELECT (setting_value->>'enabled')::boolean INTO system_default
  FROM public.system_settings
  WHERE setting_key = 'consultation_examples_visibility';
  
  -- Return system default (or true if setting doesn't exist)
  RETURN COALESCE(system_default, true);
END;
$$;