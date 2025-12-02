-- Add email tracking columns to lg_patients
ALTER TABLE lg_patients 
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_error TEXT;