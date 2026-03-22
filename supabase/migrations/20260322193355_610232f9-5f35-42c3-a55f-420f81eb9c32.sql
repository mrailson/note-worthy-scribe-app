ALTER TABLE public.user_document_settings
  ADD COLUMN IF NOT EXISTS discussion_summary_on boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS decisions_register_on boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_meeting_on boolean DEFAULT true;