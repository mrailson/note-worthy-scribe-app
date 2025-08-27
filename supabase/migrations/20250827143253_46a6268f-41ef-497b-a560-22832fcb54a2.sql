-- Create live_meeting_notes table for current meeting notes
CREATE TABLE public.live_meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  notes_content TEXT NOT NULL,
  transcript_word_count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_status TEXT NOT NULL DEFAULT 'generated',
  UNIQUE(meeting_id, user_id, session_id)
);

-- Create live_meeting_notes_versions table for versioning during active meetings
CREATE TABLE public.live_meeting_notes_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  notes_content TEXT NOT NULL,
  transcript_word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processing_metadata JSONB DEFAULT '{}',
  UNIQUE(meeting_id, user_id, session_id, version_number)
);

-- Enable RLS on live_meeting_notes
ALTER TABLE public.live_meeting_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for live_meeting_notes
CREATE POLICY "Users can view their own live meeting notes" 
ON public.live_meeting_notes 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own live meeting notes" 
ON public.live_meeting_notes 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own live meeting notes" 
ON public.live_meeting_notes 
FOR UPDATE 
USING (user_id = auth.uid());

-- Enable RLS on live_meeting_notes_versions
ALTER TABLE public.live_meeting_notes_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for live_meeting_notes_versions
CREATE POLICY "Users can view their own live meeting note versions" 
ON public.live_meeting_notes_versions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "System can manage live meeting note versions" 
ON public.live_meeting_notes_versions 
FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_live_meeting_notes_meeting_user ON public.live_meeting_notes(meeting_id, user_id);
CREATE INDEX idx_live_meeting_notes_versions_meeting_user ON public.live_meeting_notes_versions(meeting_id, user_id, session_id);
CREATE INDEX idx_live_meeting_notes_versions_created_at ON public.live_meeting_notes_versions(created_at);

-- Function to cleanup versions when meeting is completed
CREATE OR REPLACE FUNCTION public.cleanup_meeting_note_versions()
RETURNS TRIGGER AS $$
BEGIN
  -- Only cleanup if meeting status changed to 'completed'
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- Delete all versions for this meeting
    DELETE FROM public.live_meeting_notes_versions 
    WHERE meeting_id = NEW.id;
    
    -- Log the cleanup
    INSERT INTO public.system_audit_log (
      table_name,
      operation,
      record_id,
      user_id,
      new_values
    ) VALUES (
      'live_meeting_notes_versions',
      'CLEANUP_ON_COMPLETION',
      NEW.id,
      NEW.user_id,
      jsonb_build_object('meeting_id', NEW.id, 'cleanup_reason', 'meeting_completed')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cleanup
CREATE TRIGGER cleanup_meeting_versions_on_completion
  AFTER UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_meeting_note_versions();

-- Function to get latest version for recovery
CREATE OR REPLACE FUNCTION public.get_latest_meeting_note_version(
  p_meeting_id UUID,
  p_user_id UUID,
  p_session_id TEXT
)
RETURNS TABLE(
  version_number INTEGER,
  notes_content TEXT,
  transcript_word_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    lmnv.version_number,
    lmnv.notes_content,
    lmnv.transcript_word_count,
    lmnv.created_at
  FROM public.live_meeting_notes_versions lmnv
  WHERE lmnv.meeting_id = p_meeting_id 
    AND lmnv.user_id = p_user_id
    AND lmnv.session_id = p_session_id
  ORDER BY lmnv.version_number DESC
  LIMIT 1;
$$;