-- Clear any existing problematic queue entries for these meetings
DELETE FROM meeting_notes_queue 
WHERE meeting_id IN (
  '556e9730-cd28-43a4-b15b-1162cbe25b80',
  '32aa63b8-c0f7-4e96-a429-a4e5e2b3c0de',
  '70319b27-bd4d-4161-8654-52d851f487e6'
);

-- Force complete the three stuck meetings
UPDATE meetings 
SET 
  status = 'completed',
  end_time = COALESCE(end_time, now()),
  updated_at = now(),
  notes_generation_status = 'not_started'
WHERE id IN (
  '556e9730-cd28-43a4-b15b-1162cbe25b80',
  '32aa63b8-c0f7-4e96-a429-a4e5e2b3c0de',
  '70319b27-bd4d-4161-8654-52d851f487e6'
) AND status != 'completed';