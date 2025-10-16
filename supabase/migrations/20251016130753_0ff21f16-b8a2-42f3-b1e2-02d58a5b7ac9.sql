-- Add meeting_role column to meeting_attendees table
ALTER TABLE public.meeting_attendees 
ADD COLUMN meeting_role TEXT DEFAULT 'attendee' CHECK (meeting_role IN ('chair', 'key_participant', 'attendee'));

-- Add index for better query performance
CREATE INDEX idx_meeting_attendees_role ON public.meeting_attendees(meeting_id, meeting_role);

COMMENT ON COLUMN public.meeting_attendees.meeting_role IS 'Role of attendee in meeting: chair, key_participant, or attendee';