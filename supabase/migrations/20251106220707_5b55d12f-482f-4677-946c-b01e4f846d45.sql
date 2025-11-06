-- Add sent_at column to complaint_outcomes table to track when outcome letters are sent
ALTER TABLE public.complaint_outcomes 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.complaint_outcomes.sent_at IS 'Timestamp when the outcome letter was sent to the patient via email or post';