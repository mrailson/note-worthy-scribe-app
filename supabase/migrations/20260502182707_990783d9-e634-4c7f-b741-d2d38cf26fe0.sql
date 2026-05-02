-- 1. Unstick the specific meeting from tonight so the user can hit Regenerate Notes
UPDATE meetings
   SET notes_generation_status = 'failed',
       updated_at = NOW()
 WHERE id = '0bc2717f-35ae-4a43-bd77-8cc0a8fac66e'
   AND notes_generation_status = 'generating';

-- 2. Add notes_model_attempt column so we can surface which Sonnet attempt succeeded
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS notes_model_attempt INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.meetings.notes_model_attempt IS
  'Which retry rung produced the notes. 1 = first try, 2/3 = Sonnet retries, 99 = emergency GPT-5 fallback.';