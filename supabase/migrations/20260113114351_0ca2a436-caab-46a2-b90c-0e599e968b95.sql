-- Drop the broken foreign key constraint that references the wrong table
ALTER TABLE public.attendees DROP CONSTRAINT IF EXISTS attendees_practice_id_fkey;

-- Add the correct foreign key to gp_practices (with ON DELETE SET NULL for safety)
ALTER TABLE public.attendees 
ADD CONSTRAINT attendees_practice_id_fkey 
FOREIGN KEY (practice_id) REFERENCES public.gp_practices(id) ON DELETE SET NULL;