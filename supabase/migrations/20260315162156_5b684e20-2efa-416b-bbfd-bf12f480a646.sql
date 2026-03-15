ALTER TABLE public.user_document_settings
  ADD COLUMN IF NOT EXISTS attendees_on boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS meeting_details_on boolean DEFAULT true;