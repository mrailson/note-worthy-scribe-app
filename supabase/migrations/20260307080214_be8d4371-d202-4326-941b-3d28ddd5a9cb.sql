
-- Create policy_versions table
CREATE TABLE public.policy_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policy_completions(id) ON DELETE CASCADE,
  version_number TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'superseded')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_type TEXT NOT NULL DEFAULT 'initial',
  change_summary TEXT NOT NULL DEFAULT 'Policy created',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_by TEXT,
  next_review_date DATE,
  superseded_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add current_version_id to policy_completions
ALTER TABLE public.policy_completions ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES public.policy_versions(id);

-- Enable RLS
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own policy versions"
ON public.policy_versions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own policy versions"
ON public.policy_versions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own policy versions"
ON public.policy_versions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_policy_versions_policy_id ON public.policy_versions(policy_id);
CREATE INDEX idx_policy_versions_status ON public.policy_versions(policy_id, status);
