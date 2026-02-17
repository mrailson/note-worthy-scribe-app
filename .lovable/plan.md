

# Integrate Backup Recorder into Main Meeting Recorder

## Problem
The offline backup recorder was only added to the **standalone recorder** (`/new-recorder` page). The main meeting recorder -- which is what users actually see on iPhone (shown in the screenshot) -- has no backup integration. No checkbox, no indicator, no backup audio capture.

## Solution
Wire the existing `useBackupRecorder` hook into `MeetingRecorder.tsx` so the backup runs alongside live recording on any device, with the checkbox defaulting to **on** for mobile.

## Changes Required

### `src/components/MeetingRecorder.tsx`

**1. Add imports and hook**
- Import `useBackupRecorder`, `BackupIndicator`, `BackupRecoveryPrompt`, and `useIsMobile`
- Add `backupEnabled` state (default `true` on mobile, `false` on desktop)
- Initialise `useBackupRecorder()` hook
- Add `showRecoveryPrompt` state

**2. Start backup in `startRecording()`**
- After the mic stream is acquired and recording begins (~line 4320), if `backupEnabled` is true, obtain the mic stream from `micAudioStreamRef.current` (or `assemblyAudioMixerRef.current?.mixedStream`) and call `startBackup(stream)`
- This reuses the same microphone stream -- no extra permission prompt

**3. Stop backup in `stopRecording()`**
- After stopping all transcribers, call `stopBackup(transcriptSuccessful, userId, meetingId)`
- Use the `effectiveWords` count already calculated in `stopRecording` to determine success (threshold: words > 5 or whatever the quality check dictates)
- If the transcript quality is poor, set `showRecoveryPrompt = true`

**4. Pause/resume backup**
- In the existing pause handler (~line 6104), add `pauseBackup()` call
- In the existing resume handler (~line 6129), add `resumeBackup()` call

**5. Add backup checkbox to recorder UI (before recording starts)**
- Add a "Save local backup" checkbox with the same styling as the standalone version
- Only visible when not recording
- Default checked on mobile

**6. Add BackupIndicator to recording UI**
- Show the shield badge alongside the existing recording status indicators (Duration, Word Count area) during active recording

**7. Add BackupRecoveryPrompt**
- Render `BackupRecoveryPrompt` when `showRecoveryPrompt` is true, after recording stops with poor transcript quality

### No other file changes needed
- `useBackupRecorder.ts`, `BackupIndicator.tsx`, `BackupRecoveryPrompt.tsx`, `offlineAudioStore.ts`, and `backupUploader.ts` are all reused as-is
- The `PendingBackupsList` already appears on `/new-recorder`; optionally it could also be shown on the main recorder's History tab, but that can be a follow-up

## Technical Notes

- The mic stream ref (`micAudioStreamRef.current`) is populated during `startMicrophoneTranscription()` before the backup start point, so it will be available
- For the mixed stream path (Chromium mic+system), `assemblyAudioMixerRef.current?.mixedStream` captures both sources -- the backup will use whichever is available
- The 500ms delay used in the standalone version is not needed here because `micAudioStreamRef` is set synchronously during `startRecording`
- Backup auto-deletes on success and uploads to Supabase Storage for 24-hour retention -- all existing behaviour carries over

