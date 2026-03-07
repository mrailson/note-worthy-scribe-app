
-- Profile change log
CREATE TABLE public.profile_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id TEXT,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  policies_affected INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.profile_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile changes"
ON public.profile_change_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile changes"
ON public.profile_change_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Policy profile flags
CREATE TABLE public.policy_profile_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID NOT NULL REFERENCES public.policy_completions(id) ON DELETE CASCADE,
  profile_change_id UUID NOT NULL REFERENCES public.profile_change_log(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flagged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE,
  dismissed_by TEXT,
  resolved_by_version_id UUID REFERENCES public.policy_versions(id),
  UNIQUE(policy_id, profile_change_id)
);

ALTER TABLE public.policy_profile_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own policy flags"
ON public.policy_profile_flags FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own policy flags"
ON public.policy_profile_flags FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own policy flags"
ON public.policy_profile_flags FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_policy_profile_flags_policy ON public.policy_profile_flags(policy_id);
CREATE INDEX idx_policy_profile_flags_active ON public.policy_profile_flags(policy_id) WHERE dismissed_at IS NULL AND resolved_by_version_id IS NULL;
CREATE INDEX idx_profile_change_log_user ON public.profile_change_log(user_id);
