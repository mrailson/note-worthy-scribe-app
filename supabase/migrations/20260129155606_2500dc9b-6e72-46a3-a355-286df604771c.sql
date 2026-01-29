-- Delete duplicate nres_hours_entries, keeping the oldest record (earliest created_at)
DELETE FROM nres_hours_entries
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, work_date, start_time, end_time, activity_type
             ORDER BY created_at ASC
           ) as rn
    FROM nres_hours_entries
  ) duplicates
  WHERE rn > 1
);