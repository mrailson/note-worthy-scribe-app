-- Add organization_type column to attendees table
ALTER TABLE public.attendees 
ADD COLUMN organization_type TEXT 
CHECK (organization_type IN ('practice', 'neighbourhood_pcn', 'icn', 'nhse', 'other'));

-- Add a comment to explain the field
COMMENT ON COLUMN public.attendees.organization_type IS 'Type of organization: practice, neighbourhood_pcn, icn, nhse, or other';

-- Migrate existing data: set organization_type based on organization field content
UPDATE public.attendees
SET organization_type = CASE
  WHEN LOWER(organization) LIKE '%pcn%' OR LOWER(organization) LIKE '%neighbourhood%' THEN 'neighbourhood_pcn'
  WHEN LOWER(organization) LIKE '%icn%' THEN 'icn'
  WHEN LOWER(organization) LIKE '%nhs%' OR LOWER(organization) LIKE '%nhse%' THEN 'nhse'
  WHEN LOWER(organization) LIKE '%practice%' OR LOWER(organization) LIKE '%surgery%' THEN 'practice'
  ELSE 'other'
END
WHERE organization_type IS NULL AND organization IS NOT NULL;

-- Set default for records with no organization
UPDATE public.attendees
SET organization_type = 'other'
WHERE organization_type IS NULL;