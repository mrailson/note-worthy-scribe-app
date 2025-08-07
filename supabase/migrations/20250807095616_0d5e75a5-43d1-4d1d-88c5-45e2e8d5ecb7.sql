-- Create storage bucket for audio backups (super admin only)
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-audio-backups', 'meeting-audio-backups', false);

-- Create storage policies for audio backups (only super admins can access)
CREATE POLICY "Super admins can upload audio backups" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'meeting-audio-backups' AND is_system_admin());

CREATE POLICY "Super admins can view audio backups" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'meeting-audio-backups' AND is_system_admin());

CREATE POLICY "Super admins can delete audio backups" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'meeting-audio-backups' AND is_system_admin());

-- Create table to track audio backup metadata
CREATE TABLE public.meeting_audio_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  duration_seconds INTEGER,
  transcription_quality_score DECIMAL(3,2), -- 0.0 to 1.0 quality score
  word_count INTEGER,
  expected_word_count INTEGER,
  backup_reason TEXT, -- e.g. "low_word_count", "poor_quality", "manual_request"
  is_reprocessed BOOLEAN DEFAULT false,
  reprocessed_at TIMESTAMP WITH TIME ZONE,
  reprocessed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on meeting_audio_backups
ALTER TABLE public.meeting_audio_backups ENABLE ROW LEVEL SECURITY;

-- Only super admins can access audio backup metadata
CREATE POLICY "Super admins can manage audio backup metadata" 
ON public.meeting_audio_backups 
FOR ALL 
USING (is_system_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_meeting_audio_backups_updated_at
  BEFORE UPDATE ON public.meeting_audio_backups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();