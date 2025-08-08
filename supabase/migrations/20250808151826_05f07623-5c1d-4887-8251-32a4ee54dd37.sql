-- Add practice_id to meetings table to track which practice the meeting belongs to
ALTER TABLE public.meetings 
ADD COLUMN practice_id uuid REFERENCES public.gp_practices(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.meetings.practice_id IS 'Associates the meeting with a specific practice from the users practice assignments';