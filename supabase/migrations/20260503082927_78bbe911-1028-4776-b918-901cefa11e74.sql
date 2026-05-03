ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS notes_meeting_loaded_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_documents_loaded_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_title_generated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_prompt_assembled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_request_dispatched_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_first_delta_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_stream_complete_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_post_processing_complete_at TIMESTAMPTZ;

ALTER TABLE public.pipeline_test_runs
  ADD COLUMN IF NOT EXISTS notes_meeting_loaded_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_documents_loaded_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_title_generated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_prompt_assembled_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_request_dispatched_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_first_delta_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_stream_complete_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_post_processing_complete_at TIMESTAMPTZ;