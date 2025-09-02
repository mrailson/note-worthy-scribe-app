-- Create system monitoring alerts table (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_monitoring_alerts') THEN
    CREATE TABLE public.system_monitoring_alerts (
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
    
    ALTER TABLE public.system_monitoring_alerts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add new columns to existing tables
ALTER TABLE public.meeting_transcription_chunks 
ADD COLUMN IF NOT EXISTS audio_backup_id UUID REFERENCES public.meeting_audio_backups(id),
ADD COLUMN IF NOT EXISTS transcriber_type TEXT DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending';

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'meeting_transcription_chunks_validation_status_check'
  ) THEN
    ALTER TABLE public.meeting_transcription_chunks 
    ADD CONSTRAINT meeting_transcription_chunks_validation_status_check 
    CHECK (validation_status IN ('pending', 'validated', 'failed'));
  END IF;
END $$;

-- Update meeting_audio_backups table
ALTER TABLE public.meeting_audio_backups
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS integrity_check_passed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS integrity_check_at TIMESTAMP WITH TIME ZONE;

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'meeting_audio_backups_transcription_status_check'
  ) THEN
    ALTER TABLE public.meeting_audio_backups 
    ADD CONSTRAINT meeting_audio_backups_transcription_status_check 
    CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;

-- Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_system_monitoring_alerts_severity ON public.system_monitoring_alerts(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_system_monitoring_alerts_meeting ON public.system_monitoring_alerts(meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_monitoring_alerts_status ON public.system_monitoring_alerts(status, alert_type);

CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_backup ON public.meeting_transcription_chunks(audio_backup_id) WHERE audio_backup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_validation ON public.meeting_transcription_chunks(validation_status, created_at);

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
  SELECT word_count INTO meeting_word_count FROM public.meetings WHERE id = p_meeting_id;
  
  SELECT 
    COUNT(*),
    SUM(COALESCE(word_count, 0)),
    BOOL_OR(transcription_text IS NULL OR trim(transcription_text) = '')
  INTO chunk_count, total_chunk_words, has_empty_chunks
  FROM public.meeting_transcription_chunks WHERE meeting_id = p_meeting_id;
  
  IF meeting_word_count > 0 AND (chunk_count = 0 OR total_chunk_words = 0) THEN
    RETURN QUERY SELECT 
      'missing_transcript_data'::TEXT,
      'critical'::TEXT,
      'Meeting has word count but no transcript chunks'::TEXT,
      jsonb_build_object('meeting_word_count', meeting_word_count, 'chunk_count', chunk_count);
  END IF;
  
  IF has_empty_chunks AND chunk_count > 0 THEN
    RETURN QUERY SELECT
      'empty_chunks'::TEXT,
      'high'::TEXT,
      'Some transcript chunks contain empty text'::TEXT,
      jsonb_build_object('chunk_count', chunk_count);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create validation function (replace if exists)
CREATE OR REPLACE FUNCTION public.validate_meeting_transcript_save()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.word_count > 0 AND (NEW.transcription_text IS NULL OR trim(NEW.transcription_text) = '') THEN
    RAISE EXCEPTION 'Cannot save empty transcript text with positive word count';
  END IF;
  
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

-- Create RLS policies only if table exists and they don't exist already
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'system_monitoring_alerts') THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "System admins can view all monitoring alerts" ON public.system_monitoring_alerts;
    DROP POLICY IF EXISTS "System admins can manage monitoring alerts" ON public.system_monitoring_alerts;  
    DROP POLICY IF EXISTS "Users can view alerts for their meetings" ON public.system_monitoring_alerts;
    
    -- Create new policies
    CREATE POLICY "System admins can view all monitoring alerts"
      ON public.system_monitoring_alerts FOR SELECT
      USING (is_system_admin(auth.uid()));

    CREATE POLICY "System admins can manage monitoring alerts"
      ON public.system_monitoring_alerts FOR ALL
      USING (is_system_admin(auth.uid()));

    CREATE POLICY "Users can view alerts for their meetings"
      ON public.system_monitoring_alerts FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Log successful migration
INSERT INTO public.system_audit_log (table_name, operation, new_values) 
VALUES ('system_migrations', 'TRANSCRIPT_INTEGRITY_SYSTEM_DEPLOYED', jsonb_build_object(
  'features', ARRAY['atomic_transcript_saving', 'mandatory_audio_backups', 'real_time_validation', 'monitoring_alerts'],
  'deployed_at', now(),
  'status', 'active'
));