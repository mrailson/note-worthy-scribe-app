-- Fix the remaining contractor_competencies table security issue

-- Enable RLS on contractor_competencies table if not already enabled
ALTER TABLE public.contractor_competencies ENABLE ROW LEVEL SECURITY;

-- Drop any existing public access policies first
DROP POLICY IF EXISTS "System can manage contractor competencies" ON public.contractor_competencies;
DROP POLICY IF EXISTS "Users can view contractor competencies" ON public.contractor_competencies;

-- Add secure policies for contractor_competencies
CREATE POLICY "Authorized users can view contractor competencies" 
ON public.contractor_competencies 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

CREATE POLICY "System can manage contractor competencies" 
ON public.contractor_competencies 
FOR ALL 
TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
);