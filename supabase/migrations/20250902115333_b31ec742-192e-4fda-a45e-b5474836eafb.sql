-- Add new columns to existing tables
ALTER TABLE public.meeting_transcription_chunks 
ADD COLUMN IF NOT EXISTS audio_backup_id UUID REFERENCES public.meeting_audio_backups(id),
ADD COLUMN IF NOT EXISTS transcriber_type TEXT DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';

-- Update meeting_audio_backups table
ALTER TABLE public.meeting_audio_backups
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS integrity_check_passed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS integrity_check_at TIMESTAMP WITH TIME ZONE;

-- Create word count update function (replace if exists)
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transcription_text IS NOT NULL THEN
    NEW.word_count = (
      SELECT COUNT(*)
      FROM regexp_split_to_table(trim(NEW.transcription_text), '\s+') AS word
      WHERE length(word) > 0
    );
  ELSE
    NEW.word_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_update_chunk_word_count ON public.meeting_transcription_chunks;
CREATE TRIGGER trigger_update_chunk_word_count
  BEFORE INSERT OR UPDATE OF transcription_text
  ON public.meeting_transcription_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chunk_word_count();

-- Create validation function (replace if exists)
CREATE OR REPLACE FUNCTION public.validate_meeting_transcript_save()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent the specific bug where word count exists but transcript text is empty
  IF NEW.word_count > 0 AND (NEW.transcription_text IS NULL OR trim(NEW.transcription_text) = '') THEN
    RAISE EXCEPTION 'TRANSCRIPT_INTEGRITY_VIOLATION: Cannot save empty transcript text with positive word count (word_count: %, text: "%")', 
      NEW.word_count, COALESCE(NEW.transcription_text, 'NULL');
  END IF;
  
  -- Set validation status based on content
  IF NEW.transcription_text IS NOT NULL AND trim(NEW.transcription_text) != '' THEN
    NEW.validation_status = 'validated';
  ELSE
    NEW.validation_status = 'failed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create validation trigger (drop if exists first)  
DROP TRIGGER IF EXISTS trigger_validate_meeting_transcript_save ON public.meeting_transcription_chunks;
CREATE TRIGGER trigger_validate_meeting_transcript_save
  BEFORE INSERT OR UPDATE
  ON public.meeting_transcription_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_transcript_save();

-- Create integrity check function (replace if exists)
CREATE OR REPLACE FUNCTION public.check_transcript_integrity(p_meeting_id UUID)
RETURNS TABLE(
  issue_type TEXT,
  severity TEXT,
  description TEXT,
  metadata JSONB
) AS $$
DECLARE
  meeting_word_count INTEGER;
  chunk_count INTEGER;
  total_chunk_words INTEGER;
  has_empty_chunks BOOLEAN;
BEGIN
  -- Get meeting word count
  SELECT word_count INTO meeting_word_count FROM public.meetings WHERE id = p_meeting_id;
  
  -- Get chunk statistics
  SELECT 
    COUNT(*),
    SUM(COALESCE(word_count, 0)),
    BOOL_OR(transcription_text IS NULL OR trim(transcription_text) = '')
  INTO chunk_count, total_chunk_words, has_empty_chunks
  FROM public.meeting_transcription_chunks WHERE meeting_id = p_meeting_id;
  
  -- Check for the critical bug: word count but no transcript data
  IF meeting_word_count > 0 AND (chunk_count = 0 OR total_chunk_words = 0) THEN
    RETURN QUERY SELECT 
      'missing_transcript_data'::TEXT,
      'critical'::TEXT,
      format('CRITICAL: Meeting has %s word count but %s transcript chunks with %s total words', 
        meeting_word_count, chunk_count, COALESCE(total_chunk_words, 0))::TEXT,
      jsonb_build_object(
        'meeting_word_count', meeting_word_count, 
        'chunk_count', chunk_count,
        'total_chunk_words', COALESCE(total_chunk_words, 0),
        'bug_detected', 'transcript_data_loss'
      );
  END IF;
  
  -- Check for empty chunks (another form of the bug)
  IF has_empty_chunks AND chunk_count > 0 THEN
    RETURN QUERY SELECT
      'empty_chunks'::TEXT,
      'high'::TEXT,
      format('HIGH: %s transcript chunks contain empty text', chunk_count)::TEXT,
      jsonb_build_object('chunk_count', chunk_count, 'has_empty_chunks', has_empty_chunks);
  END IF;
  
  -- Check for missing audio backup (recovery capability)
  IF NOT EXISTS (SELECT 1 FROM public.meeting_audio_backups WHERE meeting_id = p_meeting_id) THEN
    RETURN QUERY SELECT
      'missing_audio_backup'::TEXT,
      'medium'::TEXT,
      'MEDIUM: No audio backup available for recovery'::TEXT,
      jsonb_build_object('meeting_id', p_meeting_id, 'backup_available', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create emergency detection function for existing meetings
CREATE OR REPLACE FUNCTION public.emergency_detect_transcript_data_loss()
RETURNS TABLE(
  meeting_id UUID,
  user_id UUID,
  meeting_title TEXT,
  word_count INTEGER,
  chunk_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as meeting_id,
    m.user_id,
    m.title as meeting_title,
    m.word_count,
    COALESCE(chunk_stats.chunk_count, 0) as chunk_count,
    m.created_at,
    CASE 
      WHEN m.word_count > 0 AND COALESCE(chunk_stats.chunk_count, 0) = 0 THEN 'CRITICAL'
      WHEN m.word_count > 0 AND COALESCE(chunk_stats.total_words, 0) = 0 THEN 'CRITICAL'
      ELSE 'OK'
    END as severity
  FROM public.meetings m
  LEFT JOIN (
    SELECT 
      meeting_id,
      COUNT(*) as chunk_count,
      SUM(CASE WHEN transcription_text IS NOT NULL AND trim(transcription_text) != '' THEN word_count ELSE 0 END) as total_words
    FROM public.meeting_transcription_chunks
    GROUP BY meeting_id
  ) chunk_stats ON m.id = chunk_stats.meeting_id
  WHERE m.word_count > 0  -- Only check meetings that should have transcript data
    AND m.created_at >= NOW() - INTERVAL '30 days'  -- Last 30 days
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;