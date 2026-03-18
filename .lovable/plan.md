

## Delete All Stuck Meetings Over 7 Days Old

Delete the 29 stuck meetings (where `notes_generation_status` is `not_started` or `queued` and older than 7 days) using a single SQL DELETE via the Supabase insert tool.

### Implementation

Run this SQL using the insert tool:

```sql
DELETE FROM meetings 
WHERE notes_generation_status IN ('not_started', 'queued')
AND created_at < now() - interval '7 days';
```

Foreign key cascades will handle cleanup of related transcript chunks, summaries, and versions.

No safety net or cron job will be created at this time.

