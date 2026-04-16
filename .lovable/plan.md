

# What Happened to Julia Railson's 17K Transcript — Findings and Fix

## Investigation Results

The reprocessing **worked** — the 17,611-word transcript was successfully saved to the database. Here's the situation:

1. **Original meeting** (`018e8d4e...`) has been **deleted** from the `meetings` table. Its 173 legacy chunks (only 7,262 words from fragmented live capture) still exist as orphaned records.

2. **Two new meetings were created** from the audio backup reprocessing:
   - `d8924703...` — 16,240 words (created 15 Apr 19:25)
   - `fd41b67d...` — 17,611 words (created 15 Apr 19:45)

3. **The transcript content looks clean** — it starts naturally ("I've got this one on, Sarah...") and ends properly ("Are we finished? Yeah, we are."). No garbled text in the database.

4. **Notes haven't been generated** — `notes_generation_status` is `not_started` on both meetings, so no meeting notes have been created from the new transcript yet.

5. **Generic title** — both meetings are titled "Meeting 15 Apr 18:21" instead of the original descriptive title.

## What "Distorted" Likely Means

The old meeting's notes were generated from the **original 7,262-word fragmented live transcript** (173 tiny chunks, many only 3 words). If you're still viewing the old notes/output rather than the new meeting, that would explain the distortion — the original chunks were extremely fragmentary.

## Recommended Actions

### 1. Rename the correct meeting
Update meeting `fd41b67d-bf11-41f3-80bf-2447e5f75863` title to "Health, Equalities, & Prevention Group" (or similar) so it's identifiable.

### 2. Generate notes from the 17K transcript
Trigger notes generation on meeting `fd41b67d...` — this has the fullest transcript (17,611 words) and should produce high-quality output for a 1hr 50min meeting.

### 3. Delete the duplicate
Remove the slightly shorter duplicate (`d8924703...`, 16,240 words) to avoid confusion.

### 4. Clean up orphaned chunks
The 173 legacy chunks for the deleted original meeting `018e8d4e...` can be purged.

## Technical Changes (if you want me to proceed)

- A single SQL migration to rename the meeting, delete the duplicate, and clean up orphan chunks
- Trigger notes generation via the existing edge function

Shall I proceed with these cleanup steps?

