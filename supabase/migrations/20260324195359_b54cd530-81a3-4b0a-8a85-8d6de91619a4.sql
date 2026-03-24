-- Fix word_count for meetings that have transcript text but word_count = 0
UPDATE meetings 
SET word_count = array_length(
  regexp_split_to_array(trim(whisper_transcript_text), '\s+'), 1
)
WHERE whisper_transcript_text IS NOT NULL 
  AND whisper_transcript_text != ''
  AND (word_count IS NULL OR word_count = 0);