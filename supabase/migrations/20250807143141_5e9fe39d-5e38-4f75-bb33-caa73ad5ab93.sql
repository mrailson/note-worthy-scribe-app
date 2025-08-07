-- Add audio recording storage columns to meetings table
ALTER TABLE public.meetings 
ADD COLUMN mixed_audio_url TEXT,
ADD COLUMN left_audio_url TEXT,
ADD COLUMN right_audio_url TEXT,
ADD COLUMN recording_created_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain the columns
COMMENT ON COLUMN public.meetings.mixed_audio_url IS 'URL for the mixed stereo recording (left + right channels)';
COMMENT ON COLUMN public.meetings.left_audio_url IS 'URL for the left channel recording (microphone)';
COMMENT ON COLUMN public.meetings.right_audio_url IS 'URL for the right channel recording (system audio)';
COMMENT ON COLUMN public.meetings.recording_created_at IS 'Timestamp when the recording was created';