-- Add recording preferences columns to existing user_document_settings table
ALTER TABLE public.user_document_settings
  ADD COLUMN IF NOT EXISTS audio_mode text NOT NULL DEFAULT 'mic_only',
  ADD COLUMN IF NOT EXISTS preferred_mic_device_id text,
  ADD COLUMN IF NOT EXISTS preferred_mic_label text,
  ADD COLUMN IF NOT EXISTS notes_length text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS section_exec_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_key_points boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_decisions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_actions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_open_items boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_attendees boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_next_meeting boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_full_transcript boolean NOT NULL DEFAULT false;

-- Add notes_config column to meetings table for per-meeting snapshot
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS notes_config jsonb DEFAULT '{"length": "standard", "sections": {"exec_summary": true, "key_points": true, "decisions": true, "actions": true, "open_items": true, "attendees": true, "next_meeting": true, "full_transcript": false}}'::jsonb;