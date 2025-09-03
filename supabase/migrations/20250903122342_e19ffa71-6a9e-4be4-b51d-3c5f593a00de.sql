-- Fix the check constraint to allow the values the trigger uses
ALTER TABLE meeting_notes_queue 
DROP CONSTRAINT IF EXISTS meeting_notes_queue_detail_level_check;

-- Add the correct constraint allowing all the detail levels used by the trigger
ALTER TABLE meeting_notes_queue 
ADD CONSTRAINT meeting_notes_queue_detail_level_check 
CHECK (detail_level IN ('brief', 'standard', 'detailed', 'very_detailed', 'executive', 'limerick'));

-- Now force complete the three stuck meetings
UPDATE meetings 
SET 
  status = 'completed',
  end_time = COALESCE(end_time, now()),
  updated_at = now()
WHERE id IN (
  '556e9730-cd28-43a4-b15b-1162cbe25b80',
  '32aa63b8-c0f7-4e96-a429-a4e5e2b3c0de',
  '70319b27-bd4d-4161-8654-52d851f487e6'
) AND status != 'completed';