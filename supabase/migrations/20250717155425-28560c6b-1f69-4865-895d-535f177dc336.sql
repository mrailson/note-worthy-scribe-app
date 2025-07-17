-- Clean up ALL duplicate meetings, keeping only the one with summary or most recent
WITH all_duplicates AS (
  SELECT 
    m.id,
    m.title,
    m.start_time,
    m.user_id,
    m.created_at,
    EXISTS(SELECT 1 FROM meeting_summaries ms WHERE ms.meeting_id = m.id) as has_summary,
    ROW_NUMBER() OVER (
      PARTITION BY m.user_id, m.title, DATE_TRUNC('minute', m.start_time)
      ORDER BY 
        EXISTS(SELECT 1 FROM meeting_summaries ms WHERE ms.meeting_id = m.id) DESC,
        m.created_at ASC
    ) as row_num
  FROM meetings m
),
meetings_to_delete AS (
  SELECT id FROM all_duplicates WHERE row_num > 1
)
DELETE FROM meetings 
WHERE id IN (SELECT id FROM meetings_to_delete);