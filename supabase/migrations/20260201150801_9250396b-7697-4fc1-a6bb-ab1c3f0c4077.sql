-- Create table to track login rate limits
CREATE TABLE IF NOT EXISTS public.login_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email_attempted TEXT NOT NULL,
  password_hash_prefix TEXT, -- First 4 chars of password hash for pattern detection (not actual password)
  user_agent TEXT,
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_login_rate_limits_ip_created 
ON public.login_rate_limits(ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_created 
ON public.login_rate_limits(created_at DESC);

-- Enable RLS
ALTER TABLE public.login_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions)
CREATE POLICY "Service role only access" 
ON public.login_rate_limits 
FOR ALL 
USING (false)
WITH CHECK (false);

-- Auto-cleanup old records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.login_rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;