-- Add critical friend review fields to investigation findings
ALTER TABLE public.complaint_investigation_findings 
ADD COLUMN IF NOT EXISTS critical_friend_review TEXT,
ADD COLUMN IF NOT EXISTS critical_friend_review_generated_at TIMESTAMPTZ;