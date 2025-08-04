-- Create enhanced transcription tables for the new audio service
CREATE TABLE IF NOT EXISTS public.audio_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  audio_blob_path TEXT,
  file_size INTEGER,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create transcription chunks table
CREATE TABLE IF NOT EXISTS public.transcription_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_chunk_id UUID REFERENCES public.audio_chunks(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL,
  transcript_text TEXT NOT NULL,
  confidence REAL,
  language TEXT DEFAULT 'en',
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audio processing sessions table
CREATE TABLE IF NOT EXISTS public.audio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  total_chunks INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.audio_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_sessions ENABLE ROW LEVEL SECURITY;

-- Audio chunks policies
CREATE POLICY "Users can manage audio chunks for their meetings" ON public.audio_chunks
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

-- Transcription chunks policies  
CREATE POLICY "Users can view transcription chunks for their meetings" ON public.transcription_chunks
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    )
  );

-- Audio sessions policies
CREATE POLICY "Users can manage their audio sessions" ON public.audio_sessions
  FOR ALL USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_audio_chunks_meeting_id ON public.audio_chunks(meeting_id);
CREATE INDEX idx_audio_chunks_chunk_number ON public.audio_chunks(meeting_id, chunk_number);
CREATE INDEX idx_transcription_chunks_meeting_id ON public.transcription_chunks(meeting_id);
CREATE INDEX idx_transcription_chunks_audio_chunk ON public.transcription_chunks(audio_chunk_id);
CREATE INDEX idx_audio_sessions_user_id ON public.audio_sessions(user_id);

-- Function to get combined transcript for a meeting
CREATE OR REPLACE FUNCTION public.get_meeting_transcript(p_meeting_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT string_agg(transcript_text, ' ' ORDER BY chunk_number)
  FROM public.transcription_chunks
  WHERE meeting_id = p_meeting_id
    AND meeting_id IN (
      SELECT id FROM public.meetings WHERE user_id = auth.uid()
    );
$$;