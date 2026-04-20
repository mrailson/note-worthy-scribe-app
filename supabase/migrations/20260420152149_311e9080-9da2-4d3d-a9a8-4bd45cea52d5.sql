WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY meeting_id,
                        COALESCE(session_id, ''),
                        chunk_number,
                        COALESCE(transcriber_type, ''),
                        COALESCE(source, '')
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.meeting_transcription_chunks
)
DELETE FROM public.meeting_transcription_chunks
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_transcription_chunks_session_chunk_unique
ON public.meeting_transcription_chunks (
  meeting_id,
  COALESCE(session_id, ''),
  chunk_number,
  COALESCE(transcriber_type, ''),
  COALESCE(source, '')
);