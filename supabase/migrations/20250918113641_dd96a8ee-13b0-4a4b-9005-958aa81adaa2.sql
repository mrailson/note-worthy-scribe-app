-- Create a cron job to automatically clean up expired sessions every hour
-- This will mark sessions as inactive after 5 hours of inactivity

SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.cleanup_expired_sessions();
  $$
);