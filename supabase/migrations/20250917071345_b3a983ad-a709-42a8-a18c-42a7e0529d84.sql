-- Add transcript cleaning tracking to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS transcript_cleaned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transcript_cleaned_word_count INTEGER;