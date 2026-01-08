-- Create table for future granular sub-menu access control
CREATE TABLE public.nres_submenu_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submenu_key TEXT NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, submenu_key)
);

-- Enable RLS
ALTER TABLE public.nres_submenu_access ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own submenu access
CREATE POLICY "Users can view their own submenu access"
ON public.nres_submenu_access
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can manage all submenu access
CREATE POLICY "Admins can manage all submenu access"
ON public.nres_submenu_access
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role IN ('system_admin', 'pcn_manager')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_nres_submenu_access_updated_at
BEFORE UPDATE ON public.nres_submenu_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();