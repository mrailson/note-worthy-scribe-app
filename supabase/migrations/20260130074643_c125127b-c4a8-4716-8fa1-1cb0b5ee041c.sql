-- Add entered_by column to nres_hours_entries for audit tracking
-- This records who entered the time claim (may differ from user_id which is the claimant)
ALTER TABLE public.nres_hours_entries 
ADD COLUMN entered_by uuid REFERENCES auth.users(id);

-- Set existing entries' entered_by to the user_id (assumed self-entry)
UPDATE public.nres_hours_entries 
SET entered_by = user_id 
WHERE entered_by IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.nres_hours_entries.entered_by IS 'The user who entered/created this time entry (for audit purposes)';