-- Add document_type column to meeting_documents table
ALTER TABLE meeting_documents 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'general';

-- Add a comment explaining the valid values
COMMENT ON COLUMN meeting_documents.document_type IS 'Document type: agenda, presentation, action_log, reference, recording, transcript, general';