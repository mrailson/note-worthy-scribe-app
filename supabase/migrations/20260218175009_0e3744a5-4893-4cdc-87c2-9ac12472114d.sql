
-- Add device tracking columns to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS device_ip_address text,
ADD COLUMN IF NOT EXISTS device_user_agent text,
ADD COLUMN IF NOT EXISTS device_type text,
ADD COLUMN IF NOT EXISTS device_browser text,
ADD COLUMN IF NOT EXISTS device_os text,
ADD COLUMN IF NOT EXISTS device_screen_resolution text;

-- Add comment for documentation
COMMENT ON COLUMN public.meetings.device_ip_address IS 'IP address captured at meeting creation via edge function';
COMMENT ON COLUMN public.meetings.device_user_agent IS 'Full user agent string at meeting creation';
COMMENT ON COLUMN public.meetings.device_type IS 'Device type: desktop, mobile, tablet, iphone, android etc';
COMMENT ON COLUMN public.meetings.device_browser IS 'Browser name and version';
COMMENT ON COLUMN public.meetings.device_os IS 'Operating system name and version';
COMMENT ON COLUMN public.meetings.device_screen_resolution IS 'Screen resolution e.g. 1920x1080';
