

## Improved File Processing Feedback and Chronological Ordering

### What This Changes

**1. Descriptive Step-by-Step Status Messages**
Currently, files show generic statuses: "Pending", "Processing", "Done", or "Error". This will be enhanced with detailed, contextual messages so you can see exactly what's happening at each stage:

- **Audio files (WAV/MP3):** "Uploading..." → "Transcribing audio (chunk 2 of 5)..." → "Cleaning transcript..." → "Done (1,243 words)"
- **Document files (PDF/DOCX):** "Uploading..." → "Extracting text..." → "Done (856 words)"
- **Text files:** "Reading file..." → "Done (420 words)"
- **On error:** "Error: [specific reason]"

The status badge area will show these richer messages instead of just single-word labels.

**2. Chronological File Ordering**
Files will be sorted by their filename (which encodes date/time, e.g. `R20260221-163101.WAV`) so that the earliest recording is processed first and the most recent is appended last. This ensures the final stitched transcript reads in the correct time order.

### Technical Details

**File: `src/components/meeting/import/CreateMeetingTab.tsx`**

- Add a `statusMessage` field to the `UploadedFile` interface (e.g. "Transcribing audio (chunk 3 of 7)...")
- Sort files by name (ascending) before processing begins in `handleFilesAdded`, so `R20260221-163101` comes before `R20260221-173013`
- Update `transcribeAudioFile` and `processFile` to accept a progress callback that sets the `statusMessage` on each step
- Update the file list UI to display the `statusMessage` text instead of generic "Processing" / "Pending" badges
- Show word count in the "Done" badge (e.g. "Done (1,243 words)")
- Also sort files in `getCombinedTranscript()` by name to ensure chronological transcript assembly

