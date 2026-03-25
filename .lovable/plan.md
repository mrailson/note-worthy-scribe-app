

# Fix: Protect Recording from Screen-Off / Background Suspension

## Problem
The mobile recorder has **zero protection** against iOS/Android suspending the MediaRecorder when the screen locks or the app is backgrounded. It worked for 90 minutes once by luck, but failed on a 40-minute session (7 words captured). iOS behavior is inconsistent — it depends on memory pressure, battery, and other factors.

## Solution — Defense in Depth

Three independent safeguards, all in `src/components/recorder/NoteWellRecorderMobile.jsx`:

### 1. Wake Lock (prevents screen from locking)
- Request `navigator.wakeLock.request('screen')` when recording starts
- Release on stop
- Re-acquire on `visibilitychange` → `visible` (system releases it when tab backgrounds)
- Use the existing `useWakeLock` hook from `src/hooks/useWakeLock.ts`

### 2. iOS/Android Audio Keep-Alive (keeps AudioContext alive if backgrounded)
- Start `iOSAudioKeepAlive` (or `androidAudioKeepAlive` based on UA) when recording starts
- Plays inaudible 20Hz oscillator to prevent OS from killing the audio session
- Stop on recording end
- These utilities already exist but are **not wired up**

### 3. Stream Health Monitor (detect & warn if recording dies)
- Every 3 seconds, check `mediaRecorder.state` and `stream.getTracks()[0].readyState`
- If track becomes `ended` or recorder becomes `inactive` unexpectedly, show a red warning toast: "Recording may have been interrupted — stop and save to preserve what was captured"
- This won't fix the problem but ensures the user knows immediately rather than discovering 40 minutes later

### 4. UI: "Keep screen on" indicator
- Small amber pill shown during recording: "🔒 Screen lock prevented" (if wake lock active) or "⚠️ Keep screen on" (if wake lock unsupported)
- Subtle, non-intrusive

### Files to Modify
- `src/components/recorder/NoteWellRecorderMobile.jsx` — wire up wake lock, keep-alive, health monitor, UI indicator

