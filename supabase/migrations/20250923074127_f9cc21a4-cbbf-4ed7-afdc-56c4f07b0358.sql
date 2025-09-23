-- Create table for tracking transcript cleaning jobs and statistics
CREATE TABLE public.transcript_cleaning_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  original_transcript_length integer NOT NULL,
  cleaned_transcript_length integer,
  word_count integer NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  chunks_processed integer DEFAULT 0,
  total_chunks integer DEFAULT 0,
  processing_start_time timestamp with time zone,
  processing_end_time timestamp with time zone,
  processing_duration_ms integer,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_transcript_cleaning_jobs_status ON public.transcript_cleaning_jobs(processing_status);
CREATE INDEX idx_transcript_cleaning_jobs_created_at ON public.transcript_cleaning_jobs(created_at);
CREATE INDEX idx_transcript_cleaning_jobs_meeting_id ON public.transcript_cleaning_jobs(meeting_id);

-- Create table for daily statistics tracking
CREATE TABLE public.transcript_cleaning_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_jobs_processed integer NOT NULL DEFAULT 0,
  total_jobs_completed integer NOT NULL DEFAULT 0,
  total_jobs_failed integer NOT NULL DEFAULT 0,
  total_processing_time_ms bigint NOT NULL DEFAULT 0,
  average_processing_time_ms integer NOT NULL DEFAULT 0,
  total_transcripts_cleaned integer NOT NULL DEFAULT 0,
  total_words_processed bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(date)
);

-- Enable RLS on both tables
ALTER TABLE public.transcript_cleaning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_cleaning_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system admins only
CREATE POLICY "System admins can view transcript cleaning jobs" 
ON public.transcript_cleaning_jobs 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System can insert transcript cleaning jobs" 
ON public.transcript_cleaning_jobs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update transcript cleaning jobs" 
ON public.transcript_cleaning_jobs 
FOR UPDATE 
USING (true);

CREATE POLICY "System admins can view transcript cleaning stats" 
ON public.transcript_cleaning_stats 
FOR SELECT 
USING (is_system_admin(auth.uid()));

CREATE POLICY "System can manage transcript cleaning stats" 
ON public.transcript_cleaning_stats 
FOR ALL 
USING (true);

-- Create function to find uncleaned transcripts over 100 words
CREATE OR REPLACE FUNCTION public.find_uncleaned_transcripts(batch_size integer DEFAULT 10)
RETURNS TABLE(
  meeting_id uuid,
  transcript_text text,
  word_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as meeting_id,
    m.transcript as transcript_text,
    m.word_count
  FROM public.meetings m
  WHERE 
    m.word_count > 100
    AND m.transcript IS NOT NULL 
    AND LENGTH(TRIM(m.transcript)) > 100
    AND m.id NOT IN (
      SELECT tcj.meeting_id 
      FROM public.transcript_cleaning_jobs tcj 
      WHERE tcj.meeting_id = m.id 
      AND tcj.processing_status IN ('completed', 'processing', 'pending')
    )
  ORDER BY m.created_at DESC
  LIMIT batch_size;
END;
$$;

-- Create function to update daily stats
CREATE OR REPLACE FUNCTION public.update_transcript_cleaning_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  today_date date;
  jobs_processed integer;
  jobs_completed integer;
  jobs_failed integer;
  total_time_ms bigint;
  avg_time_ms integer;
  transcripts_cleaned integer;
  words_processed bigint;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Get today's statistics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE processing_status = 'completed'),
    COUNT(*) FILTER (WHERE processing_status = 'failed'),
    COALESCE(SUM(processing_duration_ms), 0),
    COALESCE(AVG(processing_duration_ms)::integer, 0),
    COUNT(*) FILTER (WHERE processing_status = 'completed'),
    COALESCE(SUM(word_count) FILTER (WHERE processing_status = 'completed'), 0)
  INTO 
    jobs_processed,
    jobs_completed,
    jobs_failed,
    total_time_ms,
    avg_time_ms,
    transcripts_cleaned,
    words_processed
  FROM public.transcript_cleaning_jobs
  WHERE DATE(created_at) = today_date;
  
  -- Insert or update daily stats
  INSERT INTO public.transcript_cleaning_stats (
    date,
    total_jobs_processed,
    total_jobs_completed,
    total_jobs_failed,
    total_processing_time_ms,
    average_processing_time_ms,
    total_transcripts_cleaned,
    total_words_processed
  ) VALUES (
    today_date,
    jobs_processed,
    jobs_completed,
    jobs_failed,
    total_time_ms,
    avg_time_ms,
    transcripts_cleaned,
    words_processed
  )
  ON CONFLICT (date) 
  DO UPDATE SET
    total_jobs_processed = EXCLUDED.total_jobs_processed,
    total_jobs_completed = EXCLUDED.total_jobs_completed,
    total_jobs_failed = EXCLUDED.total_jobs_failed,
    total_processing_time_ms = EXCLUDED.total_processing_time_ms,
    average_processing_time_ms = EXCLUDED.average_processing_time_ms,
    total_transcripts_cleaned = EXCLUDED.total_transcripts_cleaned,
    total_words_processed = EXCLUDED.total_words_processed,
    updated_at = now();
END;
$$;

-- Create trigger to automatically update updated_at columns
CREATE TRIGGER update_transcript_cleaning_jobs_updated_at
  BEFORE UPDATE ON public.transcript_cleaning_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transcript_cleaning_stats_updated_at
  BEFORE UPDATE ON public.transcript_cleaning_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();