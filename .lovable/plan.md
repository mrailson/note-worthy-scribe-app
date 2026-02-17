

# Upload Backup Audio to Supabase Storage (24-Hour Retention)

## Overview
When a backup recording stops, upload the audio segments to the existing `meeting-audio-backups` Supabase Storage bucket and create a record in the `meeting_audio_backups` table. This ensures the audio is available server-side for at least 24 hours, even if the user clears their browser or switches devices. The existing `delete-old-audio-backups` edge function already handles cleanup of files older than 24 hours.

## How It Works

1. When the backup recorder stops, each segment blob is uploaded from IndexedDB to Supabase Storage under the path `{user_id}/{meeting_id}/backup-segment-{index}.webm`
2. A record is inserted into the `meeting_audio_backups` table linking the file to the meeting
3. If the user is offline when recording stops, the upload is deferred and retried when connectivity returns
4. The existing `delete-old-audio-backups` edge function (already deployed) cleans up files older than 24 hours -- no changes needed there

## Technical Changes

### `src/hooks/useBackupRecorder.ts`
- Add a new `uploadToStorage` function that:
  - Retrieves all segments from IndexedDB for the session
  - Concatenates them into a single blob (or uploads individually with an index suffix)
  - Uploads to `meeting-audio-backups` bucket at `{userId}/{sessionId}/backup-segment-{index}.ext`
  - Inserts a row into `meeting_audio_backups` with `meeting_id`, `user_id`, `file_path`, `file_size`, `duration_seconds`, and `backup_reason`
- Modify `stopBackup` to accept `meetingId` and `userId` parameters
- After saving the final segment to IndexedDB, attempt the upload immediately if online
- If offline, mark the session as `pending_upload` so it can be retried later

### `src/hooks/useBackupSync.ts`
- Add an `uploadPendingBackups` function that checks for sessions with `pending_upload` status and attempts to upload them to Supabase Storage
- Call this on mount and whenever the app comes back online (`navigator.onLine` event)
- After successful upload, update the IndexedDB session with the remote file path for reference

### `src/components/standalone/RecorderInterface.tsx`
- Pass the current user ID and meeting ID (if available) through to `stopBackup`
- The meeting ID may not be available for standalone recordings -- in that case, use the backup session ID as a fallback identifier

### `src/components/offline/PendingBackupsList.tsx`
- Show upload status alongside processing status (e.g. "Uploaded" badge or "Upload pending" badge)
- Add a manual "Upload" button for sessions that failed to upload automatically

### `src/utils/offlineAudioStore.ts`
- Add a `pending_upload` status option to the `BackupSession` type
- Add an optional `remoteFilePath` field to track whether the session has been uploaded

## Storage Path Convention

```
meeting-audio-backups/{user_id}/{meeting_or_session_id}/backup-segment-0.webm
meeting-audio-backups/{user_id}/{meeting_or_session_id}/backup-segment-1.webm
```

## Cleanup

The existing `delete-old-audio-backups` edge function already:
- Deletes records from `meeting_audio_backups` older than 24 hours (configurable via `cutoffHours`)
- Removes the corresponding files from the `meeting-audio-backups` storage bucket
- Logs the action to `system_audit_log`

No changes are needed to the cleanup logic.

## RLS Policies

The `meeting-audio-backups` bucket already has RLS policies allowing authenticated users to upload, read, and delete files within their own user ID folder. No policy changes needed.

## Offline Resilience

- If the device is offline when recording stops, segments stay in IndexedDB and are marked for upload
- When connectivity returns (detected via `online` event listener), the upload is retried automatically
- Once uploaded, the local IndexedDB copy is retained until the session is explicitly deleted or processed -- this avoids data loss if the upload succeeds but the user wants to process locally

