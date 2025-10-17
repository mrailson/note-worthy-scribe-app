-- Add soap_notes column to meetings table for storing patient consultation notes
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS soap_notes jsonb DEFAULT NULL;

COMMENT ON COLUMN public.meetings.soap_notes IS 'Stores SOAP format consultation notes: { S: subjective, O: objective, A: assessment, P: plan, generated_at: timestamp, consultation_type: string }';