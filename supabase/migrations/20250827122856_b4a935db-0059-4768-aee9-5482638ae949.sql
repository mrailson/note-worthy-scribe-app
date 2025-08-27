-- Create meeting notes queue table for background processing
CREATE TABLE IF NOT EXISTS public.meeting_notes_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  detail_level text NOT NULL DEFAULT 'standard' CHECK (detail_level IN ('headlines', 'standard', 'more', 'super')),
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add notes generation status to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS notes_generation_status text DEFAULT 'not_started' CHECK (notes_generation_status IN ('not_started', 'queued', 'generating', 'completed', 'failed'));

-- Enable RLS on meeting_notes_queue
ALTER TABLE public.meeting_notes_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for meeting_notes_queue
CREATE POLICY "Users can view notes queue for their meetings" 
ON public.meeting_notes_queue 
FOR SELECT 
USING (meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid()));

CREATE POLICY "System can manage notes queue" 
ON public.meeting_notes_queue 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_notes_queue_status ON public.meeting_notes_queue(status);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_queue_meeting_id ON public.meeting_notes_queue(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_notes_generation_status ON public.meetings(notes_generation_status);

-- Trigger to update updated_at on meeting_notes_queue
CREATE OR REPLACE FUNCTION update_meeting_notes_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_notes_queue_updated_at
  BEFORE UPDATE ON public.meeting_notes_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_notes_queue_updated_at();