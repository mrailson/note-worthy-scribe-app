-- Create junction table for meeting-attendee relationships
CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(meeting_id, attendee_id)
);

-- Enable RLS
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view attendees for their meetings"
  ON public.meeting_attendees
  FOR SELECT
  USING (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add attendees to their meetings"
  ON public.meeting_attendees
  FOR INSERT
  WITH CHECK (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove attendees from their meetings"
  ON public.meeting_attendees
  FOR DELETE
  USING (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting_id ON public.meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_attendee_id ON public.meeting_attendees(attendee_id);