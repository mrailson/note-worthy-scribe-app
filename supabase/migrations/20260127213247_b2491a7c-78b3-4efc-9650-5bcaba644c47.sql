-- Add policy-related personnel columns to practice_details table
-- These fields will be used as default inserts for policy generation

ALTER TABLE public.practice_details 
ADD COLUMN IF NOT EXISTS postcode TEXT,
ADD COLUMN IF NOT EXISTS ods_code TEXT,
ADD COLUMN IF NOT EXISTS practice_manager_name TEXT,
ADD COLUMN IF NOT EXISTS lead_gp_name TEXT,
ADD COLUMN IF NOT EXISTS senior_gp_partner TEXT,
ADD COLUMN IF NOT EXISTS caldicott_guardian TEXT,
ADD COLUMN IF NOT EXISTS dpo_name TEXT,
ADD COLUMN IF NOT EXISTS siro TEXT,
ADD COLUMN IF NOT EXISTS safeguarding_lead_adults TEXT,
ADD COLUMN IF NOT EXISTS safeguarding_lead_children TEXT,
ADD COLUMN IF NOT EXISTS infection_control_lead TEXT,
ADD COLUMN IF NOT EXISTS complaints_lead TEXT,
ADD COLUMN IF NOT EXISTS health_safety_lead TEXT,
ADD COLUMN IF NOT EXISTS fire_safety_officer TEXT,
ADD COLUMN IF NOT EXISTS list_size INTEGER,
ADD COLUMN IF NOT EXISTS services_offered JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.practice_details.postcode IS 'Practice postcode';
COMMENT ON COLUMN public.practice_details.ods_code IS 'NHS ODS organisation code';
COMMENT ON COLUMN public.practice_details.practice_manager_name IS 'Practice Manager full name';
COMMENT ON COLUMN public.practice_details.lead_gp_name IS 'Lead GP / Clinical Lead full name';
COMMENT ON COLUMN public.practice_details.senior_gp_partner IS 'Senior GP Partner full name';
COMMENT ON COLUMN public.practice_details.caldicott_guardian IS 'Caldicott Guardian full name';
COMMENT ON COLUMN public.practice_details.dpo_name IS 'Data Protection Officer full name';
COMMENT ON COLUMN public.practice_details.siro IS 'Senior Information Risk Owner full name';
COMMENT ON COLUMN public.practice_details.safeguarding_lead_adults IS 'Safeguarding Lead (Adults) full name';
COMMENT ON COLUMN public.practice_details.safeguarding_lead_children IS 'Safeguarding Lead (Children) full name';
COMMENT ON COLUMN public.practice_details.infection_control_lead IS 'Infection Control Lead full name';
COMMENT ON COLUMN public.practice_details.complaints_lead IS 'Complaints Lead full name';
COMMENT ON COLUMN public.practice_details.health_safety_lead IS 'Health & Safety Lead full name';
COMMENT ON COLUMN public.practice_details.fire_safety_officer IS 'Fire Safety Officer full name';
COMMENT ON COLUMN public.practice_details.list_size IS 'Registered patient list size';
COMMENT ON COLUMN public.practice_details.services_offered IS 'JSON object of services offered by the practice';