-- Add branch_sites column for multiple branch sites support
ALTER TABLE public.practice_details 
ADD COLUMN IF NOT EXISTS branch_sites JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single branch site data to the new array format
UPDATE public.practice_details
SET branch_sites = jsonb_build_array(
  jsonb_build_object(
    'name', COALESCE(branch_site_name, ''),
    'address', COALESCE(branch_site_address, ''),
    'postcode', COALESCE(branch_site_postcode, ''),
    'phone', COALESCE(branch_site_phone, '')
  )
)
WHERE has_branch_site = true 
  AND (branch_site_name IS NOT NULL OR branch_site_address IS NOT NULL)
  AND (branch_sites IS NULL OR branch_sites = '[]'::jsonb);

-- Add comment for documentation
COMMENT ON COLUMN public.practice_details.branch_sites IS 'Array of branch site objects with name, address, postcode, and phone fields';