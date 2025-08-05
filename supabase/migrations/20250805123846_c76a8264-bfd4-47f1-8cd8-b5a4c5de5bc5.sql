-- Create meeting audio segments table for storing 10-minute audio recordings
CREATE TABLE public.meeting_audio_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  segment_number INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meeting_audio_segments ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view audio segments for their meetings" 
ON public.meeting_audio_segments 
FOR SELECT 
USING (meeting_id IN (
  SELECT m.id FROM meetings m WHERE m.user_id = auth.uid()
));

CREATE POLICY "Users can create audio segments for their meetings" 
ON public.meeting_audio_segments 
FOR INSERT 
WITH CHECK (meeting_id IN (
  SELECT m.id FROM meetings m WHERE m.user_id = auth.uid()
));

-- Create storage bucket for meeting audio segments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meeting-audio-segments', 'meeting-audio-segments', false);

-- Create policies for storage bucket
CREATE POLICY "Users can view their own audio segments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'meeting-audio-segments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own audio segments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'meeting-audio-segments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create index for efficient querying
CREATE INDEX idx_meeting_audio_segments_meeting_id ON public.meeting_audio_segments(meeting_id);
CREATE INDEX idx_meeting_audio_segments_segment_number ON public.meeting_audio_segments(meeting_id, segment_number);