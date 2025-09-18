-- Add Row Level Security policies for bank_holidays_closed_days table

-- Enable RLS on the table (in case it's not already enabled)
ALTER TABLE public.bank_holidays_closed_days ENABLE ROW LEVEL SECURITY;

-- Policy for viewing bank holidays and closed days - restricted to authorized users
CREATE POLICY "Authorized users can view bank holidays and closed days" 
ON public.bank_holidays_closed_days 
FOR SELECT 
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'pcn_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);

-- Policy for managing bank holidays and closed days - restricted to authorized managers
CREATE POLICY "Practice managers can manage bank holidays and closed days" 
ON public.bank_holidays_closed_days 
FOR ALL 
USING (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'pcn_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'practice_manager'::app_role) OR 
  has_role(auth.uid(), 'pcn_manager'::app_role) OR 
  has_role(auth.uid(), 'system_admin'::app_role)
);