-- Add merge rejection reason tracking to meeting transcription chunks
ALTER TABLE meeting_transcription_chunks 
ADD COLUMN merge_rejection_reason TEXT;