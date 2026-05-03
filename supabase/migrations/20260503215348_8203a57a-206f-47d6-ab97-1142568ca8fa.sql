UPDATE public.meetings
SET status = 'failed'
WHERE status IN ('recording','processing','transcribing','pending_transcription')
  AND updated_at < now() - interval '24 hours';

UPDATE public.meetings
SET notes_generation_status = 'failed'
WHERE notes_generation_status IN ('queued','generating')
  AND updated_at < now() - interval '24 hours';