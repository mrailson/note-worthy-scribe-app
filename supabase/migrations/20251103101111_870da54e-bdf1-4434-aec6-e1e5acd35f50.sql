-- Add style preview columns to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS style_previews JSONB,
ADD COLUMN IF NOT EXISTS style_previews_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS style_previews_transcript_hash TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_meetings_style_previews_generated_at 
ON public.meetings(style_previews_generated_at);

-- Add comment for documentation
COMMENT ON COLUMN public.meetings.style_previews IS 'Cached JSON object containing 10 different professional meeting note styles';
COMMENT ON COLUMN public.meetings.style_previews_generated_at IS 'Timestamp when style previews were last generated';
COMMENT ON COLUMN public.meetings.style_previews_transcript_hash IS 'SHA-256 hash of transcript used to generate previews, for cache validation';