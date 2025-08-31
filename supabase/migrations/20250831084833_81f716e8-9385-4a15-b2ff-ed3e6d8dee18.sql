-- Add missing columns to meetings table for processing functionality
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS word_count integer,
ADD COLUMN IF NOT EXISTS overview text;

-- Update any meetings with failed notes generation status to allow reprocessing
UPDATE public.meetings 
SET notes_generation_status = 'not_started' 
WHERE notes_generation_status = 'failed';