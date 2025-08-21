-- First, check if unique constraint exists and add it if missing
DO $$ 
BEGIN
    -- Add unique constraint on meeting_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'meeting_auto_notes_meeting_id_key'
    ) THEN
        ALTER TABLE meeting_auto_notes 
        ADD CONSTRAINT meeting_auto_notes_meeting_id_key UNIQUE (meeting_id);
    END IF;
END $$;

-- Now insert the missing auto-notes entry for the existing meeting
INSERT INTO meeting_auto_notes (meeting_id, status)
VALUES ('6c4a641c-e205-4be4-adcf-5a0f3cf6284c', 'pending')
ON CONFLICT (meeting_id) DO NOTHING;