-- Create quick_record_tokens table for passwordless meeting recording access
CREATE TABLE public.quick_record_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  device_name TEXT
);

-- Enable RLS
ALTER TABLE public.quick_record_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view/manage their own tokens
CREATE POLICY "Users can view their own tokens"
  ON public.quick_record_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tokens"
  ON public.quick_record_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.quick_record_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.quick_record_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast token lookups
CREATE INDEX idx_quick_record_tokens_token ON public.quick_record_tokens(token);
CREATE INDEX idx_quick_record_tokens_user_id ON public.quick_record_tokens(user_id);