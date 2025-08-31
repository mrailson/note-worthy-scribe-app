-- Create a combined transcript from the chunks for the stuck meeting
INSERT INTO meeting_transcripts (meeting_id, content, created_at)
SELECT 
  meeting_id,
  string_agg(transcription_text, ' ' ORDER BY chunk_number) as combined_transcript,
  now()
FROM meeting_transcription_chunks 
WHERE meeting_id = '77b6b634-4946-4d96-a403-7bf1b641cb89'
  AND session_id = '77b6b634-4946-4d96-a403-7bf1b641cb89'
GROUP BY meeting_id;