-- Create enum for service types
CREATE TYPE public.service_type AS ENUM ('ai4pm', 'ai4gp', 'nres', 'meeting_recorder', 'complaints', 'cqc');

-- Create user_service_activations table
CREATE TABLE public.user_service_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service service_type NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  activated_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, service)
);

-- Enable RLS
ALTER TABLE public.user_service_activations ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check service activation
CREATE OR REPLACE FUNCTION public.has_service_activation(_user_id UUID, _service service_type)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_service_activations
    WHERE user_id = _user_id
      AND service = _service
  )
$$;

-- Policy: Users can view their own service activations
CREATE POLICY "Users can view own service activations"
ON public.user_service_activations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Only system admins can insert service activations
CREATE POLICY "Only admins can insert service activations"
ON public.user_service_activations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'system_admin'::app_role
  )
);

-- Policy: Only system admins can update service activations
CREATE POLICY "Only admins can update service activations"
ON public.user_service_activations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'system_admin'::app_role
  )
);

-- Policy: Only system admins can delete service activations
CREATE POLICY "Only admins can delete service activations"
ON public.user_service_activations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'system_admin'::app_role
  )
);

-- Create index for faster lookups
CREATE INDEX idx_user_service_activations_user_service 
ON public.user_service_activations(user_id, service);

-- Create trigger for updated_at
CREATE TRIGGER update_user_service_activations_updated_at
BEFORE UPDATE ON public.user_service_activations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();