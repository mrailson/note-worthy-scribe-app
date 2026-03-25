

## ✅ Mobile Recorder: Default Offline + Live Transcript Rescue

### Changes made (25 Mar 2026)

**Problem**: Live mode on mobile discarded the AssemblyAI real-time transcript on stop, relying solely on Whisper batch transcription which hallucinated (8 words for an 18-minute meeting).

**Fix applied in `NoteWellRecorderMobile.jsx`**:

1. **Default to offline mode** — `mode` state initialised as `"offline"` instead of auto-detecting connectivity. The Live/Offline toggle pill is hidden from the UI. Going offline still forces offline mode, but going online no longer auto-switches to live.

2. **Capture live transcript on stop** — `stopRecording()` now snapshots `liveTranscript` into `capturedLiveTranscriptRef` before clearing. This is persisted into the IndexedDB record as `capturedLiveTranscript`.

3. **Live transcript rescue in sync pipeline** — After Whisper stitching, the system compares word counts:
   - If Whisper produced <30% of the live transcript's words → use live transcript
   - If Whisper produced <30 words for a 5+ minute recording and live has more → use live transcript
   - The rescued transcript is stored in `whisper_transcript_text` with `primary_transcript_source: "assemblyai_rescue"`
   - The live transcript is always saved to `assembly_transcript_text` for audit

4. **UI simplified** — Status text and step indicators no longer reference live/offline modes.
