

## Recover Stuck Meeting and Fix Display

### What happened
The meeting "Meeting 22 Apr 10:58" (`0630b79d-6d2f-4410-9bf0-c98a10cbfdb2`) has its audio successfully uploaded (4 segments, ~38MB total in the `meeting-audio-backups` storage bucket), but transcription was never triggered. The meeting is stuck with:
- Status: `processing`
- Word count: `0`
- No transcript, no notes, no overview
- `audio_backup_path` is null
- `import_source` is null — so the error/reprocess card doesn't show in the UI

### Two-part fix

**1. Show the Reprocess/Reupload card for any stuck meeting (code fix)**
Currently, the `RecordingErrorCard` (with Reupload Audio and Reprocess buttons) only appears when `import_source` starts with `mobile_`. This excludes meetings that were recorded via browser but got stuck. Change the condition in `MeetingHistoryList.tsx` (~line 2446) to also show the card when a meeting has `word_count === 0` and `status` is `processing` or `recording` — regardless of `import_source`.

**2. Trigger reprocessing for this specific meeting (data fix)**
- Update the meeting record to set `audio_backup_path` to the actual storage path so the reprocess function can find the audio
- Call the `reprocess-audio-segment` edge function to transcribe the 4 uploaded segments and save the combined transcript
- This will populate the transcript, update word count, and allow notes generation

### Files changed
- `src/components/MeetingHistoryList.tsx` — Broaden the condition for showing `RecordingErrorCard` to cover any meeting with zero words and a stuck status, not just mobile imports

### Manual step after code deployment
You can use the Recovery Tool page or the newly visible Reprocess button on the meeting card to trigger transcription of the stuck meeting's audio segments.

