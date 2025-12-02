-- Add upload_progress column to lg_patients for tracking upload progress
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS upload_progress integer DEFAULT 0;

-- Enable realtime for lg_patients table
ALTER TABLE public.lg_patients REPLICA IDENTITY FULL;

-- Add lg_patients to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'lg_patients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lg_patients;
  END IF;
END $$;