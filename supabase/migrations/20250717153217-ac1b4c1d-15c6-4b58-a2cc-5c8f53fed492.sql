-- Delete duplicate meetings, keeping only the one with a summary or the most recent one
WITH duplicate_meetings AS (
  SELECT 
    m.id,
    m.title,
    m.start_time,
    m.user_id,
    m.created_at,
    EXISTS(SELECT 1 FROM meeting_summaries ms WHERE ms.meeting_id = m.id) as has_summary,
    ROW_NUMBER() OVER (
      PARTITION BY m.user_id, m.start_time, m.title 
      ORDER BY 
        EXISTS(SELECT 1 FROM meeting_summaries ms WHERE ms.meeting_id = m.id) DESC,
        m.created_at DESC
    ) as row_num
  FROM meetings m
  WHERE m.title = 'General Meeting'
    AND m.start_time >= '2025-07-17 15:00:00'
),
meetings_to_delete AS (
  SELECT id FROM duplicate_meetings WHERE row_num > 1
)
DELETE FROM meetings 
WHERE id IN (SELECT id FROM meetings_to_delete);