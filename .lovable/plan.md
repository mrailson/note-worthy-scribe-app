
# Plan: Disable Audio Alerts on iPhone Meeting Recorder

## Overview
Remove the audio alerts (warning beeps, critical alerts, and recovery chimes) that play during transcription chunking on iPhone. These sounds are triggered when the transcription watchdog detects a stall or recovery, but they can be distracting for users.

## Current Behaviour
When recording on iPhone:
- **Warning beep** plays after 2 minutes of no transcription chunks
- **Critical alert** plays after 3 minutes of no transcription chunks
- **Recovery chime** plays when transcription resumes after a stall

All three sounds are generated via the `iOSAudioAlert` class using the Web Audio API.

## Proposed Change
Disable the audio alerts in `useTranscriptionWatchdog.ts` by removing or commenting out the calls to `iOSAudioAlert` methods. The visual health indicator will continue to work, providing silent feedback to users.

## Technical Details

### File to Modify
**`src/hooks/useTranscriptionWatchdog.ts`**

### Changes Required

1. **Remove critical alert sound** (lines 146-147):
   - Remove: `iOSAudioAlert.playCriticalAlert();`

2. **Remove warning beep sound** (lines 159-160):
   - Remove: `iOSAudioAlert.playWarningBeep();`

3. **Remove recovery chime sound** (lines 175-176):
   - Remove: `iOSAudioAlert.playRecoveryChime();`

4. **Clean up import** (line 4):
   - Remove: `import { iOSAudioAlert } from '@/utils/iOSAudioAlert';`

### What Will Continue to Work
- The `TranscriptionHealthIndicator` visual status display
- Console logging for debugging purposes
- Stall detection and recovery callbacks
- Auto-recovery attempt triggering on mobile

### Files NOT Changed
- `src/utils/iOSAudioAlert.ts` — kept intact in case audio alerts are needed elsewhere or re-enabled later
- `src/utils/alertSounds.ts` — unrelated to chunking alerts (used for patient identity alerts in LG Capture)
