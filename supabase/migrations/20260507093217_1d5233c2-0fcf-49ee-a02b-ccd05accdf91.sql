ALTER TABLE public.nres_ppg_responses
  ADD COLUMN branch_site text,
  ADD COLUMN channel text NOT NULL DEFAULT 'web',
  ADD COLUMN call_duration_seconds integer,
  ADD COLUMN transcript_json jsonb,
  ADD COLUMN elevenlabs_conversation_id text;

UPDATE public.nres_ppg_responses SET channel = 'web' WHERE channel IS NULL;

ALTER TABLE public.nres_ppg_responses
  ADD CONSTRAINT nres_ppg_responses_branch_site_check
    CHECK (branch_site IS NULL OR branch_site IN ('Grange Park','Blisworth','Roade','Hanslope','Silverstone','Paulerspury')),
  ADD CONSTRAINT nres_ppg_responses_channel_check
    CHECK (channel IN ('web','paper','telephony')),
  ADD CONSTRAINT nres_ppg_responses_elevenlabs_conversation_id_key
    UNIQUE (elevenlabs_conversation_id);

COMMENT ON COLUMN public.nres_ppg_responses.branch_site IS 'Branch surgery the patient attended (one of six allowed sites). Optional.';
COMMENT ON COLUMN public.nres_ppg_responses.channel IS 'Capture channel for this response: web (online survey), paper (manual entry), or telephony (ElevenLabs voice agent).';
COMMENT ON COLUMN public.nres_ppg_responses.call_duration_seconds IS 'Length of the phone call in seconds. Populated only for telephony channel.';
COMMENT ON COLUMN public.nres_ppg_responses.transcript_json IS 'Full ElevenLabs call transcript JSON. Populated only for telephony channel.';
COMMENT ON COLUMN public.nres_ppg_responses.elevenlabs_conversation_id IS 'Unique ElevenLabs conversation ID; UNIQUE to prevent duplicate ingestion of the same call.';