-- Add enhanced_access and cqc_compliance_access columns to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN enhanced_access boolean DEFAULT false,
ADD COLUMN cqc_compliance_access boolean DEFAULT false;