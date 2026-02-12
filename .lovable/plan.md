

# Add Deleted Meetings (500+ Words) to Total Meeting Count

## What Changes

The "All Time" meeting count in the Meeting Usage Report currently only counts active completed meetings. Deleted meetings (stored in `meetings_archive`) that had over 500 words will be added to the All Time total, giving a more accurate picture of total usage.

## Why 500 Words?

Active meetings use a 100-word threshold to filter out test/abandoned recordings. For deleted meetings, a higher 500-word threshold ensures only genuinely substantive meetings are counted — since users may have deleted short or failed recordings.

## Technical Changes

### 1. Update the `get_meeting_usage_report` RPC Function

Modify the SQL function to:
- Filter `meetings_archive` to only count records where `word_count >= 500`
- Add the qualifying deleted count to each user's `all_time` total

The key change in the final SELECT:
```sql
-- Before:
COALESCE(ms.all_time, 0)::BIGINT as all_time,

-- After:
(COALESCE(ms.all_time, 0) + COALESCE(ds.deleted_count, 0))::BIGINT as all_time,
```

And in the `deleted_stats` CTE, add the word count filter:
```sql
-- Before:
SELECT ma.user_id, COUNT(*) as deleted_count
FROM public.meetings_archive ma
GROUP BY ma.user_id

-- After:
SELECT ma.user_id, COUNT(*) as deleted_count
FROM public.meetings_archive ma
WHERE ma.word_count >= 500
GROUP BY ma.user_id
```

### 2. Frontend (No Changes Required)

The `MeetingUsageReport.tsx` component already displays `all_time` and `deleted_meetings_count` from the RPC response. The system-wide totals are calculated by summing user-level values, so they will automatically reflect the updated counts.

### Summary of Impact

- The "All Time" number in each summary card and per-user row will increase by the number of qualifying deleted meetings
- The "Deleted" column will only show deleted meetings with 500+ words (previously showed all deleted)
- Duration, words, and cost figures remain unchanged (only from active meetings) since archived meetings don't store full duration/cost data reliably
