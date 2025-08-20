-- Ensure the audio_chunks table exists with proper structure
CREATE TABLE IF NOT EXISTS public.audio_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  audio_blob_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  chunk_duration_ms INTEGER DEFAULT 5000,
  processing_status TEXT DEFAULT 'stored',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audio_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies for audio chunks
CREATE POLICY "Users can view their own audio chunks" 
ON public.audio_chunks 
FOR SELECT 
USING (meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own audio chunks" 
ON public.audio_chunks 
FOR INSERT 
WITH CHECK (meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid()));

-- Create storage policies for meeting-audio-chunks bucket
CREATE POLICY "Users can view their own audio chunks in storage" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'meeting-audio-chunks' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload their own audio chunks" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'meeting-audio-chunks' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create index for efficient chunk retrieval
CREATE INDEX IF NOT EXISTS idx_audio_chunks_meeting_id ON public.audio_chunks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_audio_chunks_chunk_number ON public.audio_chunks(meeting_id, chunk_number);