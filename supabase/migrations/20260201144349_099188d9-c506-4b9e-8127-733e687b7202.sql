-- Create table for tracking magic link rate limits
CREATE TABLE public.magic_link_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email_requested TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE
);

-- Index for fast lookups by IP and time window
CREATE INDEX idx_magic_link_rate_ip_time 
  ON public.magic_link_rate_limits(ip_address, created_at DESC);

-- Enable RLS
ALTER TABLE public.magic_link_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (edge functions use service role)
-- No policies needed for authenticated users - they should not access this table directly

-- Create a function to clean up old records (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.magic_link_rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;