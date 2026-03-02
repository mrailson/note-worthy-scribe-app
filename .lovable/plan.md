

# Fix Jessica's Meeting Transcript Crossover

## Issue
Meeting 2 (Dr. Abbey's Work Schedule, id: `dfb86972-ca8a-470a-9751-8a6c872e0707`) has 1,617 characters of Meeting 1 (Angela's Performance Feedback) at the start of its `best_of_all_transcript`.

The crossover content discusses Angela's repeated questions and training needs. The actual Meeting 2 content begins at: *"This is a message, sorry, a meeting with Jessica Bradley HR and Dr. Abbey to discuss her work schedule and terms."*

## Fix
Run a single SQL update to trim the crossover text from the `best_of_all_transcript` column of Meeting 2:

```text
UPDATE meetings
SET best_of_all_transcript = SUBSTRING(best_of_all_transcript FROM 1618)
WHERE id = 'dfb86972-ca8a-470a-9751-8a6c872e0707';
```

This removes the first 1,617 characters (the Angela content) and keeps only the Dr. Abbey meeting content starting from *"This is a message, sorry..."*.

## Also check
- The `meeting_transcripts` table for this meeting (already confirmed empty, so no additional cleanup needed there).
- The meeting summary is already correct (it describes Dr. Abbey's schedule), so no summary regeneration is required.

## No code changes required
This is a data-only fix via a database migration. No application code changes are needed.

