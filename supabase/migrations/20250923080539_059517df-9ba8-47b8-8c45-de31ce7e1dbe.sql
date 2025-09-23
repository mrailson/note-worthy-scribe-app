-- Phase 1: Database Schema Enhancements for Real-time Transcript Cleaning

-- 1. Extend meeting_transcription_chunks table with cleaning fields
ALTER TABLE public.meeting_transcription_chunks 
ADD COLUMN IF NOT EXISTS cleaned_text TEXT,
ADD COLUMN IF NOT EXISTS cleaning_status TEXT DEFAULT 'pending' CHECK (cleaning_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
ADD COLUMN IF NOT EXISTS cleaned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cleaning_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- 2. Extend transcript_cleaning_jobs table for chunk-level tracking
ALTER TABLE public.transcript_cleaning_jobs 
ADD COLUMN IF NOT EXISTS chunk_id UUID REFERENCES public.meeting_transcription_chunks(id),
ADD COLUMN IF NOT EXISTS is_realtime_cleaning BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS batch_id UUID DEFAULT gen_random_uuid();

-- 3. Create active_meetings_monitor table
CREATE TABLE IF NOT EXISTS public.active_meetings_monitor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    last_processed_chunk_number INTEGER DEFAULT 0,
    total_chunks_processed INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(meeting_id, user_id)
);

-- Enable RLS on active_meetings_monitor
ALTER TABLE public.active_meetings_monitor ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for active_meetings_monitor
CREATE POLICY "Users can manage their active meeting monitoring"
ON public.active_meetings_monitor
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 4. Create chunk cleaning statistics table
CREATE TABLE IF NOT EXISTS public.chunk_cleaning_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_chunks_processed INTEGER DEFAULT 0,
    realtime_chunks_processed INTEGER DEFAULT 0,
    background_chunks_processed INTEGER DEFAULT 0,
    failed_chunks INTEGER DEFAULT 0,
    average_cleaning_time_ms INTEGER DEFAULT 0,
    total_processing_time_ms BIGINT DEFAULT 0,
    active_meetings_monitored INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(date)
);

-- Enable RLS on chunk_cleaning_stats
ALTER TABLE public.chunk_cleaning_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for chunk_cleaning_stats (system admin only)
CREATE POLICY "System admins can view chunk cleaning stats"
ON public.chunk_cleaning_stats
FOR SELECT
USING (is_system_admin(auth.uid()));

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_cleaning_status 
ON public.meeting_transcription_chunks(cleaning_status);

CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_meeting_cleaning 
ON public.meeting_transcription_chunks(meeting_id, cleaning_status);

CREATE INDEX IF NOT EXISTS idx_transcript_cleaning_jobs_chunk_id 
ON public.transcript_cleaning_jobs(chunk_id) WHERE chunk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transcript_cleaning_jobs_realtime 
ON public.transcript_cleaning_jobs(is_realtime_cleaning, processing_status);

CREATE INDEX IF NOT EXISTS idx_active_meetings_monitor_active 
ON public.active_meetings_monitor(is_active, last_activity_at) WHERE is_active = TRUE;

-- 6. Create function to update chunk word count
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate word count from transcription_text
  NEW.word_count = COALESCE(
    array_length(
      string_to_array(
        regexp_replace(
          COALESCE(NEW.transcription_text, ''), 
          '[^\w\s]', ' ', 'g'
        ), 
        ' '
      ), 
      1
    ), 0
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Create trigger for word count updates
DROP TRIGGER IF EXISTS update_chunk_word_count_trigger ON public.meeting_transcription_chunks;
CREATE TRIGGER update_chunk_word_count_trigger
BEFORE INSERT OR UPDATE OF transcription_text ON public.meeting_transcription_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_chunk_word_count();

-- 8. Create function to find chunks needing realtime cleaning
CREATE OR REPLACE FUNCTION public.find_chunks_needing_realtime_cleaning(batch_size INTEGER DEFAULT 5)
RETURNS TABLE(
  chunk_id UUID,
  meeting_id UUID,
  transcription_text TEXT,
  word_count INTEGER,
  chunk_number INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mtc.id as chunk_id,
    mtc.meeting_id,
    mtc.transcription_text,
    mtc.word_count,
    mtc.chunk_number
  FROM public.meeting_transcription_chunks mtc
  INNER JOIN public.meetings m ON mtc.meeting_id = m.id
  WHERE 
    mtc.cleaning_status = 'pending'
    AND mtc.word_count >= 20  -- Only process chunks with sufficient content
    AND LENGTH(TRIM(COALESCE(mtc.transcription_text, ''))) > 50
    AND mtc.created_at >= NOW() - INTERVAL '24 hours'  -- Focus on recent chunks
    AND mtc.id NOT IN (
      SELECT tcj.chunk_id 
      FROM public.transcript_cleaning_jobs tcj 
      WHERE tcj.chunk_id = mtc.id 
      AND tcj.processing_status IN ('processing', 'pending')
    )
  ORDER BY 
    -- Prioritize active meetings
    CASE WHEN m.status = 'recording' THEN 1 ELSE 2 END,
    mtc.created_at DESC
  LIMIT batch_size;
END;
$$;

-- 9. Create function to update chunk cleaning statistics
CREATE OR REPLACE FUNCTION public.update_chunk_cleaning_stats(
  p_chunks_processed INTEGER DEFAULT 1,
  p_is_realtime BOOLEAN DEFAULT TRUE,
  p_processing_time_ms INTEGER DEFAULT 0,
  p_failed_count INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_date DATE;
  avg_time_ms INTEGER;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Calculate average processing time
  SELECT 
    CASE 
      WHEN p_chunks_processed > 0 THEN p_processing_time_ms / p_chunks_processed
      ELSE 0
    END
  INTO avg_time_ms;
  
  -- Insert or update daily stats
  INSERT INTO public.chunk_cleaning_stats (
    date,
    total_chunks_processed,
    realtime_chunks_processed,
    background_chunks_processed,
    failed_chunks,
    average_cleaning_time_ms,
    total_processing_time_ms
  ) VALUES (
    today_date,
    p_chunks_processed,
    CASE WHEN p_is_realtime THEN p_chunks_processed ELSE 0 END,
    CASE WHEN NOT p_is_realtime THEN p_chunks_processed ELSE 0 END,
    p_failed_count,
    avg_time_ms,
    p_processing_time_ms
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_chunks_processed = chunk_cleaning_stats.total_chunks_processed + EXCLUDED.total_chunks_processed,
    realtime_chunks_processed = chunk_cleaning_stats.realtime_chunks_processed + EXCLUDED.realtime_chunks_processed,
    background_chunks_processed = chunk_cleaning_stats.background_chunks_processed + EXCLUDED.background_chunks_processed,
    failed_chunks = chunk_cleaning_stats.failed_chunks + EXCLUDED.failed_chunks,
    total_processing_time_ms = chunk_cleaning_stats.total_processing_time_ms + EXCLUDED.total_processing_time_ms,
    average_cleaning_time_ms = 
      CASE 
        WHEN (chunk_cleaning_stats.total_chunks_processed + EXCLUDED.total_chunks_processed) > 0 
        THEN (chunk_cleaning_stats.total_processing_time_ms + EXCLUDED.total_processing_time_ms)::INTEGER / 
             (chunk_cleaning_stats.total_chunks_processed + EXCLUDED.total_chunks_processed)
        ELSE 0
      END,
    updated_at = now();
END;
$$;

-- 10. Update existing meetings with initial active monitoring for recording meetings
INSERT INTO public.active_meetings_monitor (meeting_id, user_id, last_processed_chunk_number, is_active)
SELECT DISTINCT m.id, m.user_id, 
  COALESCE(MAX(mtc.chunk_number), 0) as last_processed,
  CASE WHEN m.status = 'recording' THEN TRUE ELSE FALSE END
FROM public.meetings m
LEFT JOIN public.meeting_transcription_chunks mtc ON m.id = mtc.meeting_id AND mtc.user_id = m.user_id
WHERE m.created_at >= NOW() - INTERVAL '7 days'  -- Only recent meetings
GROUP BY m.id, m.user_id, m.status
ON CONFLICT (meeting_id, user_id) DO NOTHING;