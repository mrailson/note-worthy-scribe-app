

# Offline Backup Recorder — Revised UX Approach

## Concept Change

Instead of an "Offline Mode" toggle that replaces the live transcription flow, the offline backup runs **alongside** the normal live recording as an invisible safety net. The user simply ticks a checkbox before starting their meeting to say "save a local backup too."

## How the User Sees It

1. **Before recording starts**, a small checkbox appears beneath the existing recording controls:

```text
[x] Save local backup (recommended on mobile)
    Keeps a copy of the audio on your device in case of connection issues
```

2. **During recording**, a small indicator shows the backup is active (e.g. a shield icon with "Backup active"). No extra controls needed — it runs silently in the background.

3. **After the meeting ends normally** (with a successful live transcript), the local backup is automatically deleted — the user never needs to think about it.

4. **If the meeting fails** (zero words, connection lost, auto-closed), the user sees a notification:

```text
"Your meeting had no transcript, but a local backup was saved.
 [Process Backup Now]  [Keep for Later]"
```

5. **A "Saved Backups" section** appears on the recorder page (only visible when there are pending backups). This shows any unprocessed backup recordings with date, duration, and a "Process Now" button.

## Technical Plan

### New Files

**`src/utils/offlineAudioStore.ts`** — IndexedDB wrapper
- Opens/creates an `offline-backups` database with two object stores: `sessions` and `segments`
- `createSession(meetingId, metadata)` — links backup to the live meeting ID
- `saveSegment(sessionId, index, blob)` — stores a 60-minute audio chunk
- `getSession(id)` / `listPendingSessions()` / `deleteSession(id)`
- `getSegments(sessionId)` — retrieves all segments in order
- `clearCompletedSessions()` — housekeeping for successfully transcribed meetings

**`src/hooks/useBackupRecorder.ts`** — silent background recorder
- Accepts the same microphone stream already obtained by the live recorder (no second `getUserMedia` call)
- Runs a `MediaRecorder` that saves to IndexedDB via `offlineAudioStore`
- Handles 60-minute chunking with 10-second overlap:
  - A timer fires at 59m 50s to start a new `MediaRecorder` on the same stream
  - 10 seconds later, the old recorder is stopped — giving a 10-second dual-recording overlap
  - On iOS (where dual recorders on one stream may not work), the overlap is handled by buffering the last 10 seconds of raw audio from the previous segment and prepending it to the next
- Exposes: `startBackup(stream)`, `stopBackup()`, `isBackupActive`, `segmentCount`
- On `stopBackup()`, if the parent meeting has a successful transcript, auto-deletes the backup session

**`src/hooks/useBackupSync.ts`** — upload and transcription queue
- `processBackupSession(sessionId)` — uploads segments sequentially to existing `speech-to-text` edge function
- Deduplicates overlap text between segments using similarity threshold (0.60) from `whisperChunking.ts`
- Updates session status: `pending` to `processing` to `completed` to `error`
- Optionally saves the stitched transcript as a meeting record in Supabase
- Checks `navigator.onLine` before attempting uploads

**`src/components/offline/BackupIndicator.tsx`** — small in-recording status badge
- Shows a shield icon + "Backup active" text when backup is running
- Shows segment count for long meetings ("Segment 2 recording")
- Minimal footprint — sits alongside existing recording timer

**`src/components/offline/PendingBackupsList.tsx`** — recovery UI
- Only renders when there are pending backup sessions in IndexedDB
- Lists each backup with: date, duration, segment count, linked meeting title (if available)
- "Process Now" button (enabled when online) with progress indicator
- "Delete" option for unwanted backups
- Shows final transcript once processing completes

**`src/components/offline/BackupRecoveryPrompt.tsx`** — post-failure notification
- Shown when a meeting ends with zero transcript words but a backup exists
- Two actions: "Process Backup Now" and "Keep for Later"
- Dismissible; the backup remains in IndexedDB regardless

### Modified Files

**`src/components/standalone/RecorderInterface.tsx`**
- Add a "Save local backup" checkbox (default checked on mobile, unchecked on desktop)
- When recording starts with backup enabled, pass the microphone stream to `useBackupRecorder`
- When recording stops, check transcript word count; if zero, show `BackupRecoveryPrompt`
- If transcript is successful, call `stopBackup()` which auto-cleans the backup

**`src/components/standalone/RecorderControls.tsx`**
- Add the `BackupIndicator` component alongside the existing timer/volume indicators during recording

**`src/pages/NewRecorder.tsx`**
- Add `PendingBackupsList` below the recorder interface (only visible when backups exist)

### No Edge Function Changes
Existing `speech-to-text` / `speech-to-text-consultation` edge functions are reused as-is. The backup sync simply calls them sequentially per segment.

## Chunking Details

- **Max segment duration**: 60 minutes
- **Overlap**: 10 seconds between consecutive segments
- **Format**: `audio/webm;codecs=opus` (Android/desktop) or `audio/mp4` (iOS)
- **Estimated size**: ~3-5 MB per 60-minute segment at 64kbps
- **Storage**: IndexedDB — supports gigabytes, well within limits for 2-hour meetings (~10-15 MB)

## Key Behaviours

- The backup recorder shares the **same microphone stream** as the live recorder — no extra permissions prompt
- Backup is **invisible during normal operation** — just a small badge
- **Auto-cleanup on success** — if the live transcript works, the backup is silently deleted
- **Recovery only surfaces on failure** — the user only interacts with backups when something goes wrong
- Default to **checked on mobile** (where failures are more common) and **unchecked on desktop**

