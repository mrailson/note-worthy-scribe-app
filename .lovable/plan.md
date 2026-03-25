

## Diagnosis: Why Your Live Meeting Had Only 8 Words

**What happened**: Your 18-minute meeting recorded audio and streamed it to AssemblyAI in real-time successfully -- the logs show full sentences coming back like *"Now, the exhibition is with the college until the end of the summer term..."*. However, when the recording stopped, the system discarded that live transcript entirely and instead sent the audio chunks to Whisper for batch transcription. Whisper hallucinated and produced only garbage text: *"Meeting 25 Mar 11, 2015, 1.30pm-1.30pm"* (8 words). The live AssemblyAI transcript was never saved to the database.

**Root cause**: In Live mode, the mobile recorder runs two parallel processes:
1. AssemblyAI real-time streaming (for the live preview panel) -- this worked perfectly
2. ChunkedRecorder + Whisper batch transcription (for the final saved transcript) -- this hallucinated

The live transcript is only held in React state and thrown away on stop. It is never persisted as a fallback or primary source.

---

## Recommended Plan: Default to Offline-Only on Mobile

Since offline mode works reliably and live mode adds complexity with no transcript safety net, the safest immediate fix is:

### Step 1: Change mobile default to Offline mode
- In `NoteWellRecorderMobile.jsx`, change the initial `mode` state from detecting connectivity to always defaulting to `"offline"`
- Remove or hide the Live/Offline toggle on mobile so users aren't tempted to switch

### Step 2: Save the live transcript as a fallback (safety net)
- When `stopRecording()` is called in Live mode, capture the current `liveTranscript` state value
- After Whisper transcription completes, compare word counts: if Whisper produced significantly fewer words than the live transcript (e.g. less than 30%), use the live transcript instead
- Save the live transcript to `meetings.assembly_transcript_text` so it's never lost

### Step 3: Add a "live transcript rescue" check in the sync pipeline
- Before creating the meeting record, if `fullTranscript` word count is suspiciously low (under 30 words for a recording over 5 minutes), check if a captured live transcript exists and use that instead
- Log a warning when this fallback triggers

---

## Technical Details

**Files to modify:**
- `src/components/recorder/NoteWellRecorderMobile.jsx`:
  - Change default mode initialisation (around line 540-545)
  - In `stopRecording()` (line 777), capture `liveTranscript` into a ref before clearing
  - In `syncRecording()` (line 1005), pass captured live transcript as fallback
  - In the meeting creation step (line 1245), compare Whisper vs live word counts and pick the better one
  - Store the non-primary transcript in the appropriate column (`assembly_transcript_text`) for audit

**Scope**: ~40-50 lines changed in one file. No database migrations needed.

