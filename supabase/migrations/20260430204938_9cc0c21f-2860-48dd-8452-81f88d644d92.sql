ALTER TABLE public.meeting_generation_log
  ADD COLUMN IF NOT EXISTS extracted_action_count INTEGER,
  ADD COLUMN IF NOT EXISTS decision_count INTEGER,
  ADD COLUMN IF NOT EXISTS next_meeting_item_count INTEGER,
  ADD COLUMN IF NOT EXISTS cross_section_check_performed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_reasoning_trace TEXT;