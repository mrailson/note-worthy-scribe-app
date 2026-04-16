
-- 1. Rename the correct meeting (17,611 words) to a descriptive title
UPDATE public.meetings 
SET title = 'Health, Equalities, & Prevention Group'
WHERE id = 'fd41b67d-bf11-41f3-80bf-2447e5f75863';

-- 2. Delete the duplicate shorter meeting (16,240 words)
DELETE FROM public.meeting_transcription_chunks 
WHERE meeting_id = 'd8924703-3f09-4d54-80ed-1f3e72e17fc8';

DELETE FROM public.meetings 
WHERE id = 'd8924703-3f09-4d54-80ed-1f3e72e17fc8';

-- 3. Clean up orphaned chunks from the deleted original meeting
DELETE FROM public.meeting_transcription_chunks 
WHERE meeting_id = '018e8d4e-9f3a-7000-8000-000000000000'
  AND NOT EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_id);
