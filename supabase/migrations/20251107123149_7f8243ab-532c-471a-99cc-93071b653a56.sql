-- Enable real-time updates for meetings table
ALTER TABLE public.meetings REPLICA IDENTITY FULL;

-- Add meetings table to real-time publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;