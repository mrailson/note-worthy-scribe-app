-- Add sent_at and sent_by fields to complaint_outcomes table
ALTER TABLE complaint_outcomes
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id);