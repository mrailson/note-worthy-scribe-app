

## Audio Trim & Join Editor for the Create Tab

### What This Adds

An optional **"Advanced: Edit Audio Before Processing"** step that appears after files are uploaded but before transcription begins. Users can trim unwanted sections from the start/end of each recording, then join and process as one meeting.

### How It Works

**Standard flow (unchanged):** Upload files → auto-transcribe → create meeting. This remains the default.

**Advanced flow (opt-in):** Upload files → click "Edit audio before processing" → trim/preview each file → confirm → transcribe trimmed versions → create meeting.

### UI Design

**1. Toggle into edit mode**

After files are uploaded (but before processing starts), a subtle collapsible section appears:

```text
+------------------------------------------------------+
| Scissors icon  Edit Audio Before Processing          |
| Trim recordings and remove unwanted sections    [v]  |
+------------------------------------------------------+
```

Labelled as "Advanced" with a brief explanation: "Use this if your recording ran too long or you need to cut dead air from the start or end."

**2. Per-file trim editor (inside the collapsible)**

Each audio file gets a visual trim card:

```text
+------------------------------------------------------+
| R20260221-163101.WAV                    12:34 total  |
|                                                      |
| [====|==========================|====]               |
|  Start: 00:45          End: 11:20                    |
|                                                      |
|  [Play Preview]  [Reset]           Keeping: 10:35    |
+------------------------------------------------------+
```

- Two draggable handles (or number inputs) for start/end trim points
- A simple waveform-style progress bar (using canvas or a lightweight visualisation)
- Play preview button to audition the trimmed section using the Web Audio API
- "Keeping X:XX" indicator showing the retained duration
- Reset button to restore full length
- Non-audio files (PDF, TXT) are shown but not editable

**3. Confirm and process**

A "Process Trimmed Audio" button replaces the normal auto-processing flow. When clicked:
- Each audio file is sliced in the browser using the Web Audio API (decode → slice buffer → re-encode to WAV)
- The trimmed blobs replace the original files in the pipeline
- Normal transcription (chunking, Whisper, hallucination filtering) proceeds on the trimmed versions

**4. File ordering**

Files remain sorted chronologically by filename. The trim editor preserves this order and shows a numbered sequence so users can see the join order.

### Technical Details

**New component: `src/components/meeting/import/AudioTrimEditor.tsx`**

- Accepts the list of uploaded files and exposes `onTrimConfirm(trimmedFiles)` callback
- Uses `AudioContext.decodeAudioData()` to get duration and enable playback preview
- Stores trim points as `{ startSeconds: number, endSeconds: number }` per file
- On confirm, slices the decoded AudioBuffer and re-encodes to WAV using a utility function
- Simple range slider UI built with two `<input type="range">` elements (no heavy library needed)

**New utility: `src/utils/audioTrimmer.ts`**

- `getAudioDuration(file: File): Promise<number>` - decodes and returns duration in seconds
- `trimAudioFile(file: File, startSec: number, endSec: number): Promise<File>` - decodes, slices the AudioBuffer, re-encodes to a valid WAV file, returns as a new File object
- Uses the Web Audio API (AudioContext) which is available in all modern browsers
- Re-encoding uses a simple PCM WAV writer (similar to the existing `buildWavHeader` in `wavChunker.ts`)

**Changes to `CreateMeetingTab.tsx`**

- Add `showTrimEditor` state (boolean, default false)
- When files are added, they are NOT auto-processed if `showTrimEditor` is true
- Add a `Collapsible` section between the file list and the paste area
- When trim is confirmed, the trimmed File objects replace the originals and normal processing begins
- The collapsible is only shown when at least one audio file is uploaded
- Files that have already been processed cannot enter trim mode (button is hidden)

**Time formatting helper**

- `formatDuration(seconds: number): string` - returns "MM:SS" format
- Used in the trim UI for start/end labels and the "Keeping" indicator

### What It Does NOT Do

- No waveform visualisation (keeps it lightweight; can be added later)
- No mid-file splitting (only start/end trimming) - this covers the "left the recorder running" use case
- No re-ordering of files (chronological sort by filename is automatic)
- Does not affect non-audio files

