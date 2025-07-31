-- Update existing meetings with sample overview data for testing
INSERT INTO public.meeting_overviews (meeting_id, overview, created_by)
SELECT 
  m.id as meeting_id,
  CASE 
    WHEN m.title LIKE '%PCN Board%' THEN 
      'PCN Board meeting covering staff pay proposals, care research coordinator recruitment challenges, practice manager feedback on new systems, risk stratification discussions, and borough collaboration updates. Key decisions needed on pay proposal responses and coordinator role restructuring.'
    WHEN m.title LIKE '%General Meeting%' THEN 
      'General meeting session with brief discussions and testing of meeting systems. This was a short test meeting to verify transcript capture and system functionality.'
    ELSE 
      'Meeting session covering various agenda items and discussions relevant to ' || m.meeting_type || ' operations. Key topics and decisions were recorded for follow-up actions.'
  END as overview,
  m.user_id as created_by
FROM public.meetings m
WHERE NOT EXISTS (
  SELECT 1 FROM public.meeting_overviews mo 
  WHERE mo.meeting_id = m.id
)
AND m.created_at >= '2025-07-01';