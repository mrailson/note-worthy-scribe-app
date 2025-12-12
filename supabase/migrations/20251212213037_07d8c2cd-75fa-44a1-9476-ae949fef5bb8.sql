-- Add verification columns to lg_patients table
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS verification_score INTEGER,
ADD COLUMN IF NOT EXISTS verification_rag TEXT,
ADD COLUMN IF NOT EXISTS verification_results JSONB,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the columns
COMMENT ON COLUMN public.lg_patients.verification_status IS 'Multi-LLM verification status: pending, verified, issues_found';
COMMENT ON COLUMN public.lg_patients.verification_score IS 'Overall verification score 0-100';
COMMENT ON COLUMN public.lg_patients.verification_rag IS 'RAG rating: green, amber, red';
COMMENT ON COLUMN public.lg_patients.verification_results IS 'Full verification results from all LLMs';
COMMENT ON COLUMN public.lg_patients.verified_at IS 'Timestamp when verification was completed';