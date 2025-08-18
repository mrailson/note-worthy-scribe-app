-- Add email_signature and letter_signature fields to practice_details table
ALTER TABLE public.practice_details 
ADD COLUMN IF NOT EXISTS email_signature text,
ADD COLUMN IF NOT EXISTS letter_signature text;