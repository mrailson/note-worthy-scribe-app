-- Add letter_style column to complaint_outcomes table
ALTER TABLE public.complaint_outcomes 
ADD COLUMN IF NOT EXISTS letter_style TEXT DEFAULT 'professional';

COMMENT ON COLUMN public.complaint_outcomes.letter_style IS 'The tone/style used when generating the outcome letter (professional, empathetic, apologetic, factual, firm, strong)';