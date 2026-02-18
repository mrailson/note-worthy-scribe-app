
# Fix Three Recording Issues: Misrouted Transcriber Type, Missing Device Info, and AssemblyAI Investigation

## Issue 1: Chrome Desktop Chunks Mislabelled as `ios-simple`

### Root Cause
The `handleBrowserTranscript` function in `MeetingRecorder.tsx` saves every chunk to the `meeting_transcription_chunks` table with a hardcoded `transcriber_type: 'ios-simple'` (line 2633). This function is the single entry point for both iOS and Desktop transcribers:

- The **SimpleIOSTranscriber** calls `handleBrowserTranscript` with `source: 'ios-simple'` -- correct
- The **DesktopWhisperTranscriber** also calls `handleBrowserTranscript` as its `onTranscription` callback -- incorrect label

The DesktopWhisperTranscriber additionally saves its own chunks internally with `transcriber_type: 'whisper'`, which explains why the Chrome desktop recording (`56af2380`) had 32 `ios-simple` + 32 `whisper` chunks -- they are duplicates with different labels.

### Fix
Change the `persistIOSChunk` function to use the `source` property from the transcript data when available, falling back to detecting the device type. The data object already carries a `source` field (`'ios-simple'` for iOS, undefined for desktop).

**File: `src/components/MeetingRecorder.tsx` (line ~2633)**
- Change `transcriber_type: 'ios-simple'` to `transcriber_type: (data as any).source || 'whisper'`
- This means iOS chunks keep their `ios-simple` label, and desktop chunks get `whisper`

Additionally, since the DesktopWhisperTranscriber already saves its own chunks to the database, the `persistIOSChunk` call from `handleBrowserTranscript` creates **duplicate rows** for desktop recordings. The fix should skip the `persistIOSChunk` DB save entirely when the source is not `ios-simple` (desktop transcriber handles its own persistence).

### Change Detail
In `handleBrowserTranscript`, wrap the `persistIOSChunk()` call so it only runs for iOS-originated chunks:

```text
// Only persist via this path for iOS chunks
// Desktop chunks are persisted by DesktopWhisperTranscriber internally
if ((data as any).source === 'ios-simple') {
  persistIOSChunk();
}
```

---

## Issue 2: Device Info Not Captured for Main Recorder

### Root Cause
After creating the meeting record at line 4282-4293 in `MeetingRecorder.tsx`, there is no call to `attachDeviceInfoToMeeting`. Every other recording interface (GP Scribe, Dual Transcription, Meeting Importer, Browser Recorder) calls it, but the main recorder was missed.

### Fix
Add `attachDeviceInfoToMeeting(realMeetingId)` after the meeting is created, matching the pattern used in all other recording interfaces.

**File: `src/components/MeetingRecorder.tsx` (after line ~4294)**
```text
// Attach device info in background (non-blocking)
import('@/utils/meetingDeviceCapture').then(({ attachDeviceInfoToMeeting }) => {
  attachDeviceInfoToMeeting(realMeetingId);
});
```

---

## Issue 3: Missing AssemblyAI Transcript

### Finding
Neither recording has any AssemblyAI data (no rows in `assembly_transcripts`, no `assembly_transcript_text` on the meetings). This is **expected behaviour** for these recording modes:

- The **iPhone recording** uses SimpleIOSTranscriber which does not include an AssemblyAI real-time stream
- The **Chrome desktop mic-only recording** uses DesktopWhisperTranscriber which also does not include AssemblyAI

AssemblyAI real-time streaming is only active when recording in **Mic + System Audio** mode (Teams/screen capture), where an `AssemblyAITranscriber` is started alongside the audio mixer. For mic-only recordings, only Whisper batch processing runs.

Both recordings did produce Whisper batch transcripts (via the consolidation edge function), so the transcription pipeline worked correctly -- it just did not include AssemblyAI because that service is reserved for system audio capture scenarios.

No code change needed for this issue.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/MeetingRecorder.tsx` | 1. Skip `persistIOSChunk()` for desktop-originated chunks (prevent duplicate rows with wrong label) |
| `src/components/MeetingRecorder.tsx` | 2. Add `attachDeviceInfoToMeeting` call after meeting creation |

## Risk Assessment
- **Duplicate chunk fix**: Reduces the number of saved chunks for desktop recordings (removes the incorrectly-labelled duplicates). Existing consolidation logic already handles both `whisper` and `ios-simple` types, so no downstream impact.
- **Device info**: Additive change, fire-and-forget background call matching the pattern used in 5 other recording interfaces.
