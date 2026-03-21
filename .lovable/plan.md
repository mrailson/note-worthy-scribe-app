


# iOS Transcript Safety Net — IMPLEMENTED

## Changes Made

### 1. Fixed fake "saved" status (MeetingRecorder.tsx)
When `currentMeetingId` is missing, iOS chunks are now marked as `'failed'` (not `'saved'`). The chunk text is also queued into `sessionStorage('orphanedIOSChunks')` for emergency recovery at stop time.

### 2. Emergency transcript flush on stop (MeetingRecorder.tsx)
When the DB has zero chunks at consolidation time, the system now checks all in-memory sources (Whisper memory, AssemblyAI preview, Deepgram preview, orphaned iOS chunks) and picks the longest available transcript. It also persists this emergency transcript back to the DB so it survives.

### 3. Periodic AssemblyAI backup (useAssemblyRealtimePreview.ts)
Every 30 seconds while active, the AssemblyAI streaming transcript is flushed to `meetings.assembly_ai_transcript` so there's always a recoverable copy in the database.

### 4. iOS audio health gate (MeetingRecorder.tsx)
10 seconds after starting SimpleIOSTranscriber, a health check verifies that at least one audio blob has been captured. If not, an error toast warns the user about possible microphone failure.
