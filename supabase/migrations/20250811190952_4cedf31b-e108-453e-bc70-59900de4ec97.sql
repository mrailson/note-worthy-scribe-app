-- Create table for progressive meeting summary chunks
CREATE TABLE IF NOT EXISTS public.meeting_summary_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meeting_id uuid NULL,
  session_id text NOT NULL,
  chunk_index integer NOT NULL,
  source_word_count integer NULL,
  partial_summary text NOT NULL,
  detail_level text NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_summary_chunks ENABLE ROW LEVEL SECURITY;

-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_meeting_summary_chunks_session ON public.meeting_summary_chunks (session_id);
CREATE INDEX IF NOT EXISTS idx_meeting_summary_chunks_meeting ON public.meeting_summary_chunks (meeting_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_meeting_summary_chunks_session_chunk ON public.meeting_summary_chunks (session_id, chunk_index);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_meeting_summary_chunks_updated_at ON public.meeting_summary_chunks;
CREATE TRIGGER trg_update_meeting_summary_chunks_updated_at
BEFORE UPDATE ON public.meeting_summary_chunks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
-- Insert: only by the authenticated user for their own rows
CREATE POLICY "Users can insert their own summary chunks"
ON public.meeting_summary_chunks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Select: user can read their own chunks, or chunks linked to meetings they own
CREATE POLICY "Users can view their own summary chunks"
ON public.meeting_summary_chunks
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (meeting_id IS NOT NULL AND meeting_id IN (
    SELECT id FROM public.meetings WHERE user_id = auth.uid()
  ))
);

-- Update/Delete not required for now
