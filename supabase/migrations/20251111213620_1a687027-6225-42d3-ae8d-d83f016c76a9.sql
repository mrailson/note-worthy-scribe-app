-- Drop the old check constraint that's blocking LMC/ICB/Other org types
ALTER TABLE public.attendees DROP CONSTRAINT IF EXISTS attendees_organization_type_check;

-- Add new check constraint that allows all organization types used in the UI
ALTER TABLE public.attendees ADD CONSTRAINT attendees_organization_type_check 
CHECK (organization_type IS NULL OR organization_type IN (
  'practice',
  'neighbourhood_pcn',
  'icb',
  'lmc',
  'nhse',
  'other'
));