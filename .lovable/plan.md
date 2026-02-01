

# Plan: Fix Meeting Recording Issues (Silent Stop + AssemblyAI System Audio)

## Issues Identified

Based on my investigation, there are **two distinct issues**:

### Issue 1: Recording Stopped Silently (No User Notification)

**Root Cause Found:**
The edge function logs show that your meeting (`21644c7a-5f9d-4464-9f7e-4f6c915bd5ab`) was auto-closed by the server at 08:48:07 due to inactivity - the system detected no transcript chunks had been saved in the last 2 minutes.

The server did send a kill signal, but it appears:
- The tab may have been in the background when the signal arrived
- The toast notification may not have appeared if the tab was not visible
- The recording interface did not stop cleanly on the client side

**Why no chunks were being saved:**
The logs at 08:44:26 and 08:44:07 show the meeting had "recent activity", but by 08:48:07 it was marked for closure. This suggests transcription stopped working sometime between those two checks (approximately 4 minutes gap).

### Issue 2: AssemblyAI Only Captures Microphone, Not System Audio (YouTube)

**Root Cause Found:**
The architecture reveals a key discrepancy in how Whisper and AssemblyAI receive system audio:

**Whisper's Audio Path (works):**
1. `startComputerAudioTranscription()` is called
2. Creates a screen share stream via `getDisplayMedia()`
3. `startCustomAudioProcessing()` creates a Web Audio pipeline that processes the screen stream directly
4. Sends 15-second chunks to the `speech-to-text` edge function

**AssemblyAI's Audio Path (partially broken):**
1. `buildAssemblyAudioStream()` is called with `screenStreamRef.current`
2. This function correctly checks for system audio tracks and creates a mixer
3. The mixed stream is passed to `assemblyPreview.startPreview(mixerResult.mixedStream)`
4. BUT: The `screenStreamRef.current` may become stale or lose its audio tracks after Chrome's screen share ends or the tab audio stops

**The specific problem:**
Looking at `buildAssemblyAudioStream.ts`, the system audio detection relies on the `screenStream` having live audio tracks. However, in Chrome:
- When sharing "Entire screen", the audio tracks can become inactive/ended if the user switches to another tab or minimizes the browser
- The RMS monitoring logs would show `⚠️ SILENT` for system audio in this case
- AssemblyAI then falls back to mic-only mode silently (with a warning toast that may have been missed)

---

## Fix Plan

### Fix 1: Improve Kill Signal Handling and Visibility Resilience

**Problem:** When the browser tab is backgrounded, the WebSocket connection to Supabase Realtime may not receive the kill signal reliably, and even if received, the toast may not appear.

**Changes:**

**File: `src/hooks/useMeetingKillSignal.ts`**
- Add visibility change detection to re-check meeting status when tab becomes visible
- Make the kill signal handler more robust with retry logic

**File: `src/components/MeetingRecorder.tsx`**
- Add a periodic "heartbeat" check that polls the meeting status directly from the database
- If the meeting is detected as `completed` but the client is still recording, auto-stop with a clear notification
- Check frequency: Every 30 seconds

**File: `supabase/functions/auto-close-inactive-meetings/index.ts`**
- Increase the inactivity threshold from 2 minutes to 3 minutes to give more buffer for slow transcription processing
- Add better logging to help diagnose future issues

### Fix 2: Ensure AssemblyAI Receives System Audio Reliably

**Problem:** AssemblyAI mixer is built once at recording start, but system audio tracks can become stale during long recordings.

**Changes:**

**File: `src/utils/buildAssemblyAudioStream.ts`**
- Add track ended/muted event listeners to detect when system audio becomes unavailable
- Expose a callback for when system audio is lost mid-recording

**File: `src/components/MeetingRecorder.tsx`**
- Subscribe to system audio track status changes
- When system audio is lost (track ended), show a clear warning: "System audio disconnected - only microphone is being transcribed"
- Add an indicator in the UI showing the current audio input status (Mic Only vs Mic + System)
- Consider reusing the same `screenStreamRef.current` for both Whisper's custom audio processing AND AssemblyAI's mixer to ensure consistency

**File: `src/lib/assembly-realtime.ts`**
- Add periodic RMS check logging to the console for debugging
- If system audio becomes silent for >60 seconds while recording, log a warning

### Fix 3: Add Recording Health Monitor (New Feature)

**New File: `src/hooks/useRecordingHealthMonitor.ts`**
Create a new hook that:
- Tracks the last successful transcript chunk timestamp
- Shows a warning after 60 seconds of no transcription activity: "No speech detected - check your audio input"
- Shows a critical warning after 2 minutes: "Recording may have stalled - consider stopping and checking your setup"
- Polls the meeting status in the database every 30 seconds to detect server-side closures

---

## Summary of Files to Modify

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/hooks/useMeetingKillSignal.ts` | Modify | Add visibility-aware reconnection and status polling |
| `src/hooks/useRecordingHealthMonitor.ts` | New | Health monitoring for recording session |
| `src/components/MeetingRecorder.tsx` | Modify | Integrate health monitor, track audio source status, add heartbeat check |
| `src/utils/buildAssemblyAudioStream.ts` | Modify | Add track status monitoring, expose callbacks for track ended |
| `src/lib/assembly-realtime.ts` | Modify | Add RMS logging for debugging |
| `supabase/functions/auto-close-inactive-meetings/index.ts` | Modify | Increase inactivity threshold to 3 minutes |

---

## Technical Details

### Health Monitor Implementation

The new `useRecordingHealthMonitor` hook will:

```text
┌─────────────────────────────────────────────────────────────┐
│                  Recording Health Monitor                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Track last chunk save timestamp (from chunkSaveStatuses) │
│ 2. Track last audio activity timestamp                      │
│ 3. Every 30s: Check meeting status in database              │
│    - If status !== 'recording' but client thinks it is      │
│    → Auto-stop with clear error message                     │
│ 4. Every 60s with no activity: Show warning toast           │
│ 5. Every 120s with no activity: Show critical toast         │
└─────────────────────────────────────────────────────────────┘
```

### System Audio Track Monitoring

The enhanced `buildAssemblyAudioStream` will:

```text
┌─────────────────────────────────────────────────────────────┐
│              System Audio Track Monitoring                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Listen for 'ended' event on system audio tracks          │
│ 2. Listen for 'mute' event on system audio tracks           │
│ 3. Call onSystemAudioLost callback when detected            │
│ 4. MeetingRecorder handles callback:                        │
│    - Update assemblyInputMode to 'mic-only'                 │
│    - Show warning toast to user                             │
│    - Log to debug panel                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Expected Outcomes

After these fixes:

1. **Silent stops eliminated**: Users will always know when their recording has stopped and why
2. **AssemblyAI system audio issues visible**: Clear indication when system audio is lost
3. **Proactive health monitoring**: Warnings appear before the server auto-closes the meeting
4. **Better debugging**: Console logs and debug panel will show audio input status throughout recording
5. **Reduced false positives**: 3-minute inactivity threshold gives more buffer for slow processing

