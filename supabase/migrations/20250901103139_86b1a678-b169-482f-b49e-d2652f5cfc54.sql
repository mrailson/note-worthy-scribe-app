-- Fix stuck meetings that have word_count but are still in recording status
UPDATE meetings 
SET status = 'completed',
    end_time = COALESCE(end_time, updated_at, created_at + INTERVAL '1 hour')
WHERE status = 'recording' 
  AND word_count > 0 
  AND notes_generation_status = 'completed';