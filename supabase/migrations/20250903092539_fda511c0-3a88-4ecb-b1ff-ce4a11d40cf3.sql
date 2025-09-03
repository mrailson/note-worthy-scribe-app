-- Enhance meeting_notes_queue table to support multiple note types
ALTER TABLE meeting_notes_queue 
ADD COLUMN IF NOT EXISTS note_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS batch_id UUID,
ADD COLUMN IF NOT EXISTS processing_model TEXT,
ADD COLUMN IF NOT EXISTS token_count INTEGER,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Create meeting_notes_multi table for storing all 5 types
CREATE TABLE IF NOT EXISTS meeting_notes_multi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('brief', 'detailed', 'very_detailed', 'executive', 'limerick')),
  content TEXT NOT NULL,
  model_used TEXT,
  token_count INTEGER,
  processing_time_ms INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meeting_id, note_type)
);

-- Enable RLS on meeting_notes_multi
ALTER TABLE meeting_notes_multi ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting_notes_multi
CREATE POLICY "Users can view their own meeting notes" 
ON meeting_notes_multi 
FOR SELECT 
USING (meeting_id IN (
  SELECT id FROM meetings WHERE user_id = auth.uid()
  UNION
  SELECT meeting_id FROM meeting_shares WHERE 
    shared_with_user_id = auth.uid() OR shared_with_email = auth.email()
));

CREATE POLICY "System can insert meeting notes" 
ON meeting_notes_multi 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update meeting notes" 
ON meeting_notes_multi 
FOR UPDATE 
USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_notes_multi_meeting_id ON meeting_notes_multi(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_multi_note_type ON meeting_notes_multi(meeting_id, note_type);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_meeting_notes_multi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_notes_multi_updated_at
  BEFORE UPDATE ON meeting_notes_multi
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_notes_multi_updated_at();