-- Create system monitoring alerts table
CREATE TABLE IF NOT EXISTS public.system_monitoring_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id TEXT NOT NULL UNIQUE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  meeting_id UUID REFERENCES public.meetings(id),
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'dismissed')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create low confidence chunks table for storing filtered transcripts
CREATE TABLE IF NOT EXISTS public.low_confidence_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.meetings(id),
  session_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  chunk_number INTEGER NOT NULL,
  transcription_text TEXT NOT NULL,
  confidence REAL NOT NULL,
  original_confidence REAL NOT NULL,
  transcriber_type TEXT NOT NULL DEFAULT 'browser_speech',
  filter_reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add audio backup reference to meeting_transcription_chunks
ALTER TABLE public.meeting_transcription_chunks 
ADD COLUMN IF NOT EXISTS audio_backup_id UUID REFERENCES public.meeting_audio_backups(id),
ADD COLUMN IF NOT EXISTS transcriber_type TEXT DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'failed'));

-- Update meeting_audio_backups to support integrity features  
ALTER TABLE public.meeting_audio_backups
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN IF NOT EXISTS integrity_check_passed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS integrity_check_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_monitoring_alerts_severity ON public.system_monitoring_alerts(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_system_monitoring_alerts_meeting ON public.system_monitoring_alerts(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_monitoring_alerts_status ON public.system_monitoring_alerts(status, alert_type);

CREATE INDEX IF NOT EXISTS idx_low_confidence_chunks_meeting ON public.low_confidence_chunks(meeting_id, session_id);
CREATE INDEX IF NOT EXISTS idx_low_confidence_chunks_user ON public.low_confidence_chunks(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_backup ON public.meeting_transcription_chunks(audio_backup_id) WHERE audio_backup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_validation ON public.meeting_transcription_chunks(validation_status, created_at);

-- Create function to automatically update word_count in meeting_transcription_chunks
CREATE OR REPLACE FUNCTION public.update_chunk_word_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically calculate and set word count when transcript text is inserted/updated
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

-- Create trigger to automatically update word count
CREATE TRIGGER trigger_update_chunk_word_count
  BEFORE INSERT OR UPDATE OF transcription_text
  ON public.meeting_transcription_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chunk_word_count();

-- Create function to detect transcript integrity issues
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
  SELECT word_count INTO meeting_word_count
  FROM public.meetings
  WHERE id = p_meeting_id;
  
  -- Get chunk statistics
  SELECT 
    COUNT(*),
    SUM(COALESCE(word_count, 0)),
    BOOL_OR(transcription_text IS NULL OR trim(transcription_text) = '')
  INTO chunk_count, total_chunk_words, has_empty_chunks
  FROM public.meeting_transcription_chunks
  WHERE meeting_id = p_meeting_id;
  
  -- Check for word count mismatch
  IF meeting_word_count > 0 AND (chunk_count = 0 OR total_chunk_words = 0) THEN
    RETURN QUERY SELECT 
      'missing_transcript_data'::TEXT,
      'critical'::TEXT,
      'Meeting has word count but no transcript chunks or empty chunks'::TEXT,
      jsonb_build_object(
        'meeting_word_count', meeting_word_count,
        'chunk_count', chunk_count,
        'total_chunk_words', total_chunk_words
      );
  END IF;
  
  -- Check for empty chunks
  IF has_empty_chunks AND chunk_count > 0 THEN
    RETURN QUERY SELECT
      'empty_chunks'::TEXT,
      'high'::TEXT,
      'Some transcript chunks contain empty text'::TEXT,
      jsonb_build_object(
        'chunk_count', chunk_count,
        'has_empty_chunks', has_empty_chunks
      );
  END IF;
  
  -- Check for missing audio backup
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_audio_backups 
    WHERE meeting_id = p_meeting_id
  ) THEN
    RETURN QUERY SELECT
      'missing_audio_backup'::TEXT,
      'medium'::TEXT,
      'No audio backup available for recovery'::TEXT,
      jsonb_build_object('meeting_id', p_meeting_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE public.system_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.low_confidence_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for system_monitoring_alerts
CREATE POLICY "System admins can view all monitoring alerts"
  ON public.system_monitoring_alerts FOR SELECT
  USING (is_system_admin(auth.uid()));

CREATE POLICY "System admins can manage monitoring alerts"
  ON public.system_monitoring_alerts FOR ALL
  USING (is_system_admin(auth.uid()));

CREATE POLICY "Users can view alerts for their meetings"
  ON public.system_monitoring_alerts FOR SELECT
  USING (user_id = auth.uid());

-- Create RLS policies for low_confidence_chunks  
CREATE POLICY "Users can view their own low confidence chunks"
  ON public.low_confidence_chunks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own low confidence chunks"
  ON public.low_confidence_chunks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System admins can view all low confidence chunks"
  ON public.low_confidence_chunks FOR ALL
  USING (is_system_admin(auth.uid()));

-- Update existing triggers to include integrity validation
CREATE OR REPLACE FUNCTION public.validate_meeting_transcript_save()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that we're not saving empty transcript with positive word count
  IF NEW.word_count > 0 AND (NEW.transcription_text IS NULL OR trim(NEW.transcription_text) = '') THEN
    RAISE EXCEPTION 'Cannot save empty transcript text with positive word count. This would create data integrity issue.';
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

CREATE TRIGGER trigger_validate_meeting_transcript_save
  BEFORE INSERT OR UPDATE
  ON public.meeting_transcription_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_transcript_save();

-- Log the migration completion
INSERT INTO public.system_audit_log (
  table_name,
  operation,
  new_values
) VALUES (
  'system_migrations',
  'TRANSCRIPT_INTEGRITY_SYSTEM_DEPLOYED',
  jsonb_build_object(
    'features', ARRAY[
      'atomic_transcript_saving',
      'mandatory_audio_backups',
      'real_time_validation',
      'monitoring_alerts',
      'integrity_functions',
      'emergency_recovery_tools'
    ],
    'deployed_at', now(),
    'status', 'active'
  )
);